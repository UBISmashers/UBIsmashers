import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { Booking } from '../models/Booking.js';

const router = express.Router();

const bookingSchema = z.object({
  date: z.string().or(z.date()),
  time: z.string().min(1, 'Time is required'),
  court: z.string().min(1, 'Court is required'),
  status: z.enum(['available', 'booked', 'pending', 'cancelled']).optional(),
  players: z.number().min(0).optional(),
});

// Get bookings (filtered by date, or all for admin)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { date, startDate, endDate } = req.query;

    let query: any = {};

    if (date) {
      const dateObj = new Date(date as string);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: dateObj, $lt: nextDay };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Members can only see their own bookings unless admin
    if (req.user?.role !== 'admin') {
      const { Member } = await import('../models/Member.js');
      const member = await Member.findOne({ userId: req.user?.id });
      if (member) {
        query.bookedBy = member._id;
      } else {
        return res.json([]);
      }
    }

    const bookings = await Booking.find(query)
      .populate('bookedBy', 'name email')
      .sort({ date: 1, time: 1 });

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single booking
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Members can only view their own bookings unless admin
    if (req.user?.role !== 'admin') {
      const { Member } = await import('../models/Member.js');
      const member = await Member.findOne({ userId: req.user?.id });
      if (!member || booking.bookedBy?.toString() !== member._id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create booking
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const validatedData = bookingSchema.parse(req.body);
    
    const bookingDate = new Date(validatedData.date);
    bookingDate.setHours(0, 0, 0, 0);

    // Get member ID from user
    const { Member } = await import('../models/Member.js');
    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    // Check if slot is already booked
    const existingBooking = await Booking.findOne({
      date: bookingDate,
      time: validatedData.time,
      court: validatedData.court,
      status: { $in: ['booked', 'pending'] },
    });

    if (existingBooking) {
      return res.status(400).json({ error: 'This time slot is already booked' });
    }

    const booking = await Booking.create({
      ...validatedData,
      date: bookingDate,
      bookedBy: member._id,
      status: validatedData.status || 'booked',
    });

    await booking.populate('bookedBy', 'name email');

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Members can only update their own bookings unless admin
    if (req.user?.role !== 'admin') {
      const { Member } = await import('../models/Member.js');
      const member = await Member.findOne({ userId: req.user?.id });
      if (!member || booking.bookedBy?.toString() !== member._id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const validatedData = bookingSchema.partial().parse(req.body);
    
    if (validatedData.date) {
      validatedData.date = new Date(validatedData.date);
    }

    Object.assign(booking, validatedData);
    await booking.save();
    await booking.populate('bookedBy', 'name email');

    res.json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete booking
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Members can only delete their own bookings unless admin
    if (req.user?.role !== 'admin') {
      const { Member } = await import('../models/Member.js');
      const member = await Member.findOne({ userId: req.user?.id });
      if (!member || booking.bookedBy?.toString() !== member._id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

