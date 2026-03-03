import mongoose, { Document, Schema } from 'mongoose';

export type AvailabilityOption =
  | 'weekly_twice'
  | 'only_weekends'
  | 'weekdays_only'
  | 'flexible';

export interface IJoiningRequest extends Document {
  name: string;
  mobileNumber: string;
  address: string;
  availability: AvailabilityOption;
  status: 'new' | 'reviewed';
  createdAt: Date;
  updatedAt: Date;
}

const joiningRequestSchema = new Schema<IJoiningRequest>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    availability: {
      type: String,
      enum: ['weekly_twice', 'only_weekends', 'weekdays_only', 'flexible'],
      required: [true, 'Availability is required'],
    },
    status: {
      type: String,
      enum: ['new', 'reviewed'],
      default: 'new',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

joiningRequestSchema.index({ createdAt: -1 });

export const JoiningRequest = mongoose.model<IJoiningRequest>('JoiningRequest', joiningRequestSchema);

