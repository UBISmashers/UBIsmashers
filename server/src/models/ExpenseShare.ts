import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseShare extends Document {
  expenseId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  amount: number; // Share amount for this member
  paidStatus: boolean; // Whether the member has paid
  paidAt?: Date; // When payment was marked as paid
  createdAt: Date;
  updatedAt: Date;
}

const expenseShareSchema = new Schema<IExpenseShare>(
  {
    expenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
      required: [true, 'Expense ID is required'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    paidStatus: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one share per member per expense
expenseShareSchema.index({ expenseId: 1, memberId: 1 }, { unique: true });

export const ExpenseShare = mongoose.model<IExpenseShare>('ExpenseShare', expenseShareSchema);

