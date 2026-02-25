import express, { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { Expense } from '../models/Expense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Member } from '../models/Member.js';

const router = express.Router();
router.use(authenticate);

const equipmentSchema = z.object({
  date: z.string().or(z.date()),
  itemName: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  quantityPurchased: z.number().min(1, 'Quantity must be at least 1'),
  quantityUsed: z.number().min(0).optional(),
  selectedMembers: z.array(z.string()).min(1, 'At least one member must be selected'),
  status: z.enum(['pending', 'completed']).optional(),
});

const usageSchema = z.object({
  quantityUsed: z.number().min(0, 'Quantity must be positive'),
});

// Get equipment purchases (inventory)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const equipment = await Expense.find({ isInventory: true })
      .populate('paidBy', 'name email')
      .populate('selectedMembers', 'name email')
      .sort({ date: -1 });

    return res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment purchase
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = equipmentSchema.parse(req.body);

    const expenseDate = new Date(validatedData.date);
    expenseDate.setHours(0, 0, 0, 0);

    const member = await Member.findOne({ userId: req.user?.id });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    const selectedMemberIds = validatedData.selectedMembers.map((id: string) => new mongoose.Types.ObjectId(id));
    const memberCount = selectedMemberIds.length;
    const perMemberShare = validatedData.amount / memberCount;

    const equipment = await Expense.create({
      date: expenseDate,
      category: 'equipment',
      description: validatedData.description || validatedData.itemName,
      amount: validatedData.amount,
      paidBy: member._id,
      presentMembers: memberCount,
      selectedMembers: selectedMemberIds,
      perMemberShare,
      status: validatedData.status || 'pending',
      isInventory: true,
      itemName: validatedData.itemName,
      quantityPurchased: validatedData.quantityPurchased,
      quantityUsed: validatedData.quantityUsed || 0,
    });

    await Promise.all(
      selectedMemberIds.map(async (memberId) => {
        if (memberId.toString() === member._id.toString()) {
          return null;
        }
        return ExpenseShare.create({
          expenseId: equipment._id,
          memberId,
          amount: perMemberShare,
          paidStatus: false,
        });
      })
    );

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

    await equipment.populate('paidBy', 'name email');
    await equipment.populate('selectedMembers', 'name email');

    return res.status(201).json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment usage (Admin only)
router.patch('/:id/usage', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = usageSchema.parse(req.body);

    const equipment = await Expense.findById(req.params.id);
    if (!equipment || !equipment.isInventory) {
      return res.status(404).json({ error: 'Equipment purchase not found' });
    }

    const purchased = equipment.quantityPurchased || 0;
    if (validatedData.quantityUsed > purchased) {
      return res.status(400).json({ error: 'Used quantity cannot exceed purchased quantity' });
    }

    equipment.quantityUsed = validatedData.quantityUsed;
    await equipment.save();

    await equipment.populate('paidBy', 'name email');
    await equipment.populate('selectedMembers', 'name email');

    return res.json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update equipment usage error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment purchase (Admin only)
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const equipment = await Expense.findOneAndDelete({ _id: req.params.id, isInventory: true });
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment purchase not found' });
    }

    return res.json({ message: 'Equipment purchase deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
