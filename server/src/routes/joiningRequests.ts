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
  email: z.string().trim().email('Valid email is required'),
  mobileNumber: z
    .string()
    .trim()
    .min(8, 'Mobile number is required')
    .max(20, 'Mobile number is too long'),
  address: z.string().trim().min(5, 'Address is required'),
  availability: z.enum(['weekly_twice', 'only_weekends', 'weekdays_only', 'flexible']),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

const normalizeStatus = (status: string) => {
  if (status === 'new') return 'pending';
  if (status === 'reviewed') return 'approved';
  return status;
};

const statusQueryMap: Record<string, any> = {
  pending: { status: { $in: ['pending', 'new'] } },
  approved: { status: { $in: ['approved', 'reviewed'] } },
  rejected: { status: 'rejected' },
};

const serializeRequest = (request: any) => ({
  ...request.toObject(),
  status: normalizeStatus(request.status),
  phoneNumber: request.mobileNumber,
});

// Public endpoint: submit joining request
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = createJoiningRequestSchema.parse(req.body);

    const existingPendingRequest = await JoiningRequest.findOne({
      status: { $in: ['pending', 'new'] },
      $or: [{ email: payload.email }, { mobileNumber: payload.mobileNumber }],
    });

    if (existingPendingRequest) {
      return res.status(409).json({
        error: 'A pending joining request already exists for this email or mobile number',
      });
    }

    const existingMember = await Member.findOne({
      isDeleted: { $ne: true },
      $or: [{ email: payload.email }, { phone: payload.mobileNumber }],
    });

    if (existingMember) {
      return res.status(409).json({
        error: 'A member already exists with this email or mobile number',
      });
    }

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
      request: serializeRequest(joiningRequest),
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

router.get('/', async (req: Request, res: Response) => {
  try {
    const requestedStatus = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const query = requestedStatus === 'all' ? {} : statusQueryMap[requestedStatus] || statusQueryMap.pending;
    const requests = await JoiningRequest.find(query).sort({ createdAt: -1 });
    return res.json(requests.map(serializeRequest));
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

    const currentStatus = normalizeStatus(request.status);
    if (currentStatus !== 'pending') {
      return res.status(409).json({ error: `Joining request is already ${currentStatus}` });
    }

    request.status = status;

    let member = null;
    if (status === 'approved') {
      const duplicateConditions = [];
      if (request.email) duplicateConditions.push({ email: request.email });
      if (request.mobileNumber) duplicateConditions.push({ phone: request.mobileNumber });

      member = duplicateConditions.length
        ? await Member.findOne({
            isDeleted: { $ne: true },
            $or: duplicateConditions,
          })
        : null;

      if (member) {
        return res.status(409).json({
          error: 'A member already exists with this email or mobile number',
        });
      }

      member = await Member.create({
        name: request.name,
        email: request.email,
        phone: request.mobileNumber,
        role: 'member',
        status: 'active',
        hiddenFromPublicBills: false,
        userId: null,
      });
    }

    await request.save();

    return res.json({
      message: 'Joining request updated successfully',
      request: serializeRequest(request),
      member,
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
