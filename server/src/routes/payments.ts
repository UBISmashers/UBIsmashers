import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';
import { Expense } from '../models/Expense.js';
import {
  removeExpenseShareAdvanceCredit,
  upsertExpenseShareAdvanceCredit,
} from '../utils/advanceCredits.js';

const router = express.Router();

const markPaidSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
});

const updateStatusSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
  paidStatus: z.boolean(),
});

const markMemberPaidSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
});

router.use(authenticate, authorize('admin'));

const expensePopulateFields =
  'description amount date category courtBookingCost perShuttleCost shuttlesUsed paidBy selectedMembers perMemberShare';

const buildMemberPaymentMap = async (memberId?: string) => {
  const shareQuery = memberId ? { memberId } : {};
  const expenseShares = await ExpenseShare.find(shareQuery)
    .populate('expenseId', expensePopulateFields)
    .populate('memberId', 'name email')
    .sort({ createdAt: -1 });

  const memberPayments: Record<string, any> = {};
  const handledExpenseMemberPairs = new Set<string>();

  expenseShares.forEach((share) => {
    if (!share.memberId || !share.expenseId) {
      return;
    }

    const resolvedMemberId = (share.memberId as any)._id.toString();
    handledExpenseMemberPairs.add(`${(share.expenseId as any)._id.toString()}:${resolvedMemberId}`);

    if (!memberPayments[resolvedMemberId]) {
      memberPayments[resolvedMemberId] = {
        member: share.memberId,
        expenseShares: [],
        totalShare: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        paidCount: 0,
        unpaidCount: 0,
      };
    }

    memberPayments[resolvedMemberId].expenseShares.push(share);
    memberPayments[resolvedMemberId].totalShare += share.amount;

    if (share.paidStatus) {
      memberPayments[resolvedMemberId].totalPaid += share.amount;
      memberPayments[resolvedMemberId].paidCount += 1;
    } else {
      memberPayments[resolvedMemberId].totalUnpaid += share.amount;
      memberPayments[resolvedMemberId].unpaidCount += 1;
    }
  });

  const expenseQuery = memberId
    ? { selectedMembers: memberId }
    : { selectedMembers: { $exists: true, $ne: [] } };

  const expenses = await Expense.find(expenseQuery)
    .populate('selectedMembers', 'name email')
    .populate('paidBy', 'name email')
    .sort({ date: -1, createdAt: -1 });

  expenses.forEach((expense: any) => {
    const expenseId = expense._id.toString();
    const payerId = expense.paidBy?._id?.toString?.() || expense.paidBy?.toString?.();
    const selectedMembers = (expense.selectedMembers || []) as any[];

    selectedMembers.forEach((selectedMember) => {
      const resolvedMemberId = selectedMember?._id?.toString?.() || selectedMember?.toString?.();
      if (!resolvedMemberId || resolvedMemberId !== payerId) {
        return;
      }

      const pairKey = `${expenseId}:${resolvedMemberId}`;
      if (handledExpenseMemberPairs.has(pairKey)) {
        return;
      }

      handledExpenseMemberPairs.add(pairKey);

      if (!memberPayments[resolvedMemberId]) {
        memberPayments[resolvedMemberId] = {
          member: selectedMember,
          expenseShares: [],
          totalShare: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          paidCount: 0,
          unpaidCount: 0,
        };
      }

      const amount = Number(expense.perMemberShare || 0);
      const syntheticShare = {
        _id: `payer-${expenseId}-${resolvedMemberId}`,
        expenseId: expense,
        memberId: selectedMember,
        amount,
        paidStatus: true,
        paidAt: expense.date,
        isPayerShare: true,
      };

      memberPayments[resolvedMemberId].expenseShares.push(syntheticShare);
      memberPayments[resolvedMemberId].totalShare += amount;
      memberPayments[resolvedMemberId].totalPaid += amount;
      memberPayments[resolvedMemberId].paidCount += 1;
    });
  });

  Object.values(memberPayments).forEach((entry: any) => {
    entry.expenseShares.sort((a: any, b: any) => {
      const aTime = a.expenseId?.date ? new Date(a.expenseId.date).getTime() : 0;
      const bTime = b.expenseId?.date ? new Date(b.expenseId.date).getTime() : 0;
      return bTime - aTime;
    });
  });

  return memberPayments;
};

const syncExpenseStatus = async (expenseId: string) => {
  const hasUnpaidShare = await ExpenseShare.exists({
    expenseId,
    paidStatus: false,
  });

  await Expense.findByIdAndUpdate(expenseId, {
    status: hasUnpaidShare ? 'pending' : 'completed',
  });
};

const updateSharePaymentStatus = async (
  expenseShare: any,
  memberId: string,
  paidStatus: boolean,
  receivedById: string,
) => {
  if (expenseShare.paidStatus === paidStatus) {
    return false;
  }

  const expense = await Expense.findById(expenseShare.expenseId).select(
    '_id description date category'
  );
  if (!expense) {
    throw new Error('Expense not found for payment share');
  }

  if (!paidStatus) {
    await removeExpenseShareAdvanceCredit({
      memberId,
      expenseId: expense._id,
    });
  } else {
    await upsertExpenseShareAdvanceCredit({
      memberId,
      receivedById,
      expenseId: expense._id,
      amount: Number(expenseShare.amount || 0),
      expenseMeta: {
        description: expense.description,
        date: expense.date,
        category: expense.category,
      },
    });
  }

  expenseShare.paidStatus = paidStatus;
  expenseShare.paidAt = paidStatus ? new Date() : null;
  await expenseShare.save();

  const member = await Member.findById(memberId);
  if (member) {
    member.balance = paidStatus
      ? member.balance - expenseShare.amount
      : member.balance + expenseShare.amount;
    await member.save();
  }

  await syncExpenseStatus(expenseShare.expenseId.toString());
  return true;
};

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

    const changed = await updateSharePaymentStatus(
      expenseShare,
      validatedData.memberId,
      true,
      validatedData.memberId,
    );

    await expenseShare.populate(
      'expenseId',
      'description amount date category courtBookingCost perShuttleCost shuttlesUsed',
    );
    await expenseShare.populate('memberId', 'name email');

    return res.json({
      message: changed ? 'Payment marked as paid' : 'Payment already marked as paid',
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

router.post('/update-status', async (req: Request, res: Response) => {
  try {
    const validatedData = updateStatusSchema.parse(req.body);

    const expenseShare = await ExpenseShare.findOne({
      expenseId: validatedData.expenseId,
      memberId: validatedData.memberId,
    });

    if (!expenseShare) {
      return res.status(404).json({ error: 'Expense share not found' });
    }

    const changed = await updateSharePaymentStatus(
      expenseShare,
      validatedData.memberId,
      validatedData.paidStatus,
      validatedData.memberId,
    );

    await expenseShare.populate(
      'expenseId',
      'description amount date category courtBookingCost perShuttleCost shuttlesUsed',
    );
    await expenseShare.populate('memberId', 'name email');

    return res.json({
      message: changed
        ? `Payment marked as ${validatedData.paidStatus ? 'paid' : 'unpaid'}`
        : `Payment already marked as ${validatedData.paidStatus ? 'paid' : 'unpaid'}`,
      expenseShare,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update payment status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mark-member-paid', async (req: Request, res: Response) => {
  try {
    const validatedData = markMemberPaidSchema.parse(req.body);

    const unpaidShares = await ExpenseShare.find({
      memberId: validatedData.memberId,
      paidStatus: false,
    });

    if (unpaidShares.length === 0) {
      return res.json({
        message: 'All payments are already marked as paid',
        updatedCount: 0,
      });
    }

    for (const share of unpaidShares) {
      await updateSharePaymentStatus(share, validatedData.memberId, true, validatedData.memberId);
    }

    return res.json({
      message: 'All unpaid shares for this member have been marked as paid',
      updatedCount: unpaidShares.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Mark member paid error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/member/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const memberPayments = await buildMemberPaymentMap(memberId);
    const paymentEntry = memberPayments[memberId];

    if (!paymentEntry) {
      return res.json({
        expenseShares: [],
        summary: {
          totalShare: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          paidCount: 0,
          unpaidCount: 0,
        },
      });
    }

    return res.json({
      expenseShares: paymentEntry.expenseShares,
      summary: {
        totalShare: paymentEntry.totalShare,
        totalPaid: paymentEntry.totalPaid,
        totalUnpaid: paymentEntry.totalUnpaid,
        paidCount: paymentEntry.paidCount,
        unpaidCount: paymentEntry.unpaidCount,
      },
    });
  } catch (error) {
    console.error('Get member payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', async (_req: Request, res: Response) => {
  try {
    const memberPayments = await buildMemberPaymentMap();

    return res.json({
      memberPayments: Object.values(memberPayments),
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
