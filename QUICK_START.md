# Quick Start Guide

## ✅ What's Done
- ✅ Backend dependencies installed
- ✅ Frontend dependencies installed
- ✅ Environment variables configured (.env file)

## 🚀 Next Steps

### 1. Make Sure MongoDB is Running

**If using local MongoDB:**
```powershell
# Check if MongoDB is running
Get-Service MongoDB

# If not running, start it
net start MongoDB
```

**If using MongoDB Atlas:**
- Your connection string should be in `.env` file
- Make sure it's accessible from your network

### 2. Start the Backend Server

Open a terminal and run:
```powershell
cd server
npm run dev
```

**Expected output:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📡 API available at http://localhost:5000/api
```

**If you see connection errors:**
- Check MongoDB is running
- Verify `MONGODB_URI` in `server/.env` is correct

### 3. Start the Frontend (New Terminal)

Open a **NEW terminal window** and run:
```powershell
cd court-cost-connect
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:8080/
```

### 4. Open the Application

1. Open your browser
2. Go to: **http://localhost:8080**
3. You'll see the login page
4. Click **"Sign up"** to create your first account
5. Choose **"Admin"** role for full access
6. Fill in your details and create account

### 5. You're Ready! 🎉

Once logged in, you can:
- ✅ View and manage members
- ✅ Create court bookings
- ✅ Track attendance
- ✅ Manage expenses
- ✅ Generate reports

## 🆘 Troubleshooting

**Backend won't start?**
- Check MongoDB is running
- Verify `.env` file exists in `server/` directory
- Check port 5000 is not in use

**Frontend can't connect to API?**
- Make sure backend is running first
- Check backend is on port 5000
- Verify `VITE_API_URL` in frontend (defaults to `http://localhost:5000/api`)

**Need help?**
- See `SETUP_GUIDE.md` for detailed instructions
- Check `server/README.md` for API documentation

