import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const markPaidSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
});

router.use(authenticate, authorize('admin'));

router.post('/mark-paid', async (req: Request, res: Response) => {
  try {
    const validatedData = markPaidSchema.parse(req.body);

    const expenseShare = await ExpenseShare.findOne({
      expenseId: validatedData.expenseId,
      memberId: validatedData.memberId,
    });

    if (!expenseShare) {
      return res.status(404).json({ error: 'Expense share not found' });
    }

    expenseShare.paidStatus = true;
    expenseShare.paidAt = new Date();
    await expenseShare.save();

    const member = await Member.findById(validatedData.memberId);
    if (member) {
      member.balance = member.balance - expenseShare.amount;
      await member.save();
    }

    await expenseShare.populate(
      'expenseId',
      'description amount date category courtBookingCost perShuttleCost shuttlesUsed',
    );
    await expenseShare.populate('memberId', 'name email');

    return res.json({
      message: 'Payment marked as paid',
      expenseShare,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Mark paid error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/member/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const expenseShares = await ExpenseShare.find({ memberId })
      .populate('expenseId', 'description amount date category courtBookingCost perShuttleCost shuttlesUsed')
      .sort({ createdAt: -1 });

    const totalShare = expenseShares.reduce((sum, share) => sum + share.amount, 0);
    const totalPaid = expenseShares
      .filter((share) => share.paidStatus)
      .reduce((sum, share) => sum + share.amount, 0);
    const totalUnpaid = totalShare - totalPaid;

    return res.json({
      expenseShares,
      summary: {
        totalShare,
        totalPaid,
        totalUnpaid,
        paidCount: expenseShares.filter((s) => s.paidStatus).length,
        unpaidCount: expenseShares.filter((s) => !s.paidStatus).length,
      },
    });
  } catch (error) {
    console.error('Get member payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', async (_req: Request, res: Response) => {
  try {
    const expenseShares = await ExpenseShare.find()
      .populate('expenseId', 'description amount date category courtBookingCost perShuttleCost shuttlesUsed')
      .populate('memberId', 'name email')
      .sort({ createdAt: -1 });

    const memberPayments: Record<string, any> = {};

    expenseShares.forEach((share) => {
      if (!share.memberId) {
        return;
      }

      const memberId = (share.memberId as any)._id.toString();
      if (!memberPayments[memberId]) {
        memberPayments[memberId] = {
          member: share.memberId,
          expenseShares: [],
          totalShare: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          paidCount: 0,
          unpaidCount: 0,
        };
      }

      memberPayments[memberId].expenseShares.push(share);
      memberPayments[memberId].totalShare += share.amount;

      if (share.paidStatus) {
        memberPayments[memberId].totalPaid += share.amount;
        memberPayments[memberId].paidCount += 1;
      } else {
        memberPayments[memberId].totalUnpaid += share.amount;
        memberPayments[memberId].unpaidCount += 1;
      }
    });

    return res.json({
      memberPayments: Object.values(memberPayments),
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
