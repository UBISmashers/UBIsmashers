import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();
router.use(authenticate, authorize('admin'));

// Get all notifications for the current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user?.id })
      .populate('memberId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    const unreadCount = await Notification.countDocuments({
      userId: req.user?.id,
      read: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user?.id,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify ownership
    if (notification.userId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    await Notification.updateMany(
      { userId: req.user?.id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify ownership
    if (notification.userId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await notification.deleteOne();

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

