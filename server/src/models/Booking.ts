import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  date: Date;
  time: string;
  court: string;
  status: 'available' | 'booked' | 'pending' | 'cancelled';
  bookedBy: mongoose.Types.ObjectId;
  players: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
    },
    court: {
      type: String,
      required: [true, 'Court is required'],
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'pending', 'cancelled'],
      default: 'available',
    },
    bookedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: function (this: IBooking) {
        return this.status !== 'available';
      },
    },
    players: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
bookingSchema.index({ date: 1, time: 1, court: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

