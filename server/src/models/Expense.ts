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
  isInventory?: boolean;
  isCourtAdvanceBooking?: boolean;
  itemName?: string;
  quantityPurchased?: number;
  quantityUsed?: number;
  courtsBooked?: number;
  bookedByName?: string;
  courtBookedDate?: Date;
  courtBookingCost?: number;
  perShuttleCost?: number;
  shuttlesUsed?: number;
  reduceFromStock?: boolean;
  reduceFromAdvance?: boolean;
  advanceDeductedAmount?: number;
  advanceShortfallAmount?: number;
  advanceDeductions?: Array<{
    joiningFeeId: mongoose.Types.ObjectId;
    amount: number;
  }>;
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
    isInventory: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCourtAdvanceBooking: {
      type: Boolean,
      default: false,
      index: true,
    },
    itemName: {
      type: String,
      trim: true,
    },
    quantityPurchased: {
      type: Number,
      min: [0, 'Quantity must be positive'],
    },
    quantityUsed: {
      type: Number,
      min: [0, 'Quantity must be positive'],
      default: 0,
    },
    courtsBooked: {
      type: Number,
      min: [0, 'Courts booked must be non-negative'],
    },
    bookedByName: {
      type: String,
      trim: true,
    },
    courtBookedDate: {
      type: Date,
    },
    courtBookingCost: {
      type: Number,
      min: [0, 'Court booking cost must be positive'],
    },
    perShuttleCost: {
      type: Number,
      min: [0, 'Per shuttle cost must be positive'],
    },
    shuttlesUsed: {
      type: Number,
      min: [0, 'Shuttles used must be positive'],
    },
    reduceFromStock: {
      type: Boolean,
      default: false,
    },
    reduceFromAdvance: {
      type: Boolean,
      default: false,
    },
    advanceDeductedAmount: {
      type: Number,
      min: [0, 'Advance deducted amount must be non-negative'],
      default: 0,
    },
    advanceShortfallAmount: {
      type: Number,
      min: [0, 'Advance shortfall amount must be non-negative'],
      default: 0,
    },
    advanceDeductions: {
      type: [
        new Schema(
          {
            joiningFeeId: {
              type: Schema.Types.ObjectId,
              ref: 'JoiningFee',
              required: true,
            },
            amount: {
              type: Number,
              min: [0, 'Advance deduction amount must be non-negative'],
              required: true,
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);

