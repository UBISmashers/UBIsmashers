# 🎉 MongoDB Connected Successfully!

Your backend server is now running and connected to MongoDB Atlas.

## ✅ Current Status

- ✅ MongoDB Atlas connected
- ✅ Backend server running on port 5000
- ✅ API available at `http://localhost:5000/api`

## 🚀 Next Steps

### Step 1: Start the Frontend

Open a **NEW terminal window** (keep the backend running) and run:

```powershell
cd court-cost-connect
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:8080/
```

### Step 2: Open the Application

1. Open your browser
2. Go to: **http://localhost:8080**
3. You'll see the login page

### Step 3: Create Your First Account

1. Click **"Sign up"** (or go to `/signup`)
2. Fill in your details:
   - **Name**: Your full name
   - **Email**: Your email address
   - **Phone**: Your phone number
   - **Password**: At least 6 characters
   - **Role**: Choose **"Admin"** for full access
3. Click **"Sign Up"**

You'll be automatically logged in and redirected to the dashboard!

### Step 4: Explore the Features

Once logged in, you can:

#### As Admin:
- ✅ **Members**: View, add, edit, and delete members
- ✅ **Bookings**: Create and manage court bookings
- ✅ **Attendance**: Record attendance for all members
- ✅ **Expenses**: Add expenses and track member shares
- ✅ **Reports**: Generate financial, attendance, and booking reports
- ✅ **Settings**: Manage your profile

#### As Member:
- ✅ View your own profile and bookings
- ✅ Create your own bookings
- ✅ Mark your own attendance
- ✅ View expenses and your share
- ✅ View reports (read-only)

## 🧪 Test the API

You can test the API endpoints directly:

### Health Check
```bash
curl http://localhost:5000/health
```

### Sign Up (example)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "phone": "+1234567890",
    "role": "member"
  }'
```

## 📚 API Documentation

See `server/README.md` for complete API documentation.

## 🎯 Quick Commands

**Backend (current terminal):**
```powershell
# Server is already running
# Press Ctrl+C to stop
```

**Frontend (new terminal):**
```powershell
cd court-cost-connect
npm run dev          # Start development server
npm run build        # Build for production
```

## 🆘 Troubleshooting

**Frontend can't connect to API?**
- Make sure backend is running on port 5000
- Check `VITE_API_URL` in frontend `.env` (defaults to `http://localhost:5000/api`)

**Authentication issues?**
- Clear browser localStorage if needed
- Try creating a new account

**Need help?**
- Check `QUICK_START.md` for setup guide
- Check `server/README.md` for API docs

## 🎊 You're All Set!

Your Court Cost Connect application is ready to use! Start the frontend and create your first account to begin managing your tennis group.

