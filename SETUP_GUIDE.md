# Setup Guide - Court Cost Connect

Follow these steps to get your application up and running.

## Step 1: Verify MongoDB is Running

### Option A: Local MongoDB
Make sure MongoDB is installed and running on your system:

**Windows:**
```powershell
# Check if MongoDB service is running
Get-Service MongoDB

# If not running, start it
net start MongoDB
```

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
# or
sudo service mongod start
```

### Option B: MongoDB Atlas (Cloud)
If you're using MongoDB Atlas, make sure your connection string in `.env` is correct:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/court-cost-connect
```

## Step 2: Install Dependencies

### Install Backend Dependencies
Open a terminal in the `server` directory:

```bash
cd server
npm install
```

### Install Frontend Dependencies
Open a new terminal in the root directory:

```bash
cd court-cost-connect
npm install
```

## Step 3: Verify Environment Variables

Check that your `server/.env` file has all required variables:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/court-cost-connect
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

**Important:** Make sure `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong, random strings!

## Step 4: Start the Backend Server

In the `server` directory terminal:

```bash
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📡 API available at http://localhost:5000/api
```

**If you see connection errors:**
- Check MongoDB is running (Step 1)
- Verify `MONGODB_URI` in `.env` is correct
- Make sure the database name in the URI matches your setup

## Step 5: Start the Frontend

Open a **new terminal** in the root `court-cost-connect` directory:

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

## Step 6: Test the Application

1. **Open your browser** and go to: `http://localhost:8080`

2. **Create your first account:**
   - Click "Sign up" or navigate to `/signup`
   - Fill in your details:
     - Name
     - Email
     - Phone
     - Password (at least 6 characters)
     - Role: Choose "Admin" for full access
   - Click "Sign Up"

3. **You should be automatically logged in** and redirected to the dashboard

4. **Test the features:**
   - Navigate to "Members" - you should see your profile
   - Try creating a booking
   - Check attendance tracking
   - View expenses (as admin, you can create expenses)

## Troubleshooting

### Backend won't start

**Error: "MongoDB connection error"**
- Make sure MongoDB is running
- Check your `MONGODB_URI` in `.env`
- Try connecting with MongoDB Compass or `mongosh` to verify connection

**Error: "Cannot find module"**
- Run `npm install` in the `server` directory
- Make sure all dependencies are installed

**Error: "Port 5000 already in use"**
- Change `PORT` in `.env` to a different port (e.g., 5001)
- Or stop the process using port 5000

### Frontend won't start

**Error: "Port 8080 already in use"**
- The frontend will automatically try the next available port
- Or change the port in `vite.config.ts`

**Error: "Cannot connect to API"**
- Make sure the backend is running
- Check `VITE_API_URL` in frontend `.env` (if you created one)
- Default is `http://localhost:5000/api`

### Authentication Issues

**"Invalid email or password"**
- Make sure you're using the correct email/password
- Try creating a new account

**"Token expired"**
- The app should automatically refresh tokens
- If issues persist, clear browser localStorage and login again

## Quick Commands Reference

```bash
# Backend
cd server
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server

# Frontend
cd court-cost-connect
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Next Steps

Once everything is running:

1. **Create your first admin account** (if you haven't already)
2. **Add members** through the Members page (Admin only)
3. **Create bookings** for court time slots
4. **Record attendance** for sessions
5. **Add expenses** and track member shares
6. **Generate reports** to analyze data

Enjoy using Court Cost Connect! 🎾

