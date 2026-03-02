import express, { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { Expense } from '../models/Expense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';
import { JoiningFee } from '../models/JoiningFee.js';

const router = express.Router();
router.use(authenticate);

const equipmentSchema = z.object({
  date: z.string().or(z.date()),
  itemName: z.string().min(1).optional(),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  quantityPurchased: z.number().min(1, 'Quantity must be at least 1'),
  quantityUsed: z.number().min(0).optional(),
  selectedMembers: z.array(z.string()).optional(),
  status: z.enum(['pending', 'completed']).optional(),
  reduceFromAdvance: z.boolean().optional(),
});

const usageSchema = z.object({
  quantityUsed: z.number().min(0, 'Quantity must be positive'),
});

const normalizeAdvanceStatus = (totalAmount: number, remainingAmount: number) => {
  if (remainingAmount <= 0) return 'fully_used';
  if (remainingAmount < totalAmount) return 'partially_used';
  return 'available';
};

const reconcileShuttleStockUsage = async () => {
  const shuttlePurchases = await Expense.find({
    isInventory: true,
    $or: [{ itemName: { $regex: /shuttle/i } }, { description: { $regex: /shuttle/i } }],
  }).sort({ date: 1, createdAt: 1 });

  const stockDrivenExpenses = await Expense.find({
    isInventory: { $ne: true },
    category: 'court',
    reduceFromStock: true,
    shuttlesUsed: { $gt: 0 },
  }).sort({ date: 1, createdAt: 1 });

  let needed = stockDrivenExpenses.reduce(
    (sum, expense) => sum + Number(expense.shuttlesUsed || 0),
    0
  );

  for (const purchase of shuttlePurchases) {
    const purchasedQty = Number(purchase.quantityPurchased || 0);
    const nextUsed = Math.max(0, Math.min(purchasedQty, needed));
    needed = Math.max(0, needed - nextUsed);

    if (Number(purchase.quantityUsed || 0) !== nextUsed) {
      purchase.quantityUsed = nextUsed;
      await purchase.save();
    }
  }
};

// Get equipment purchases (inventory)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const equipment = await Expense.find({ isInventory: true })
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email')
      .sort({ date: -1 });

    return res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment purchase
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = equipmentSchema.parse(req.body);

    const expenseDate = new Date(validatedData.date);
    expenseDate.setHours(0, 0, 0, 0);

    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    const selectedMemberIds = (validatedData.selectedMembers || []).map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );
    const memberCount = selectedMemberIds.length;
    const perMemberShare = memberCount > 0 ? validatedData.amount / memberCount : 0;

    let deductedFromAdvance = 0;
    const advanceDeductions: Array<{ joiningFeeId: mongoose.Types.ObjectId; amount: number }> = [];
    if (validatedData.reduceFromAdvance && validatedData.amount > 0) {
      const advanceQuery: any = {
        $or: [
          { remainingAmount: { $gt: 0 } },
          { remainingAmount: { $exists: false }, amount: { $gt: 0 } },
        ],
      };
      if (selectedMemberIds.length > 0) {
        advanceQuery.memberId = { $in: selectedMemberIds };
      }

      const advances = await JoiningFee.find(advanceQuery).sort({ date: 1, createdAt: 1 });
      let remaining = Number(validatedData.amount || 0);
      for (const fee of advances) {
        if (remaining <= 0) break;

        const totalAmount = Number((fee as any).amount || 0);
        const rawRemaining = (fee as any).remainingAmount;
        const currentRemaining =
          rawRemaining === undefined || rawRemaining === null
            ? totalAmount
            : Number(rawRemaining);
        if (currentRemaining <= 0) continue;

        const deduction = Math.min(currentRemaining, remaining);
        const nextAmount = Number((currentRemaining - deduction).toFixed(2));
        remaining = Number((remaining - deduction).toFixed(2));
        deductedFromAdvance = Number((deductedFromAdvance + deduction).toFixed(2));
        advanceDeductions.push({
          joiningFeeId: fee._id as mongoose.Types.ObjectId,
          amount: deduction,
        });

        (fee as any).remainingAmount = nextAmount;
        (fee as any).status = normalizeAdvanceStatus(totalAmount, nextAmount);
        await fee.save();
      }
    }

    const equipment = await Expense.create({
      date: expenseDate,
      category: 'equipment',
      description: validatedData.description || 'Shuttle purchase',
      amount: validatedData.amount,
      paidBy: member._id,
      presentMembers: Math.max(1, memberCount),
      selectedMembers: selectedMemberIds,
      perMemberShare,
      status: validatedData.status || 'pending',
      isInventory: true,
      itemName: 'Shuttle',
      quantityPurchased: validatedData.quantityPurchased,
      quantityUsed: validatedData.quantityUsed || 0,
      reduceFromAdvance: validatedData.reduceFromAdvance || false,
      advanceDeductedAmount: deductedFromAdvance,
      advanceShortfallAmount: validatedData.reduceFromAdvance
        ? Number(Math.max(0, validatedData.amount - deductedFromAdvance).toFixed(2))
        : 0,
      advanceDeductions,
    });

    if (memberCount > 0) {
      await Promise.all(
        selectedMemberIds.map(async (memberId) => {
          if (memberId.toString() === member._id.toString()) {
            return null;
          }
          return ExpenseShare.create({
            expenseId: equipment._id,
            memberId,
            amount: perMemberShare,
            paidStatus: false,
          });
        })
      );

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
    }

    await equipment.populate('paidBy', 'name email');
    await equipment.populate('selectedMembers', 'name email');

    return res.status(201).json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment usage (Admin only)
router.patch('/:id/usage', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = usageSchema.parse(req.body);

    const equipment = await Expense.findById(req.params.id);
    if (!equipment || !equipment.isInventory) {
      return res.status(404).json({ error: 'Equipment purchase not found' });
    }

    const purchased = equipment.quantityPurchased || 0;
    if (validatedData.quantityUsed > purchased) {
      return res.status(400).json({ error: 'Used quantity cannot exceed purchased quantity' });
    }

    equipment.quantityUsed = validatedData.quantityUsed;
    await equipment.save();

    await equipment.populate('paidBy', 'name email');
    await equipment.populate('selectedMembers', 'name email');

    return res.json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update equipment usage error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment purchase (Admin only)
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const equipment = await Expense.findOne({ _id: req.params.id, isInventory: true });
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment purchase not found' });
    }

    const expenseShares = await ExpenseShare.find({ expenseId: equipment._id });

    await Promise.all(
      expenseShares.map(async (share) => {
        if (!share.paidStatus) {
          await Member.findByIdAndUpdate(share.memberId, {
            $inc: { balance: -share.amount },
          });
        }
      })
    );
    await ExpenseShare.deleteMany({ expenseId: equipment._id });

    const deducted = Number((equipment as any).advanceDeductedAmount || 0);
    if (deducted > 0) {
      const deductions = ((equipment as any).advanceDeductions || []) as Array<{
        joiningFeeId?: mongoose.Types.ObjectId | string;
        amount?: number;
      }>;
      let restoredFromBreakdown = 0;

      for (const deduction of deductions) {
        const feeId = deduction.joiningFeeId?.toString?.();
        const amount = Number(deduction.amount || 0);
        if (!feeId || amount <= 0) continue;

        const fee = await JoiningFee.findById(feeId);
        if (!fee) continue;

        const totalAmount = Number((fee as any).amount || 0);
        const currentRemaining = Number((fee as any).remainingAmount ?? totalAmount);
        const nextRemaining = Number((currentRemaining + amount).toFixed(2));
        (fee as any).remainingAmount = nextRemaining;
        (fee as any).status = normalizeAdvanceStatus(totalAmount, nextRemaining);
        await fee.save();
        restoredFromBreakdown = Number((restoredFromBreakdown + amount).toFixed(2));
      }

      const fallbackAmount = Number(Math.max(0, deducted - restoredFromBreakdown).toFixed(2));
      if (fallbackAmount > 0) {
        const selectedMemberIds = ((equipment.selectedMembers || []) as any[])
          .map((memberRef: any) => (memberRef?._id || memberRef)?.toString?.())
          .filter(Boolean);
        const payerId = (equipment.paidBy as any)?.toString?.();
        const targetMemberIds = selectedMemberIds.length > 0
          ? selectedMemberIds
          : payerId
            ? [payerId]
            : [];

        if (targetMemberIds.length > 0) {
          const perMemberRaw = fallbackAmount / targetMemberIds.length;
          let remaining = fallbackAmount;
          for (let i = 0; i < targetMemberIds.length; i += 1) {
            const memberId = targetMemberIds[i];
            const allocation =
              i === targetMemberIds.length - 1
                ? Number(remaining.toFixed(2))
                : Number(perMemberRaw.toFixed(2));
            remaining = Number((remaining - allocation).toFixed(2));

            if (allocation <= 0) continue;
            await JoiningFee.create({
              memberId,
              receivedBy: payerId || memberId,
              amount: allocation,
              remainingAmount: allocation,
              status: normalizeAdvanceStatus(allocation, allocation),
              date: new Date(),
              note: `Auto-refund: equipment purchase deleted (${equipment._id.toString()})`,
            });
          }
        }
      }
    }

    await equipment.deleteOne();
    await reconcileShuttleStockUsage();

    return res.json({ message: 'Equipment purchase deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
