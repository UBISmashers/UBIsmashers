import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { Member } from '../models/Member.js';
import { JoiningFee } from '../models/JoiningFee.js';

const router = express.Router();

const optionalString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  },
  z.string().optional()
);

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: optionalString.refine((value) => !value || /^\S+@\S+\.\S+$/.test(value), {
    message: 'Invalid email address',
  }),
  phone: optionalString,
  status: z.enum(['active', 'inactive']).optional(),
  hiddenFromPublicBills: z.boolean().optional(),
  joiningFeeAmount: z.number().min(0).optional(),
  joiningFeeNote: z.string().optional(),
});

const deleteMemberSchema = z.object({
  subtractAdvanceFromTotals: z.boolean().optional(),
});

router.use(authenticate, authorize('admin'));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const members = await Member.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    return res.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    return res.json(member);
  } catch (error) {
    console.error('Get member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = memberSchema.parse(req.body);

    if (validatedData.email) {
      const existingMember = await Member.findOne({
        email: validatedData.email,
        isDeleted: { $ne: true },
      });
      if (existingMember) {
        return res.status(400).json({ error: 'Member already exists with this email' });
      }
    }

    const memberPayload: any = {
      name: validatedData.name,
      role: 'member',
      status: validatedData.status || 'active',
      hiddenFromPublicBills: false,
      userId: null,
    };
    if (validatedData.email) memberPayload.email = validatedData.email;
    if (validatedData.phone) memberPayload.phone = validatedData.phone;

    const member = await Member.create(memberPayload);

    if (validatedData.joiningFeeAmount && validatedData.joiningFeeAmount > 0) {
      const { JoiningFee } = await import('../models/JoiningFee.js');
      const receivedBy = await Member.findOne({ userId: req.user?.id });
      if (receivedBy) {
        await JoiningFee.create({
          memberId: member._id,
          receivedBy: receivedBy._id,
          amount: validatedData.joiningFeeAmount,
          remainingAmount: validatedData.joiningFeeAmount,
          status: 'available',
          date: new Date(),
          note: validatedData.joiningFeeNote,
        });
      }
    }

    return res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const validatedData = memberSchema.partial().parse(req.body);
    Object.assign(member, validatedData);
    await member.save();

    return res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'admin') {
      return res.status(403).json({ error: 'Admin member cannot be deleted' });
    }

    if (member.isDeleted) {
      return res.status(400).json({ error: 'Member is already deleted' });
    }

    const validatedDeleteData = deleteMemberSchema.parse(req.body || {});
    const subtractAdvanceFromTotals = Boolean(validatedDeleteData.subtractAdvanceFromTotals);

    const currentName = member.name || 'Member';
    const deletedSuffix = '(deleted member)';
    const nextName = currentName.toLowerCase().includes(deletedSuffix)
      ? currentName
      : `${currentName} ${deletedSuffix}`;

    member.name = nextName;
    member.status = 'inactive';
    member.hiddenFromPublicBills = true;
    member.isDeleted = true;
    member.deletedAt = new Date();
    member.userId = null as any;
    member.email = undefined;
    member.phone = undefined;
    await member.save();

    if (subtractAdvanceFromTotals) {
      await JoiningFee.updateMany(
        { memberId: member._id },
        {
          $set: {
            excludeFromAdvanceTotals: true,
          },
        }
      );
    }

    return res.json({
      message: 'Member deleted successfully',
      subtractAdvanceFromTotals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Delete member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
