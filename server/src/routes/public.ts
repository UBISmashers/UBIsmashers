import express, { Request, Response } from 'express';
import { Member } from '../models/Member.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Expense } from '../models/Expense.js';
import { JoiningFee } from '../models/JoiningFee.js';

const router = express.Router();

router.get('/bills', async (_req: Request, res: Response) => {
  try {
    const members = await Member.find({ role: 'member' })
      .select('_id name status')
      .sort({ name: 1 });

    const shares = await ExpenseShare.find()
      .populate(
        'expenseId',
        'description amount date category isInventory itemName quantityPurchased courtBookingCost perShuttleCost shuttlesUsed',
      )
      .populate('memberId', 'name email');

    const byMemberId = new Map<string, any>();
    shares.forEach((share) => {
      const memberId = (share.memberId as any)?._id?.toString();
      if (!memberId) return;
      if (!byMemberId.has(memberId)) {
        byMemberId.set(memberId, {
          totalShare: 0,
          totalPaid: 0,
          paidCount: 0,
          unpaidCount: 0,
          breakdown: [],
        });
      }
      const agg = byMemberId.get(memberId);
      agg.totalShare += share.amount;
      if (share.paidStatus) {
        agg.totalPaid += share.amount;
        agg.paidCount += 1;
      } else {
        agg.unpaidCount += 1;
      }

      const expense = share.expenseId as any;
      agg.breakdown.push({
        expenseId: expense?._id,
        description: expense?.description || 'Expense',
        category: expense?.category || 'other',
        isInventory: !!expense?.isInventory,
        itemName: expense?.itemName,
        date: expense?.date,
        totalAmount: expense?.amount || 0,
        shareAmount: share.amount,
        paidStatus: share.paidStatus,
      });
    });

    const bills = members.map((member) => {
      const agg = byMemberId.get(member._id.toString());
      const totalShare = Number(agg?.totalShare || 0);
      const totalPaid = Number(agg?.totalPaid || 0);
      const outstandingBalance = totalShare - totalPaid;
      const paidCount = Number(agg?.paidCount || 0);
      const unpaidCount = Number(agg?.unpaidCount || 0);

      return {
        memberId: member._id,
        name: member.name,
        status: member.status,
        totalExpenseShare: totalShare,
        amountPaid: totalPaid,
        outstandingBalance,
        paidExpenses: paidCount,
        unpaidExpenses: unpaidCount,
        breakdown: (agg?.breakdown || []).sort((a: any, b: any) => {
          const aTime = a?.date ? new Date(a.date).getTime() : 0;
          const bTime = b?.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        }),
      };
    });

    const joiningFees = await JoiningFee.find()
      .populate('memberId', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ date: -1 });

    const equipment = await Expense.find({ isInventory: true })
      .populate('paidBy', 'name email')
      .sort({ date: -1 });

    return res.json({
      updatedAt: new Date().toISOString(),
      members: bills,
      joiningFees,
      equipment,
      summary: {
        totalShare: bills.reduce((sum, item) => sum + item.totalExpenseShare, 0),
        totalPaid: bills.reduce((sum, item) => sum + item.amountPaid, 0),
        totalOutstanding: bills.reduce((sum, item) => sum + item.outstandingBalance, 0),
      },
    });
  } catch (error) {
    console.error('Public bills error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
