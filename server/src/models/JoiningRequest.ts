import mongoose, { Document, Schema } from 'mongoose';

export type AvailabilityOption =
  | 'weekly_twice'
  | 'only_weekends'
  | 'weekdays_only'
  | 'flexible';

export interface IJoiningRequest extends Document {
  name: string;
  email?: string;
  mobileNumber: string;
  address: string;
  availability: AvailabilityOption;
  status: 'new' | 'reviewed' | 'pending' | 'approved' | 'rejected';
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value: string) => {
          if (!value) return true;
          return /^\S+@\S+\.\S+$/.test(value);
        },
        message: 'Please provide a valid email',
      },
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
      enum: ['new', 'reviewed', 'pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

joiningRequestSchema.index({ createdAt: -1 });

export const JoiningRequest = mongoose.model<IJoiningRequest>('JoiningRequest', joiningRequestSchema);
