import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

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

