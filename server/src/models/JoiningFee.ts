import mongoose, { Document, Schema } from 'mongoose';

export interface IJoiningFee extends Document {
  memberId: mongoose.Types.ObjectId;
  receivedBy: mongoose.Types.ObjectId;
  amount: number;
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

export const JoiningFee = mongoose.model<IJoiningFee>('JoiningFee', joiningFeeSchema);
