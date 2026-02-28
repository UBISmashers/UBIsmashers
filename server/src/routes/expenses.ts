import express, { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { Expense } from '../models/Expense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';

const router = express.Router();
router.use(authenticate, authorize('admin'));

const expenseSchema = z.object({
  date: z.string().or(z.date()),
  category: z.enum(['court', 'equipment', 'refreshments', 'other']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  paidBy: z.string().min(1, 'Paid by member is required').optional(),
  courtBookingCost: z.number().min(0).optional(),
  perShuttleCost: z.number().min(0).optional(),
  shuttlesUsed: z.number().min(0).optional(),
  reduceFromStock: z.boolean().optional(),
  presentMembers: z.number().min(1, 'At least one member must be present').optional(),
  selectedMembers: z.array(z.string()).min(1, 'At least one member must be selected').optional(),
  status: z.enum(['pending', 'completed']).optional(),
});

// Get expenses
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, status } = req.query;

    let query: any = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get expense with split details
router.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email');

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const shares = await ExpenseShare.find({ expenseId: expense._id })
      .populate('memberId', 'name email')
      .sort({ createdAt: 1 });

    res.json({ expense, shares });
  } catch (error) {
    console.error('Get expense details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single expense
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email');
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create expense (Admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = expenseSchema.parse(req.body);
    
    const expenseDate = new Date(validatedData.date);
    expenseDate.setHours(0, 0, 0, 0);

    // Get member ID from user
    const { Member } = await import('../models/Member.js');
    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    // Use selectedMembers if provided, otherwise use presentMembers count
    let memberCount: number;
    let selectedMemberIds: mongoose.Types.ObjectId[] = [];

    if (validatedData.selectedMembers && validatedData.selectedMembers.length > 0) {
      // Convert string IDs to ObjectIds
      selectedMemberIds = validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id));
      memberCount = selectedMemberIds.length;
    } else if (validatedData.presentMembers) {
      memberCount = validatedData.presentMembers;
    } else {
      return res.status(400).json({ error: 'Either selectedMembers or presentMembers must be provided' });
    }

    const hasBreakdown =
      validatedData.category === 'court' &&
      (validatedData.courtBookingCost !== undefined ||
        validatedData.perShuttleCost !== undefined ||
        validatedData.shuttlesUsed !== undefined);
    const computedAmount =
      validatedData.category === 'court'
        ? (validatedData.courtBookingCost || 0) +
          (validatedData.perShuttleCost || 0) * (validatedData.shuttlesUsed || 0)
        : validatedData.amount;
    const finalAmount = hasBreakdown ? computedAmount : validatedData.amount;
    const perMemberShare = finalAmount / memberCount;

    const expense = await Expense.create({
      ...validatedData,
      date: expenseDate,
      amount: finalAmount,
      paidBy: member._id,
      presentMembers: memberCount,
      selectedMembers: selectedMemberIds,
      perMemberShare,
      status: validatedData.status || 'pending',
    });

    if (validatedData.reduceFromStock && (validatedData.shuttlesUsed || 0) > 0) {
      let remainingToUse = validatedData.shuttlesUsed || 0;
      const shuttlePurchases = await Expense.find({
        isInventory: true,
        $or: [
          { itemName: { $regex: /shuttle/i } },
          { description: { $regex: /shuttle/i } },
        ],
      }).sort({ date: 1 });

      for (const purchase of shuttlePurchases) {
        if (remainingToUse <= 0) break;
        const purchasedQty = purchase.quantityPurchased || 0;
        const usedQty = purchase.quantityUsed || 0;
        const remainingQty = Math.max(0, purchasedQty - usedQty);
        if (remainingQty <= 0) continue;
        const useQty = Math.min(remainingQty, remainingToUse);
        purchase.quantityUsed = usedQty + useQty;
        await purchase.save();
        remainingToUse -= useQty;
      }
    }

    // Create expense shares for each selected member
    const expenseShares = await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        // Don't create share for the person who paid (they already paid)
        if (memberId.toString() === member._id.toString()) {
          return null;
        }
        return ExpenseShare.create({
          expenseId: expense._id,
          memberId: memberId,
          amount: perMemberShare,
          paidStatus: false,
        });
      })
    );

    // Update member balances (add debt for each member except the payer)
    await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        if (memberId.toString() !== member._id.toString()) {
          const shareMember = await Member.findById(memberId);
          if (shareMember) {
            shareMember.balance = (shareMember.balance || 0) + perMemberShare;
            await shareMember.save();
          }
        }
      })
    );

    await expense.populate('paidBy', 'name email');
    await expense.populate('selectedMembers', 'name email');

    // Create notifications for members about new expense
    const { Notification } = await import('../models/Notification.js');
    const { User } = await import('../models/User.js');
    
    await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        const shareMember = await Member.findById(memberId);
        if (shareMember && shareMember.userId) {
          await Notification.create({
            userId: shareMember.userId,
            memberId: memberId,
            type: 'expense_added',
            title: 'New Expense Added',
            message: `A new expense "${expense.description}" of $${perMemberShare.toFixed(2)} has been added.`,
            data: {
              expenseId: expense._id.toString(),
              amount: perMemberShare,
            },
          });
        }
      })
    );

    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update expense (Admin only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const validatedData = expenseSchema.partial().parse(req.body);

    // Convert date to Date object if provided
    let expenseDate: Date | undefined;
    if (validatedData.date) {
      expenseDate = validatedData.date instanceof Date 
        ? validatedData.date 
        : new Date(validatedData.date);
      expenseDate.setHours(0, 0, 0, 0);
    }

    // Keep previous shares to rebalance member balances.
    const existingShares = await ExpenseShare.find({ expenseId: expense._id });
    const existingShareByMemberId = new Map<string, any>();
    existingShares.forEach((share) => {
      existingShareByMemberId.set(share.memberId.toString(), share);
    });

    // Revert outstanding balance impact from old unpaid shares.
    await Promise.all(
      existingShares.map(async (share) => {
        if (!share.paidStatus) {
          await Member.findByIdAndUpdate(share.memberId, {
            $inc: { balance: -share.amount },
          });
        }
      })
    );

    const nextCategory = validatedData.category ?? expense.category;
    const nextDescription = validatedData.description ?? expense.description;
    const nextStatus = validatedData.status ?? expense.status;
    const nextCourtBookingCost = validatedData.courtBookingCost ?? expense.courtBookingCost ?? 0;
    const nextPerShuttleCost = validatedData.perShuttleCost ?? expense.perShuttleCost ?? 0;
    const nextShuttlesUsed = validatedData.shuttlesUsed ?? expense.shuttlesUsed ?? 0;
    const hasCourtBreakdown =
      nextCategory === 'court' &&
      (
        validatedData.courtBookingCost !== undefined ||
        validatedData.perShuttleCost !== undefined ||
        validatedData.shuttlesUsed !== undefined ||
        expense.courtBookingCost !== undefined ||
        expense.perShuttleCost !== undefined ||
        expense.shuttlesUsed !== undefined
      );
    const computedCourtAmount =
      nextCourtBookingCost + nextPerShuttleCost * nextShuttlesUsed;
    const nextAmount =
      nextCategory === 'court' && hasCourtBreakdown
        ? computedCourtAmount
        : (validatedData.amount ?? expense.amount);

    let selectedMemberIds: mongoose.Types.ObjectId[] = (expense.selectedMembers || []).map(
      (memberRef: any) =>
        new mongoose.Types.ObjectId((memberRef?._id || memberRef).toString())
    );
    if (validatedData.selectedMembers && validatedData.selectedMembers.length > 0) {
      selectedMemberIds = validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id));
    } else if (validatedData.selectedMembers && validatedData.selectedMembers.length === 0) {
      selectedMemberIds = [];
    }

    let memberCount: number;
    if (selectedMemberIds.length > 0) {
      memberCount = selectedMemberIds.length;
    } else if (validatedData.presentMembers !== undefined) {
      memberCount = validatedData.presentMembers;
    } else {
      memberCount = expense.presentMembers;
    }

    if (memberCount <= 0) {
      return res.status(400).json({ error: 'At least one member must be present' });
    }

    let paidByMemberId = expense.paidBy.toString();
    if (validatedData.paidBy) {
      const paidByMember = await Member.findById(validatedData.paidBy);
      if (!paidByMember) {
        return res.status(400).json({ error: 'Paid by member not found' });
      }
      paidByMemberId = paidByMember._id.toString();
    }

    expense.date = expenseDate ?? expense.date;
    expense.category = nextCategory;
    expense.description = nextDescription;
    expense.amount = nextAmount;
    expense.paidBy = new mongoose.Types.ObjectId(paidByMemberId);
    expense.presentMembers = memberCount;
    expense.selectedMembers = selectedMemberIds;
    expense.perMemberShare = nextAmount / memberCount;
    expense.status = nextStatus;

    if (nextCategory === 'court') {
      expense.courtBookingCost = nextCourtBookingCost;
      expense.perShuttleCost = nextPerShuttleCost;
      expense.shuttlesUsed = nextShuttlesUsed;
      if (validatedData.reduceFromStock !== undefined) {
        expense.reduceFromStock = validatedData.reduceFromStock;
      }
    } else {
      expense.courtBookingCost = undefined;
      expense.perShuttleCost = undefined;
      expense.shuttlesUsed = undefined;
      expense.reduceFromStock = false;
    }

    // Rebuild share rows with updated split while preserving paid status by member.
    await ExpenseShare.deleteMany({ expenseId: expense._id });

    let hasUnpaidShare = false;
    await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        if (memberId.toString() === paidByMemberId) {
          return;
        }

        const existingShare = existingShareByMemberId.get(memberId.toString());
        const paidStatus = Boolean(existingShare?.paidStatus);
        const paidAt = paidStatus ? existingShare?.paidAt || new Date() : null;

        await ExpenseShare.create({
          expenseId: expense._id,
          memberId,
          amount: expense.perMemberShare,
          paidStatus,
          paidAt,
        });

        if (!paidStatus) {
          hasUnpaidShare = true;
          await Member.findByIdAndUpdate(memberId, {
            $inc: { balance: expense.perMemberShare },
          });
        }
      })
    );

    // Keep status aligned with pending/settled split when explicit status is not passed.
    if (!validatedData.status) {
      expense.status = hasUnpaidShare ? 'pending' : 'completed';
    }

    await expense.save();
    await expense.populate('paidBy', 'name email');
    await expense.populate('selectedMembers', 'name email');

    res.json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense (Admin only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expenseShares = await ExpenseShare.find({ expenseId: expense._id });

    // Revert outstanding balances that were added for unpaid shares.
    await Promise.all(
      expenseShares.map(async (share) => {
        if (!share.paidStatus) {
          await Member.findByIdAndUpdate(share.memberId, {
            $inc: { balance: -share.amount },
          });
        }
      })
    );

    await ExpenseShare.deleteMany({ expenseId: expense._id });
    await expense.deleteOne();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

