import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/court-cost-connect';
    
    // Debug: Check if env is loaded (hide password)
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not found in environment variables, using default localhost');
    } else {
      const uriForLog = mongoURI.replace(/:[^:@]+@/, ':****@'); // Hide password in logs
      console.log(`🔗 Connecting to MongoDB: ${uriForLog}`);
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('authentication failed') || error.code === 8000) {
      console.error('\n💡 Authentication failed. Please check:');
      console.error('   1. Username and password in MongoDB Atlas');
      console.error('   2. Password may need URL encoding (special characters)');
      console.error('   3. Database user exists and has proper permissions');
      console.error('   4. IP address is whitelisted in MongoDB Atlas Network Access\n');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('localhost')) {
      console.error('\n💡 Connection refused. Please check:');
      console.error('   1. MONGODB_URI is set correctly in .env file');
      console.error('   2. .env file is in the server/ directory');
      console.error('   3. MongoDB Atlas cluster is running (not paused)\n');
    }
    
    process.exit(1);
  }
};

