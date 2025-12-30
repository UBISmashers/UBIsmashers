import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  date: Date;
  category: 'court' | 'equipment' | 'refreshments' | 'other';
  description: string;
  amount: number;
  paidBy: mongoose.Types.ObjectId;
  presentMembers: number; // Keep for backward compatibility
  selectedMembers: mongoose.Types.ObjectId[]; // Array of member IDs who share the expense
  perMemberShare: number;
  status: 'pending' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    category: {
      type: String,
      enum: ['court', 'equipment', 'refreshments', 'other'],
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Paid by member is required'],
    },
    presentMembers: {
      type: Number,
      required: [true, 'Number of present members is required'],
      min: [1, 'At least one member must be present'],
    },
    selectedMembers: {
      type: [Schema.Types.ObjectId],
      ref: 'Member',
      default: [],
    },
    perMemberShare: {
      type: Number,
      required: [true, 'Per member share is required'],
      min: [0, 'Per member share must be positive'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);

