import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  type: 'payment_submitted' | 'payment_approval_request' | 'payment_approved' | 'payment_rejected' | 'expense_added';
  title: string;
  message: string;
  data?: {
    expenseId?: string;
    memberId?: string;
    amount?: number;
    memberName?: string;
  };
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    type: {
      type: String,
      enum: ['payment_submitted', 'payment_approval_request', 'payment_approved', 'payment_rejected', 'expense_added'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

