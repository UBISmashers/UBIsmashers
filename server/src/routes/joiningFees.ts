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

// Get advance payments
router.get('/', async (_req: Request, res: Response) => {
  try {
    const fees = await JoiningFee.find()
      .populate('memberId', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ date: -1 });

    return res.json(fees);
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
    const fee = await JoiningFee.findByIdAndDelete(req.params.id);
    if (!fee) {
      return res.status(404).json({ error: 'Advance not found' });
    }

    return res.json({ message: 'Advance deleted successfully' });
  } catch (error) {
    console.error('Delete advance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
