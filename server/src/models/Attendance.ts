import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendance extends Document {
  date: Date;
  memberId: mongoose.Types.ObjectId;
  isPresent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member ID is required'],
    },
    isPresent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
attendanceSchema.index({ date: 1, memberId: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);

