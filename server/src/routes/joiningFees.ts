import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { JoiningFee } from '../models/JoiningFee.js';
import { Member } from '../models/Member.js';

const router = express.Router();
router.use(authenticate, authorize('admin'));

const joiningFeeSchema = z.object({
  memberId: z.string().min(1, 'Member is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  date: z.string().or(z.date()),
  note: z.string().optional(),
});

const normalizeAdvanceStatus = (totalAmount: number, remainingAmount: number) => {
  if (remainingAmount <= 0) return 'fully_used';
  if (remainingAmount < totalAmount) return 'partially_used';
  return 'available';
};

// Get advance payments
router.get('/', async (_req: Request, res: Response) => {
  try {
    const fees = await JoiningFee.find()
      .populate('memberId', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ date: -1 });

    // Backfill legacy records that only have `amount`.
    await Promise.all(
      fees.map(async (fee: any) => {
        const totalAmount = Number(fee.amount || 0);
        const rawRemaining = fee.remainingAmount;
        const remainingAmount =
          rawRemaining === undefined || rawRemaining === null
            ? totalAmount
            : Number(rawRemaining);
        const status = normalizeAdvanceStatus(totalAmount, remainingAmount);

        let changed = false;
        if (fee.remainingAmount !== remainingAmount) {
          fee.remainingAmount = remainingAmount;
          changed = true;
        }
        if (fee.status !== status) {
          fee.status = status;
          changed = true;
        }
        if (changed) {
          await fee.save();
        }
      })
    );

    const normalizedFees = fees.map((fee: any) => {
      const totalAmount = Number(fee.amount || 0);
      const remainingAmount = Number(
        fee.remainingAmount === undefined || fee.remainingAmount === null
          ? totalAmount
          : fee.remainingAmount
      );
      const usedAmount = Math.max(0, totalAmount - remainingAmount);
      return {
        ...fee.toObject(),
        remainingAmount,
        usedAmount,
        status: normalizeAdvanceStatus(totalAmount, remainingAmount),
      };
    });

    return res.json(normalizedFees);
  } catch (error) {
    console.error('Get advance payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create advance entry
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = joiningFeeSchema.parse(req.body);

    const receivedBy = await Member.findOne({ userId: req.user?.id });
    if (!receivedBy) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    const feeDate = new Date(validatedData.date);
    feeDate.setHours(0, 0, 0, 0);

    const fee = await JoiningFee.create({
      memberId: validatedData.memberId,
      receivedBy: receivedBy._id,
      amount: validatedData.amount,
      remainingAmount: validatedData.amount,
      status: normalizeAdvanceStatus(validatedData.amount, validatedData.amount),
      date: feeDate,
      note: validatedData.note,
    });

    await fee.populate('memberId', 'name email');
    await fee.populate('receivedBy', 'name email');

    return res.status(201).json(fee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create advance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete advance entry
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const fee = await JoiningFee.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ error: 'Advance not found' });
    }

    const totalAmount = Number(fee.amount || 0);
    const remainingAmount = Number((fee as any).remainingAmount ?? fee.amount ?? 0);
    const usedAmount = Math.max(0, totalAmount - remainingAmount);
    if (usedAmount > 0) {
      return res.status(400).json({
        error: 'Cannot delete advance entry after it has been used. Create an adjustment entry instead.',
      });
    }

    await fee.deleteOne();

    return res.json({ message: 'Advance deleted successfully' });
  } catch (error) {
    console.error('Delete advance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
