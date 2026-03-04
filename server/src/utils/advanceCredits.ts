import mongoose from 'mongoose';
import { JoiningFee } from '../models/JoiningFee.js';

const round2 = (value: number) => Number((value || 0).toFixed(2));

export const normalizeAdvanceStatus = (totalAmount: number, remainingAmount: number) => {
  if (remainingAmount <= 0) return 'fully_used';
  if (remainingAmount < totalAmount) return 'partially_used';
  return 'available';
};

const toObjectId = (value: string | mongoose.Types.ObjectId) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);

const buildNote = (expense: {
  _id: mongoose.Types.ObjectId | string;
  description?: string;
  date?: Date;
  category?: string;
}) => {
  const expenseDate = expense.date ? new Date(expense.date).toISOString().split('T')[0] : 'unknown-date';
  const category = expense.category || 'expense';
  const description = expense.description || 'Expense';
  return `Auto credit from ${category} share payment (${expenseDate}): ${description}`;
};

export const upsertExpenseShareAdvanceCredit = async ({
  memberId,
  receivedById,
  expenseId,
  amount,
  expenseMeta,
}: {
  memberId: string | mongoose.Types.ObjectId;
  receivedById: string | mongoose.Types.ObjectId;
  expenseId: string | mongoose.Types.ObjectId;
  amount: number;
  expenseMeta: {
    description?: string;
    date?: Date;
    category?: string;
  };
}) => {
  const normalizedAmount = round2(Number(amount || 0));
  if (normalizedAmount <= 0) return;

  const sourceExpenseId = toObjectId(expenseId);
  const sourceMemberId = toObjectId(memberId);
  const receiverId = toObjectId(receivedById);

  const existing = await JoiningFee.findOne({
    sourceType: 'expense_share_payment',
    sourceExpenseId,
    sourceMemberId,
  });

  if (!existing) {
    await JoiningFee.create({
      memberId: sourceMemberId,
      receivedBy: receiverId,
      amount: normalizedAmount,
      remainingAmount: normalizedAmount,
      status: normalizeAdvanceStatus(normalizedAmount, normalizedAmount),
      date: expenseMeta.date ? new Date(expenseMeta.date) : new Date(),
      note: buildNote({
        _id: sourceExpenseId,
        description: expenseMeta.description,
        date: expenseMeta.date,
        category: expenseMeta.category,
      }),
      sourceType: 'expense_share_payment',
      sourceExpenseId,
      sourceMemberId,
    });
    return;
  }

  const previousAmount = round2(Number(existing.amount || 0));
  const previousRemaining = round2(Number((existing as any).remainingAmount ?? previousAmount));
  const usedAmount = round2(Math.max(0, previousAmount - previousRemaining));
  const nextRemaining = round2(Math.max(0, normalizedAmount - usedAmount));

  existing.memberId = sourceMemberId;
  existing.receivedBy = receiverId;
  existing.amount = normalizedAmount;
  existing.remainingAmount = nextRemaining;
  existing.status = normalizeAdvanceStatus(normalizedAmount, nextRemaining);
  existing.date = expenseMeta.date ? new Date(expenseMeta.date) : existing.date;
  existing.note = buildNote({
    _id: sourceExpenseId,
    description: expenseMeta.description,
    date: expenseMeta.date,
    category: expenseMeta.category,
  });
  (existing as any).sourceType = 'expense_share_payment';
  (existing as any).sourceExpenseId = sourceExpenseId;
  (existing as any).sourceMemberId = sourceMemberId;
  await existing.save();
};

export const removeExpenseShareAdvanceCredit = async ({
  memberId,
  expenseId,
}: {
  memberId: string | mongoose.Types.ObjectId;
  expenseId: string | mongoose.Types.ObjectId;
}) => {
  const sourceExpenseId = toObjectId(expenseId);
  const sourceMemberId = toObjectId(memberId);

  const existing = await JoiningFee.findOne({
    sourceType: 'expense_share_payment',
    sourceExpenseId,
    sourceMemberId,
  });

  if (!existing) return;

  const totalAmount = round2(Number(existing.amount || 0));
  const remainingAmount = round2(Number((existing as any).remainingAmount ?? totalAmount));
  const usedAmount = round2(Math.max(0, totalAmount - remainingAmount));

  if (usedAmount > 0.01) {
    throw new Error(
      'Cannot mark unpaid because this payment credit is already used in advance deductions.'
    );
  }

  await existing.deleteOne();
};
