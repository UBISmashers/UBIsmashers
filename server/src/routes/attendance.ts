import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { Attendance } from '../models/Attendance.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const attendanceSchema = z.object({
  date: z.string().or(z.date()),
  memberId: z.string().optional(),
  isPresent: z.boolean(),
});

// Get attendance records
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { date, startDate, endDate, memberId } = req.query;

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

    // Members can only see their own attendance unless admin
    if (req.user?.role !== 'admin') {
      const member = await Member.findOne({ userId: req.user?.id });
      if (member) {
        query.memberId = member._id;
      } else {
        return res.json([]);
      }
    } else if (memberId) {
      query.memberId = memberId;
    }

    const attendance = await Attendance.find(query)
      .populate('memberId', 'name email')
      .sort({ date: -1 });

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update attendance (Admin only for bulk, members can mark themselves)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      // Bulk update (Admin only)
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Only admins can bulk update attendance' });
      }

      const results = [];
      for (const item of req.body) {
        const validatedData = attendanceSchema.parse(item);
        const date = new Date(validatedData.date);
        date.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOneAndUpdate(
          {
            date,
            memberId: validatedData.memberId,
          },
          {
            date,
            memberId: validatedData.memberId,
            isPresent: validatedData.isPresent,
          },
          { upsert: true, new: true }
        ).populate('memberId', 'name email');

        results.push(attendance);
      }

      res.status(201).json(results);
    } else {
      // Single update
      const validatedData = attendanceSchema.parse(req.body);
      const date = new Date(validatedData.date);
      date.setHours(0, 0, 0, 0);

      // Members can only mark their own attendance unless admin
      let memberId = validatedData.memberId;
      if (req.user?.role !== 'admin') {
        const member = await Member.findOne({ userId: req.user?.id });
        if (!member) {
          return res.status(404).json({ error: 'Member not found' });
        }
        memberId = member._id.toString();
      } else if (!memberId) {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      const attendance = await Attendance.findOneAndUpdate(
        {
          date,
          memberId,
        },
        {
          date,
          memberId,
          isPresent: validatedData.isPresent,
        },
        { upsert: true, new: true }
      ).populate('memberId', 'name email');

      res.status(201).json(attendance);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance for a specific date
router.get('/date/:date', authenticate, async (req: Request, res: Response) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const attendance = await Attendance.find({
      date: { $gte: date, $lt: nextDay },
    }).populate('memberId', 'name email');

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

