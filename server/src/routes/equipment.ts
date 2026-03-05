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
  boughtByName: z.string().min(1, 'Bought by name is required'),
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

const courtAdvanceSchema = z.object({
  date: z.string().or(z.date()),
  courtBookedDate: z.string().or(z.date()),
  bookedByName: z.string().min(1, 'Booked by name is required'),
  courtsBooked: z.number().min(1, 'Courts booked must be at least 1'),
  amount: z.number().min(0, 'Amount must be positive'),
  description: z.string().optional(),
  reduceFromAdvance: z.boolean().optional(),
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

const restoreAdvanceFromExpense = async (expense: any) => {
  const deducted = Number((expense as any).advanceDeductedAmount || 0);
  if (deducted <= 0) return;

  const deductions = ((expense as any).advanceDeductions || []) as Array<{
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
  if (fallbackAmount <= 0) return;

  const selectedMemberIds = ((expense.selectedMembers || []) as any[])
    .map((memberRef: any) => (memberRef?._id || memberRef)?.toString?.())
    .filter(Boolean);
  const payerId = (expense.paidBy as any)?.toString?.();
  const targetMemberIds = selectedMemberIds.length > 0
    ? selectedMemberIds
    : payerId
      ? [payerId]
      : [];

  if (targetMemberIds.length === 0) return;

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
      note: `Auto-refund: record deleted (${expense._id.toString()})`,
    });
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

// Get court advance bookings
router.get('/court-advance', async (_req: Request, res: Response) => {
  try {
    const records = await Expense.find({ isCourtAdvanceBooking: true })
      .populate('paidBy', 'name email')
      .sort({ courtBookedDate: -1, date: -1 });

    return res.json(records);
  } catch (error) {
    console.error('Get court advance bookings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create court advance booking
router.post('/court-advance', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = courtAdvanceSchema.parse(req.body);

    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    const entryDate = new Date(validatedData.date);
    entryDate.setHours(0, 0, 0, 0);
    const bookedDate = new Date(validatedData.courtBookedDate);
    bookedDate.setHours(0, 0, 0, 0);

    let deductedFromAdvance = 0;
    const advanceDeductions: Array<{ joiningFeeId: mongoose.Types.ObjectId; amount: number }> = [];
    if (validatedData.reduceFromAdvance && validatedData.amount > 0) {
      const advances = await JoiningFee.find({
        $or: [
          { remainingAmount: { $gt: 0 } },
          { remainingAmount: { $exists: false }, amount: { $gt: 0 } },
        ],
      }).sort({ date: 1, createdAt: 1 });

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

    const record = await Expense.create({
      date: entryDate,
      courtBookedDate: bookedDate,
      category: 'court',
      description: validatedData.description || 'Court booked using advance',
      amount: validatedData.amount,
      paidBy: member._id,
      presentMembers: 1,
      selectedMembers: [],
      perMemberShare: 0,
      status: 'completed',
      isInventory: false,
      isCourtAdvanceBooking: true,
      courtsBooked: validatedData.courtsBooked,
      bookedByName: validatedData.bookedByName,
      reduceFromAdvance: validatedData.reduceFromAdvance || false,
      advanceDeductedAmount: deductedFromAdvance,
      advanceShortfallAmount: validatedData.reduceFromAdvance
        ? Number(Math.max(0, validatedData.amount - deductedFromAdvance).toFixed(2))
        : 0,
      advanceDeductions,
    });

    await record.populate('paidBy', 'name email');
    return res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create court advance booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update court advance booking (Admin only)
router.put('/court-advance/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = courtAdvanceSchema.parse(req.body);
    const record = await Expense.findOne({ _id: req.params.id, isCourtAdvanceBooking: true });
    if (!record) {
      return res.status(404).json({ error: 'Court advance booking not found' });
    }

    await restoreAdvanceFromExpense(record);

    let deductedFromAdvance = 0;
    const advanceDeductions: Array<{ joiningFeeId: mongoose.Types.ObjectId; amount: number }> = [];
    if (validatedData.reduceFromAdvance && validatedData.amount > 0) {
      const advances = await JoiningFee.find({
        $or: [
          { remainingAmount: { $gt: 0 } },
          { remainingAmount: { $exists: false }, amount: { $gt: 0 } },
        ],
      }).sort({ date: 1, createdAt: 1 });

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

    const entryDate = new Date(validatedData.date);
    entryDate.setHours(0, 0, 0, 0);
    const bookedDate = new Date(validatedData.courtBookedDate);
    bookedDate.setHours(0, 0, 0, 0);

    record.date = entryDate;
    (record as any).courtBookedDate = bookedDate;
    (record as any).bookedByName = validatedData.bookedByName;
    (record as any).courtsBooked = validatedData.courtsBooked;
    record.amount = validatedData.amount;
    record.description = validatedData.description || 'Court booked using advance';
    (record as any).reduceFromAdvance = validatedData.reduceFromAdvance || false;
    (record as any).advanceDeductedAmount = deductedFromAdvance;
    (record as any).advanceShortfallAmount = validatedData.reduceFromAdvance
      ? Number(Math.max(0, validatedData.amount - deductedFromAdvance).toFixed(2))
      : 0;
    (record as any).advanceDeductions = advanceDeductions;

    await record.save();
    await record.populate('paidBy', 'name email');
    return res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update court advance booking error:', error);
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
      boughtByName: validatedData.boughtByName,
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

// Update equipment purchase (Admin only)
router.put('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = equipmentSchema.parse(req.body);
    const equipment = await Expense.findOne({ _id: req.params.id, isInventory: true });
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment purchase not found' });
    }

    await restoreAdvanceFromExpense(equipment);

    const expenseDate = new Date(validatedData.date);
    expenseDate.setHours(0, 0, 0, 0);

    const selectedMemberIds =
      validatedData.selectedMembers !== undefined
        ? validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id))
        : ((equipment.selectedMembers || []) as mongoose.Types.ObjectId[]);
    const memberCount = selectedMemberIds.length;
    const perMemberShare = memberCount > 0 ? validatedData.amount / memberCount : 0;
    const payerId = (equipment.paidBy as any)?._id?.toString?.() || (equipment.paidBy as any)?.toString?.();

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

    const existingShares = await ExpenseShare.find({ expenseId: equipment._id });
    await Promise.all(
      existingShares.map(async (share) => {
        if (!share.paidStatus) {
          await Member.findByIdAndUpdate(share.memberId, {
            $inc: { balance: -share.amount },
          });
        }
      })
    );
    await ExpenseShare.deleteMany({ expenseId: equipment._id });

    equipment.date = expenseDate;
    equipment.description = validatedData.description || 'Shuttle purchase';
    (equipment as any).boughtByName = validatedData.boughtByName;
    equipment.amount = validatedData.amount;
    (equipment as any).itemName = validatedData.itemName || 'Shuttle';
    (equipment as any).quantityPurchased = validatedData.quantityPurchased;
    (equipment as any).quantityUsed = Math.min(
      validatedData.quantityUsed ?? Number((equipment as any).quantityUsed || 0),
      validatedData.quantityPurchased
    );
    equipment.selectedMembers = selectedMemberIds as any;
    equipment.presentMembers = Math.max(1, memberCount);
    equipment.perMemberShare = perMemberShare;
    equipment.status = validatedData.status || equipment.status;
    (equipment as any).reduceFromAdvance = validatedData.reduceFromAdvance || false;
    (equipment as any).advanceDeductedAmount = deductedFromAdvance;
    (equipment as any).advanceShortfallAmount = validatedData.reduceFromAdvance
      ? Number(Math.max(0, validatedData.amount - deductedFromAdvance).toFixed(2))
      : 0;
    (equipment as any).advanceDeductions = advanceDeductions;
    await equipment.save();

    if (memberCount > 0) {
      await Promise.all(
        selectedMemberIds.map(async (memberId) => {
          if (memberId.toString() === payerId) {
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
          if (memberId.toString() !== payerId) {
            await Member.findByIdAndUpdate(memberId, {
              $inc: { balance: perMemberShare },
            });
          }
        })
      );
    }

    await equipment.populate('paidBy', 'name email');
    await equipment.populate('selectedMembers', 'name email');
    return res.json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update equipment purchase error:', error);
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

    await restoreAdvanceFromExpense(equipment);

    await equipment.deleteOne();
    await reconcileShuttleStockUsage();

    return res.json({ message: 'Equipment purchase deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete court advance booking (Admin only)
router.delete('/court-advance/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const record = await Expense.findOne({ _id: req.params.id, isCourtAdvanceBooking: true });
    if (!record) {
      return res.status(404).json({ error: 'Court advance booking not found' });
    }

    await restoreAdvanceFromExpense(record);
    await record.deleteOne();

    return res.json({ message: 'Court advance booking deleted successfully' });
  } catch (error) {
    console.error('Delete court advance booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
