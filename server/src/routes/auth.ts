import express, { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Member } from '../models/Member.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const router = express.Router();

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.enum(['admin', 'member']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Sign up - DISABLED: Only admin can create members
router.post('/signup', async (req: Request, res: Response) => {
  return res.status(403).json({ 
    error: 'Signup is disabled. Please contact an administrator to create your account.' 
  });
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    // Find user and include password
    const user = await User.findOne({ email: validatedData.email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if password change is required (first login for members)
    if (user.mustChangePassword && user.role === 'member') {
      return res.status(200).json({
        message: 'Password change required',
        mustChangePassword: true,
        userId: user._id.toString(),
      });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Get member info
    const member = await Member.findOne({ userId: user._id });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      mustChangePassword: false,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        memberId: member?._id,
      },
      member: member ? {
        id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        status: member.status,
        balance: member.balance,
      } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and verify refresh token matches
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Change password (for first login)
const changePasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const validatedData = changePasswordSchema.parse(req.body);

    // Find user and include password
    const user = await User.findById(validatedData.userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(validatedData.currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = validatedData.newPassword;
    user.mustChangePassword = false; // Clear the flag
    await user.save();

    // Generate tokens for automatic login after password change
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Get member info
    const member = await Member.findOne({ userId: user._id });

    res.json({
      message: 'Password changed successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        memberId: member?._id,
      },
      member: member ? {
        id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        status: member.status,
        balance: member.balance,
      } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.userId);
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

