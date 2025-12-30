import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { Report } from '../models/Report.js';
import { Expense } from '../models/Expense.js';
import { Attendance } from '../models/Attendance.js';
import { Booking } from '../models/Booking.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const reportSchema = z.object({
  type: z.enum(['financial', 'attendance', 'booking', 'expense']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  period: z.object({
    start: z.string().or(z.date()),
    end: z.string().or(z.date()),
  }),
});

// Get all reports (Admin only)
router.get('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const reports = await Report.find()
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single report
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const report = await Report.findById(req.params.id).populate('generatedBy', 'name email');
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Members can view reports but admins have full access
    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate report (Admin only)
router.post('/generate', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { type, period } = req.body;

    if (!type || !period) {
      return res.status(400).json({ error: 'Type and period are required' });
    }

    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    endDate.setHours(23, 59, 59, 999);

    let data: any = {};

    switch (type) {
      case 'financial':
        const expenses = await Expense.find({
          date: { $gte: startDate, $lte: endDate },
        }).populate('paidBy', 'name email');

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalShares = expenses.reduce((sum, e) => sum + e.perMemberShare * e.presentMembers, 0);

        data = {
          totalExpenses,
          totalShares,
          expenseCount: expenses.length,
          expenses: expenses,
          byCategory: expenses.reduce((acc: any, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
          }, {}),
        };
        break;

      case 'attendance':
        const attendance = await Attendance.find({
          date: { $gte: startDate, $lte: endDate },
        }).populate('memberId', 'name email');

        const members = await Member.find({ status: 'active' });
        const attendanceByMember = members.map((member) => {
          const memberAttendance = attendance.filter(
            (a) => a.memberId?.toString() === member._id.toString() && a.isPresent
          );
          return {
            memberId: member._id,
            memberName: member.name,
            presentDays: memberAttendance.length,
            totalDays: attendance.filter(
              (a) => a.memberId?.toString() === member._id.toString()
            ).length,
            attendanceRate: memberAttendance.length > 0
              ? (memberAttendance.length / attendance.filter(
                  (a) => a.memberId?.toString() === member._id.toString()
                ).length) * 100
              : 0,
          };
        });

        data = {
          totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalPresent: attendance.filter((a) => a.isPresent).length,
          totalAbsent: attendance.filter((a) => !a.isPresent).length,
          byMember: attendanceByMember,
        };
        break;

      case 'booking':
        const bookings = await Booking.find({
          date: { $gte: startDate, $lte: endDate },
        }).populate('bookedBy', 'name email');

        data = {
          totalBookings: bookings.length,
          byCourt: bookings.reduce((acc: any, b) => {
            acc[b.court] = (acc[b.court] || 0) + 1;
            return acc;
          }, {}),
          byStatus: bookings.reduce((acc: any, b) => {
            acc[b.status] = (acc[b.status] || 0) + 1;
            return acc;
          }, {}),
          bookings: bookings,
        };
        break;

      case 'expense':
        const expenseData = await Expense.find({
          date: { $gte: startDate, $lte: endDate },
        }).populate('paidBy', 'name email');

        data = {
          expenses: expenseData,
          summary: {
            total: expenseData.reduce((sum, e) => sum + e.amount, 0),
            byCategory: expenseData.reduce((acc: any, e) => {
              acc[e.category] = (acc[e.category] || 0) + e.amount;
              return acc;
            }, {}),
            byStatus: expenseData.reduce((acc: any, e) => {
              acc[e.status] = (acc[e.status] || 0) + e.amount;
              return acc;
            }, {}),
          },
        };
        break;
    }

    // Get member ID from user
    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    const report = await Report.create({
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      description: `Generated report for ${type}`,
      data,
      generatedBy: member._id,
      period: {
        start: startDate,
        end: endDate,
      },
    });

    await report.populate('generatedBy', 'name email');

    res.status(201).json(report);
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

