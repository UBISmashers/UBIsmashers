import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import { Expense } from '../models/Expense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';

dotenv.config();

const toId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const withId = value as { _id: mongoose.Types.ObjectId };
    return withId._id.toString();
  }
  return String(value);
};

const run = async () => {
  const isDryRun = process.argv.includes('--dry-run');

  await connectDB();

  const shares = await ExpenseShare.find()
    .select('_id expenseId memberId amount paidStatus')
    .lean();

  if (shares.length === 0) {
    console.log('No expense shares found. Nothing to clean.');
    await mongoose.disconnect();
    return;
  }

  const expenseIds = Array.from(
    new Set(
      shares
        .map((share) => toId(share.expenseId))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  const existingExpenses = await Expense.find({
    _id: { $in: expenseIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('_id')
    .lean();

  const existingExpenseIdSet = new Set(existingExpenses.map((exp) => toId(exp._id)));

  const orphanShares = shares.filter((share) => !existingExpenseIdSet.has(toId(share.expenseId)));

  if (orphanShares.length === 0) {
    console.log('No orphan expense shares found. Data is clean.');
    await mongoose.disconnect();
    return;
  }

  const unpaidOrphans = orphanShares.filter((share) => !share.paidStatus);
  const balanceDeltaByMember = new Map<string, number>();

  unpaidOrphans.forEach((share) => {
    const memberId = toId(share.memberId);
    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) return;
    const current = balanceDeltaByMember.get(memberId) || 0;
    balanceDeltaByMember.set(memberId, current - Number(share.amount || 0));
  });

  console.log(`Found orphan shares: ${orphanShares.length}`);
  console.log(`Unpaid orphan shares affecting balances: ${unpaidOrphans.length}`);
  console.log(`Members to rebalance: ${balanceDeltaByMember.size}`);

  if (isDryRun) {
    console.log('Dry run mode enabled. No database writes were made.');
    await mongoose.disconnect();
    return;
  }

  if (balanceDeltaByMember.size > 0) {
    await Member.bulkWrite(
      Array.from(balanceDeltaByMember.entries()).map(([memberId, delta]) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(memberId) },
          update: { $inc: { balance: delta } },
        },
      }))
    );
  }

  await ExpenseShare.deleteMany({
    _id: { $in: orphanShares.map((share) => share._id) },
  });

  console.log('Cleanup complete.');
  console.log(`Deleted orphan shares: ${orphanShares.length}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Cleanup failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});

