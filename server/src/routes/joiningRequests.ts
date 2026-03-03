import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { JoiningRequest } from '../models/JoiningRequest.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Member } from '../models/Member.js';

const router = express.Router();

const createJoiningRequestSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  mobileNumber: z
    .string()
    .trim()
    .min(8, 'Mobile number is required')
    .max(20, 'Mobile number is too long'),
  address: z.string().trim().min(5, 'Address is required'),
  availability: z.enum(['weekly_twice', 'only_weekends', 'weekdays_only', 'flexible']),
});

const updateStatusSchema = z.object({
  status: z.enum(['new', 'reviewed']),
});

// Public endpoint: submit joining request
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = createJoiningRequestSchema.parse(req.body);

    const joiningRequest = await JoiningRequest.create(payload);

    // Notify all admin users (best-effort, does not block success)
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    if (adminUsers.length > 0) {
      const memberName = payload.name;
      const message = `${memberName} submitted a new joining request.`;
      await Notification.insertMany(
        adminUsers.map((admin) => ({
          userId: admin._id,
          type: 'joining_request',
          title: 'New Joining Request',
          message,
          data: {
            memberName,
            joiningRequestId: joiningRequest._id.toString(),
          },
        }))
      );
    }

    return res.status(201).json({
      message: 'Joining request submitted successfully',
      request: joiningRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create joining request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints
router.use(authenticate, authorize('admin'));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const requests = await JoiningRequest.find().sort({ createdAt: -1 });
    return res.json(requests);
  } catch (error) {
    console.error('Get joining requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);

    const request = await JoiningRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Joining request not found' });
    }

    request.status = status;
    await request.save();

    return res.json({
      message: 'Joining request updated successfully',
      request,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update joining request status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

