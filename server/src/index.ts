import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import bookingRoutes from './routes/bookings.js';
import attendanceRoutes from './routes/attendance.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  https://ubismashers.vercel.app,
  // Add Vercel domains dynamically
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  // Allow any Vercel preview deployments
  ...(process.env.VERCEL ? [/^https:\/\/.*\.vercel\.app$/] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches Vercel pattern
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      // In production, be more strict; in development, allow all
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Court Cost Connect API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize admin account
const initializeAdmin = async () => {
  try {
    const { User } = await import('./models/User.js');
    const { Member } = await import('./models/Member.js');
    
    const ADMIN_EMAIL = 'ubismashers0@gmail.com';
    const ADMIN_PASSWORD = 'Mani2495';
    
    // Check if admin user exists
    let adminUser = await User.findOne({ email: ADMIN_EMAIL });
    
    if (!adminUser) {
      // Create admin user
      adminUser = await User.create({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        mustChangePassword: false,
      });
      
      console.log('✅ Admin user created');
    } else {
      // Ensure admin account has correct role
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
      }
    }
    
    // Check if admin member exists
    let adminMember = await Member.findOne({ email: ADMIN_EMAIL });
    
    if (!adminMember) {
      // Create admin member profile
      adminMember = await Member.create({
        name: 'Admin',
        email: ADMIN_EMAIL,
        phone: '0000000000',
        role: 'admin',
        status: 'active',
        userId: adminUser._id,
      });
      
      console.log('✅ Admin member profile created');
    } else {
      // Ensure admin member has correct role and is linked to user
      if (adminMember.role !== 'admin') {
        adminMember.role = 'admin';
      }
      if (!adminMember.userId || adminMember.userId.toString() !== adminUser._id.toString()) {
        adminMember.userId = adminUser._id;
      }
      if (adminMember.status !== 'active') {
        adminMember.status = 'active';
      }
      await adminMember.save();
    }
    
    // Ensure user is linked to member
    if (!adminUser.memberId || adminUser.memberId.toString() !== adminMember._id.toString()) {
      adminUser.memberId = adminMember._id;
      await adminUser.save();
    }
    
    console.log('✅ Admin account verified and ready');
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
};

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    await initializeAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

