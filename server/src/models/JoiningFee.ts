import mongoose, { Document, Schema } from 'mongoose';

export interface IJoiningFee extends Document {
  memberId: mongoose.Types.ObjectId;
  receivedBy: mongoose.Types.ObjectId;
  amount: number; // Total advance paid
  remainingAmount: number;
  status: 'available' | 'partially_used' | 'fully_used';
  sourceType?: 'expense_share_payment';
  sourceExpenseId?: mongoose.Types.ObjectId;
  sourceMemberId?: mongoose.Types.ObjectId;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const joiningFeeSchema = new Schema<IJoiningFee>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member is required'],
      index: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Received by member is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    remainingAmount: {
      type: Number,
      required: [true, 'Remaining amount is required'],
      min: [0, 'Remaining amount must be non-negative'],
    },
    status: {
      type: String,
      enum: ['available', 'partially_used', 'fully_used'],
      default: 'available',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['expense_share_payment'],
      index: true,
      default: undefined,
    },
    sourceExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
      index: true,
      default: undefined,
    },
    sourceMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
      default: undefined,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

joiningFeeSchema.index(
  { sourceType: 1, sourceExpenseId: 1, sourceMemberId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceType: 'expense_share_payment' },
  }
);

export const JoiningFee = mongoose.model<IJoiningFee>('JoiningFee', joiningFeeSchema);
