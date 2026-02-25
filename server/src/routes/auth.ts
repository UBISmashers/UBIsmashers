import express, { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Member } from '../models/Member.js';
import { generateAccessToken } from '../utils/jwt.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/signup', async (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Signup is disabled. Only the administrator account can log in.',
  });
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email }).select('+password');
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: 'admin',
    });

    const member = await Member.findOne({ userId: user._id });

    return res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: 'admin',
        memberId: member?._id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (_req: Request, res: Response) => {
  return res.json({ message: 'Logout successful' });
});

export default router;
