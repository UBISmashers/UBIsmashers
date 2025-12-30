import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Expense } from '../models/Expense.js';
import { Member } from '../models/Member.js';

const router = express.Router();

// Mark expense share as paid (Admin only)
const markPaidSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
});

router.post('/mark-paid', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = markPaidSchema.parse(req.body);

    // Find the expense share
    const expenseShare = await ExpenseShare.findOne({
      expenseId: validatedData.expenseId,
      memberId: validatedData.memberId,
    });

    if (!expenseShare) {
      return res.status(404).json({ error: 'Expense share not found' });
    }

    // Mark as paid
    expenseShare.paidStatus = true;
    expenseShare.paidAt = new Date();
    await expenseShare.save();

    // Update member balance (reduce debt)
    const member = await Member.findById(validatedData.memberId);
    if (member) {
      member.balance = member.balance - expenseShare.amount;
      await member.save();
    }

    // Populate related data
    await expenseShare.populate('expenseId', 'description amount date');
    await expenseShare.populate('memberId', 'name email');

    res.json({
      message: 'Payment marked as paid',
      expenseShare,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment status for a member (Admin or member themselves)
router.get('/member/:memberId', authenticate, async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    // Members can only view their own payments unless admin
    if (req.user?.role !== 'admin') {
      const member = await Member.findOne({ userId: req.user?.id });
      if (!member || member._id.toString() !== memberId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const expenseShares = await ExpenseShare.find({ memberId })
      .populate('expenseId', 'description amount date category')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totalShare = expenseShares.reduce((sum, share) => sum + share.amount, 0);
    const totalPaid = expenseShares
      .filter(share => share.paidStatus)
      .reduce((sum, share) => sum + share.amount, 0);
    const totalUnpaid = totalShare - totalPaid;

    res.json({
      expenseShares,
      summary: {
        totalShare,
        totalPaid,
        totalUnpaid,
        paidCount: expenseShares.filter(s => s.paidStatus).length,
        unpaidCount: expenseShares.filter(s => !s.paidStatus).length,
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all payment statuses (Admin only)
router.get('/all', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const expenseShares = await ExpenseShare.find()
      .populate('expenseId', 'description amount date category')
      .populate('memberId', 'name email')
      .sort({ createdAt: -1 });

    // Group by member
    const memberPayments: Record<string, any> = {};
    
    expenseShares.forEach(share => {
      const memberId = (share.memberId as any)._id.toString();
      if (!memberPayments[memberId]) {
        memberPayments[memberId] = {
          member: share.memberId,
          expenseShares: [],
          totalShare: 0,
          totalPaid: 0,
          totalUnpaid: 0,
        };
      }
      memberPayments[memberId].expenseShares.push(share);
      memberPayments[memberId].totalShare += share.amount;
      if (share.paidStatus) {
        memberPayments[memberId].totalPaid += share.amount;
      } else {
        memberPayments[memberId].totalUnpaid += share.amount;
      }
    });

    res.json({
      memberPayments: Object.values(memberPayments),
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

