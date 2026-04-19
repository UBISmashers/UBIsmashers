import express, { Request, Response } from 'express';
import { Member } from '../models/Member.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Expense } from '../models/Expense.js';
import { JoiningFee } from '../models/JoiningFee.js';

const router = express.Router();

const normalizeAdvanceStatus = (totalAmount: number, remainingAmount: number) => {
  if (remainingAmount <= 0) return 'fully_used';
  if (remainingAmount < totalAmount) return 'partially_used';
  return 'available';
};

export const PERIOD_VALUES = new Set(['all', 'custom', 'this_month', 'last_week', 'last_month', 'last_6_months', 'last_year']);

export const getPeriodDateRange = (
  period: string,
  customStartDate?: string,
  customEndDate?: string
): { start: Date; end: Date } | null => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'custom': {
      if (!customStartDate || !customEndDate) return null;
      const parsedStart = new Date(customStartDate);
      const parsedEnd = new Date(customEndDate);
      if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) return null;
      parsedStart.setHours(0, 0, 0, 0);
      parsedEnd.setHours(23, 59, 59, 999);
      if (parsedStart > parsedEnd) return null;
      return { start: parsedStart, end: parsedEnd };
    }
    case 'this_month':
      start.setDate(1);
      break;
    case 'last_week':
      start.setDate(now.getDate() - 6);
      break;
    case 'last_month':
      start.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
      end.setFullYear(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'last_6_months':
      start.setMonth(now.getMonth() - 6);
      break;
    case 'last_year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return null;
  }

  start.setHours(0, 0, 0, 0);
  if (period === 'last_month') {
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

export const getPeriodStartDate = (period: string): Date | null => {
  return getPeriodDateRange(period)?.start || null;
};

export const getCurrentMonthDateRange = (
  now: Date = new Date()
): { start: Date; end: Date } => {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const isDateWithinRange = (
  value: string | Date | undefined,
  range: { start: Date; end: Date }
) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
};

const isDateBefore = (value: string | Date | undefined, boundary: Date) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date < boundary;
};

router.get('/bills', async (req: Request, res: Response) => {
  try {
    const requestedPeriod = String(req.query.period || 'all');
    const period = PERIOD_VALUES.has(requestedPeriod) ? requestedPeriod : 'all';
    const customStartDate = req.query.customStartDate ? String(req.query.customStartDate) : undefined;
    const customEndDate = req.query.customEndDate ? String(req.query.customEndDate) : undefined;
    const periodDateRange = getPeriodDateRange(period, customStartDate, customEndDate);
    if (period === 'custom' && !periodDateRange) {
      return res.status(400).json({ error: 'Invalid custom date range' });
    }
    const expenseDateFilter =
      periodDateRange
        ? {
            date: {
              $gte: periodDateRange.start,
              $lte: periodDateRange.end,
            },
          }
        : {};

    const members = await Member.find({
      hiddenFromPublicBills: { $ne: true },
      isDeleted: { $ne: true },
    })
      .select('_id name status')
      .sort({ name: 1 });
    const visibleMemberIds = new Set(members.map((member) => member._id.toString()));

    const expenses = await Expense.find(expenseDateFilter)
      .select(
        '_id description amount date category isInventory itemName perMemberShare paidBy selectedMembers'
      )
      .populate('paidBy', '_id')
      .populate('selectedMembers', '_id')
      .sort({ date: -1, createdAt: -1 });

    const allExpenses = await Expense.find()
      .select(
        '_id description amount date category isInventory itemName perMemberShare paidBy selectedMembers'
      )
      .populate('paidBy', '_id')
      .populate('selectedMembers', '_id')
      .sort({ date: -1, createdAt: -1 });

    const allExpenseIds = allExpenses.map((expense) => expense._id);
    const shares =
      allExpenseIds.length > 0
        ? await ExpenseShare.find({ expenseId: { $in: allExpenseIds } }).select(
            'expenseId memberId paidStatus'
          )
        : [];
    const shareStatusByExpenseAndMember = new Map<string, boolean>();
    shares.forEach((share) => {
      const expenseId = (share.expenseId as any)?.toString?.();
      const memberId = (share.memberId as any)?.toString?.();
      if (!expenseId || !memberId) return;
      shareStatusByExpenseAndMember.set(`${expenseId}:${memberId}`, Boolean(share.paidStatus));
    });

    const byMemberId = new Map<string, any>();
    members.forEach((member) => {
      byMemberId.set(member._id.toString(), {
        totalShare: 0,
        totalPaid: 0,
        pastPending: 0,
        currentMonthExpenses: 0,
        paidCount: 0,
        unpaidCount: 0,
        breakdown: [],
      });
    });

    const currentMonthRange = getCurrentMonthDateRange();

    allExpenses.forEach((expense: any) => {
      const selected = (expense.selectedMembers || []) as any[];
      if (selected.length === 0) return;

      const expenseId = expense._id?.toString?.();
      const payerId = (expense.paidBy as any)?._id?.toString?.() || (expense.paidBy as any)?.toString?.();
      const shareAmount = Number(expense.perMemberShare || 0);
      const isInSelectedPeriod = !periodDateRange || isDateWithinRange(expense.date, periodDateRange);
      const isInCurrentMonth = isDateWithinRange(expense.date, currentMonthRange);
      const isBeforeCurrentMonth = isDateBefore(expense.date, currentMonthRange.start);

      selected.forEach((memberRef: any) => {
        const memberId = (memberRef?._id || memberRef)?.toString?.();
        if (!memberId) return;

        if (!visibleMemberIds.has(memberId)) return;

        const agg = byMemberId.get(memberId);
        const paidStatus =
          memberId === payerId
            ? true
            : Boolean(shareStatusByExpenseAndMember.get(`${expenseId}:${memberId}`));

        if (isInSelectedPeriod) {
          agg.totalShare += shareAmount;
          if (paidStatus) {
            agg.totalPaid += shareAmount;
            agg.paidCount += 1;
          } else {
            agg.unpaidCount += 1;
          }

          agg.breakdown.push({
            expenseId: expense._id,
            description: expense.description || 'Expense',
            category: expense.category || 'other',
            isInventory: !!expense.isInventory,
            itemName: expense.itemName,
            date: expense.date,
            totalAmount: Number(expense.amount || 0),
            shareAmount,
            paidStatus,
          });
        }

        if (isInCurrentMonth) {
          agg.currentMonthExpenses += shareAmount;
        }

        if (!paidStatus && isBeforeCurrentMonth) {
          agg.pastPending += shareAmount;
        }
      });
    });

    const joiningFees = await JoiningFee.find()
      .populate('memberId', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ date: -1 });

    const normalizedJoiningFees = joiningFees.map((fee: any) => {
      const totalAmount = Number(fee.amount || 0);
      const remainingAmount = Number(
        fee.remainingAmount === undefined || fee.remainingAmount === null
          ? totalAmount
          : fee.remainingAmount
      );
      const usedAmount = Math.max(0, totalAmount - remainingAmount);
      const status = normalizeAdvanceStatus(totalAmount, remainingAmount);
      return {
        ...fee.toObject(),
        remainingAmount,
        usedAmount,
        status,
      };
    });

    const advancesByMember = new Map<string, { totalPaid: number; used: number; remaining: number }>();
    normalizedJoiningFees.forEach((fee: any) => {
      const memberId = fee.memberId?._id?.toString?.() || fee.memberId?.toString?.();
      if (!memberId) return;
      if (!visibleMemberIds.has(memberId)) return;
      if (fee.excludeFromAdvanceTotals) return;
      const isAutoCredit = fee.sourceType === 'expense_share_payment';
      const prev = advancesByMember.get(memberId) || { totalPaid: 0, used: 0, remaining: 0 };
      advancesByMember.set(memberId, {
        // "Advance Paid" should only include direct/manual advance payments.
        totalPaid: prev.totalPaid + (isAutoCredit ? 0 : Number(fee.amount || 0)),
        used: prev.used + (isAutoCredit ? 0 : Number(fee.usedAmount || 0)),
        remaining: prev.remaining + Number(fee.remainingAmount || 0),
      });
    });

    const bills = members.map((member) => {
      const agg = byMemberId.get(member._id.toString());
      const totalShare = Number(agg?.totalShare || 0);
      const totalPaid = Number(agg?.totalPaid || 0);
      const outstandingBalance = totalShare - totalPaid;
      const paidCount = Number(agg?.paidCount || 0);
      const unpaidCount = Number(agg?.unpaidCount || 0);
      const advance = advancesByMember.get(member._id.toString()) || {
        totalPaid: 0,
        used: 0,
        remaining: 0,
      };
      const advanceStatus =
        advance.totalPaid <= 0
          ? 'no_advance'
          : normalizeAdvanceStatus(advance.totalPaid, Math.min(advance.remaining, advance.totalPaid));

      return {
        memberId: member._id,
        name: member.name,
        status: member.status,
        totalExpenseShare: totalShare,
        pastPending: Number((agg?.pastPending || 0).toFixed(2)),
        currentMonthExpenses: Number((agg?.currentMonthExpenses || 0).toFixed(2)),
        amountPaid: totalPaid,
        outstandingBalance,
        advanceTotalPaid: Number(advance.totalPaid.toFixed(2)),
        advanceUsed: Number(advance.used.toFixed(2)),
        advanceRemaining: Number(advance.remaining.toFixed(2)),
        advanceStatus,
        paidExpenses: paidCount,
        unpaidExpenses: unpaidCount,
        breakdown: (agg?.breakdown || []).sort((a: any, b: any) => {
          const aTime = a?.date ? new Date(a.date).getTime() : 0;
          const bTime = b?.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        }),
      };
    });

    const equipment = await Expense.find({ isInventory: true, ...expenseDateFilter })
      .populate('paidBy', 'name email')
      .sort({ date: -1 });
    const courtAdvanceBookings = await Expense.find({
      isCourtAdvanceBooking: true,
      ...expenseDateFilter,
    })
      .populate('paidBy', 'name email')
      .sort({ courtBookedDate: -1, date: -1 });
    const sessionHistory = await Expense.find({
      category: 'court',
      isInventory: { $ne: true },
      isCourtAdvanceBooking: { $ne: true },
      ...expenseDateFilter,
    })
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email')
      .sort({ date: -1, createdAt: -1 });

    const normalizedSessionHistory = sessionHistory.map((item: any) => {
      const selectedMembers = (item.selectedMembers || []).filter((member: any) => {
        const memberId = member?._id?.toString?.() || member?.toString?.();
        return memberId ? visibleMemberIds.has(memberId) : false;
      });

      return {
        ...item.toObject(),
        selectedMembers,
      };
    });

    const totalEligibleJoiningFees = normalizedJoiningFees.filter(
      (fee: any) => !fee.excludeFromAdvanceTotals
    );

    const totalAdvancePaid = totalEligibleJoiningFees.reduce(
      (sum: number, fee: any) =>
        sum + (fee.sourceType === 'expense_share_payment' ? 0 : Number(fee.amount || 0)),
      0
    );
    const totalAdvanceRemaining = totalEligibleJoiningFees.reduce(
      (sum: number, fee: any) => sum + Number(fee.remainingAmount || 0),
      0
    );
    const totalAdvanceUsed = Number(
      totalEligibleJoiningFees.reduce(
        (sum: number, fee: any) =>
          sum + (fee.sourceType === 'expense_share_payment' ? 0 : Number(fee.usedAmount || 0)),
        0
      ).toFixed(2)
    );

    return res.json({
      updatedAt: new Date().toISOString(),
      period,
      members: bills,
      joiningFees: normalizedJoiningFees,
      equipment,
      courtAdvanceBookings,
      sessionHistory: normalizedSessionHistory,
      summary: {
        totalShare: bills.reduce((sum, item) => sum + item.totalExpenseShare, 0),
        totalPaid: bills.reduce((sum, item) => sum + item.amountPaid, 0),
        totalOutstanding: bills.reduce((sum, item) => sum + item.outstandingBalance, 0),
        totalAdvancePaid: Number(totalAdvancePaid.toFixed(2)),
        totalAdvanceUsed,
        totalAdvanceRemaining: Number(totalAdvanceRemaining.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Public bills error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
