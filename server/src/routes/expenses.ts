import express, { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { Expense } from '../models/Expense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const expenseSchema = z.object({
  date: z.string().or(z.date()),
  category: z.enum(['court', 'equipment', 'refreshments', 'other']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  presentMembers: z.number().min(1, 'At least one member must be present').optional(),
  selectedMembers: z.array(z.string()).min(1, 'At least one member must be selected').optional(),
  status: z.enum(['pending', 'completed']).optional(),
});

// Get expenses
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, status } = req.query;

    let query: any = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    // Members can see all expenses (for transparency)
    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single expense
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email');
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create expense (Admin only)
router.post('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = expenseSchema.parse(req.body);
    
    const expenseDate = new Date(validatedData.date);
    expenseDate.setHours(0, 0, 0, 0);

    // Get member ID from user
    const { Member } = await import('../models/Member.js');
    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    // Use selectedMembers if provided, otherwise use presentMembers count
    let memberCount: number;
    let selectedMemberIds: mongoose.Types.ObjectId[] = [];

    if (validatedData.selectedMembers && validatedData.selectedMembers.length > 0) {
      // Convert string IDs to ObjectIds
      selectedMemberIds = validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id));
      memberCount = selectedMemberIds.length;
    } else if (validatedData.presentMembers) {
      memberCount = validatedData.presentMembers;
    } else {
      return res.status(400).json({ error: 'Either selectedMembers or presentMembers must be provided' });
    }

    const perMemberShare = validatedData.amount / memberCount;

    const expense = await Expense.create({
      ...validatedData,
      date: expenseDate,
      paidBy: member._id,
      presentMembers: memberCount,
      selectedMembers: selectedMemberIds,
      perMemberShare,
      status: validatedData.status || 'pending',
    });

    // Create expense shares for each selected member
    const expenseShares = await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        // Don't create share for the person who paid (they already paid)
        if (memberId.toString() === member._id.toString()) {
          return null;
        }
        return ExpenseShare.create({
          expenseId: expense._id,
          memberId: memberId,
          amount: perMemberShare,
          paidStatus: false,
        });
      })
    );

    // Update member balances (add debt for each member except the payer)
    await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        if (memberId.toString() !== member._id.toString()) {
          const shareMember = await Member.findById(memberId);
          if (shareMember) {
            shareMember.balance = (shareMember.balance || 0) + perMemberShare;
            await shareMember.save();
          }
        }
      })
    );

    await expense.populate('paidBy', 'name email');
    await expense.populate('selectedMembers', 'name email');

    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update expense (Admin only)
router.put('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const validatedData = expenseSchema.partial().parse(req.body);
    
    // Convert date to Date object if provided
    let expenseDate: Date | undefined;
    if (validatedData.date) {
      expenseDate = validatedData.date instanceof Date 
        ? validatedData.date 
        : new Date(validatedData.date);
    }

    // Recalculate per member share if amount, presentMembers, or selectedMembers changed
    if (validatedData.amount !== undefined || validatedData.presentMembers !== undefined || validatedData.selectedMembers !== undefined) {
      const amount = validatedData.amount ?? expense.amount;
      let memberCount: number;
      let selectedMemberIds: mongoose.Types.ObjectId[] = [];
      
      if (validatedData.selectedMembers && validatedData.selectedMembers.length > 0) {
        selectedMemberIds = validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id));
        memberCount = selectedMemberIds.length;
      } else if (validatedData.presentMembers !== undefined) {
        memberCount = validatedData.presentMembers;
      } else {
        memberCount = expense.selectedMembers?.length || expense.presentMembers;
      }
      
      // Update expense fields
      if (validatedData.amount !== undefined) expense.amount = validatedData.amount;
      if (validatedData.presentMembers !== undefined) expense.presentMembers = memberCount;
      if (selectedMemberIds.length > 0) expense.selectedMembers = selectedMemberIds;
      expense.perMemberShare = amount / memberCount;
    }

    // Update other fields
    if (expenseDate) {
      expense.date = expenseDate;
    }
    if (validatedData.category) expense.category = validatedData.category;
    if (validatedData.description) expense.description = validatedData.description;
    if (validatedData.status) expense.status = validatedData.status;
    await expense.save();
    await expense.populate('paidBy', 'name email');

    res.json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense (Admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

