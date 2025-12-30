# MongoDB Atlas Quick Checklist

## ✅ Before Starting the Server

### 1. IP Whitelist (IMPORTANT!)
Your MongoDB Atlas cluster needs to allow connections from your IP address.

**To check/update:**
1. Go to https://cloud.mongodb.com
2. Click "Network Access" in the left sidebar
3. Click "Add IP Address"
4. For development, you can:
   - Click "Add Current IP Address" (recommended)
   - Or temporarily use "Allow Access from Anywhere" (0.0.0.0/0) - **Only for testing!**

**If your IP is not whitelisted, you'll get a connection error!**

### 2. Database User
Make sure your database user exists and has proper permissions:
- Username: `basicallyiamanobe_db_user`
- Password: `FE3qLpNmWtvNUm5O`

**To verify:**
1. Go to "Database Access" in MongoDB Atlas
2. Check if the user exists
3. Make sure it has "Atlas Admin" or read/write permissions

### 3. Connection String Format
Your connection string looks correct:
```
mongodb+srv://basicallyiamanobe_db_user:FE3qLpNmWtvNUm5O@ubismashers.lnugwmu.mongodb.net/court-cost-connect
```

✅ Has username
✅ Has password
✅ Has cluster URL
✅ Has database name (`court-cost-connect`)

## 🚀 Ready to Start!

Once you've verified the IP whitelist, you can start the server:

```powershell
npm run dev
```

**Expected output:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📡 API available at http://localhost:5000/api
```

**If you see connection errors:**
- Check IP whitelist (most common issue!)
- Verify username/password are correct
- Check cluster is not paused
- Verify internet connection

