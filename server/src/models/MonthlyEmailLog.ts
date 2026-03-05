import mongoose, { Document, Schema } from 'mongoose';

export interface IMonthlyEmailLog extends Document {
  reportKey: string;
  recipient: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const monthlyEmailLogSchema = new Schema<IMonthlyEmailLog>(
  {
    reportKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const MonthlyEmailLog = mongoose.model<IMonthlyEmailLog>(
  'MonthlyEmailLog',
  monthlyEmailLogSchema
);

