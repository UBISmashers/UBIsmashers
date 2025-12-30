import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  temporaryPassword: z.string().min(6, 'Temporary password must be at least 6 characters'),
  role: z.enum(['admin', 'member']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Get all members (Admin only, or members can see their own)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'admin') {
      const members = await Member.find().sort({ createdAt: -1 });
      res.json(members);
    } else {
      // Members can only see their own profile
      const member = await Member.findOne({ userId: req.user?.id });
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      res.json([member]);
    }
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single member
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Members can only view their own profile unless admin
    if (req.user?.role !== 'admin' && member.userId?.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(member);
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create member (Admin only)
router.post('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const validatedData = memberSchema.parse(req.body);
    
    // Enforce role: Only one admin account allowed (ubismashers0@gmail.com)
    // All other users must be members
    const ADMIN_EMAIL = 'ubismashers0@gmail.com';
    const role = validatedData.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'member';
    
    // Check if trying to create another admin
    if (validatedData.role === 'admin' && validatedData.email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ 
        error: 'Only one admin account is allowed. Admin email must be ubismashers0@gmail.com' 
      });
    }

    // Check if user already exists
    const { User } = await import('../models/User.js');
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    const existingMember = await Member.findOne({ email: validatedData.email });
    if (existingMember) {
      return res.status(400).json({ error: 'Member already exists with this email' });
    }

    // Create user account with temporary password
    const user = await User.create({
      email: validatedData.email,
      password: validatedData.temporaryPassword,
      role: role,
      mustChangePassword: role === 'member', // Members must change password on first login
    });

    // Create member profile
    const member = await Member.create({
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: role,
      status: validatedData.status || 'active',
      userId: user._id,
    });

    // Link user to member
    user.memberId = member._id;
    await user.save();

    res.status(201).json({
      ...member.toObject(),
      temporaryPassword: validatedData.temporaryPassword, // Return for admin to share
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Members can only update their own profile unless admin
    if (req.user?.role !== 'admin' && member.userId?.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const validatedData = memberSchema.partial().parse(req.body);
    Object.assign(member, validatedData);
    await member.save();

    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete member (Admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

