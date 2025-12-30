import mongoose, { Document, Schema } from 'mongoose';

export interface IMember extends Document {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  joinDate: Date;
  balance: number;
  attendanceRate: number;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<IMember>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    balance: {
      type: Number,
      default: 0,
    },
    attendanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Member = mongoose.model<IMember>('Member', memberSchema);

