import mongoose, { Document, Schema } from 'mongoose';

export interface IMember extends Document {
  name: string;
  email?: string;
  phone?: string;
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
      unique: true,
      sparse: true,
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
    phone: {
      type: String,
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

