# Fixing MongoDB Atlas Authentication Error

## Current Error
```
MongoServerError: bad auth : authentication failed
```

## Possible Causes & Solutions

### 1. Wrong Username or Password
**Check in MongoDB Atlas:**
1. Go to https://cloud.mongodb.com
2. Click "Database Access" (left sidebar)
3. Find your user: `basicallyiamanobe_db_user`
4. Click "Edit" to verify the password
5. If password is wrong, either:
   - Update the password in Atlas and update your `.env` file
   - Or reset the password in Atlas

### 2. Password Needs URL Encoding
If your password contains special characters, they need to be URL-encoded in the connection string.

**Common characters that need encoding:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`
- `?` → `%3F`
- `/` → `%2F`
- `:` → `%3A`

**Your current password:** `FE3qLpNmWtvNUm5O`

This password doesn't seem to have special characters, but if it does, you need to encode them.

**Example:**
If your password is `pass@word`, the connection string should be:
```
mongodb+srv://username:pass%40word@cluster.mongodb.net/database
```

### 3. User Doesn't Have Proper Permissions
**Check in MongoDB Atlas:**
1. Go to "Database Access"
2. Find your user
3. Make sure it has:
   - **Atlas Admin** role (for full access), OR
   - **Read and write to any database** role

### 4. IP Address Not Whitelisted
Even if credentials are correct, MongoDB Atlas will reject connections from non-whitelisted IPs.

**To fix:**
1. Go to "Network Access" in MongoDB Atlas
2. Click "Add IP Address"
3. Click "Add Current IP Address"
4. Or temporarily use "Allow Access from Anywhere" (0.0.0.0/0) for testing

## Quick Fix Steps

### Step 1: Verify User in MongoDB Atlas
1. Log in to https://cloud.mongodb.com
2. Go to "Database Access"
3. Check if user `basicallyiamanobe_db_user` exists
4. Click "Edit" to see/reset password

### Step 2: Get Fresh Connection String
1. In MongoDB Atlas, go to "Clusters"
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password
6. Add database name: `/court-cost-connect` before the `?`

### Step 3: Update .env File
Make sure your `.env` file has:
```env
MONGODB_URI=mongodb+srv://basicallyiamanobe_db_user:YOUR_PASSWORD@ubismashers.lnugwmu.mongodb.net/court-cost-connect?retryWrites=true&w=majority
```

**Important:** 
- Replace `YOUR_PASSWORD` with the actual password
- If password has special characters, URL-encode them
- Make sure there are no extra spaces

### Step 4: Test Connection
```powershell
npm run dev
```

You should see:
```
🔗 Connecting to MongoDB: mongodb+srv://basicallyiamanobe_db_user:****@ubismashers.lnugwmu.mongodb.net/court-cost-connect
✅ MongoDB connected successfully
```

## Still Having Issues?

1. **Create a new database user:**
   - Go to "Database Access" → "Add New Database User"
   - Choose "Password" authentication
   - Set a simple password (no special characters)
   - Select "Atlas Admin" role
   - Update your `.env` with new credentials

2. **Test connection string directly:**
   - Use MongoDB Compass or mongosh to test the connection string
   - This helps isolate if it's a code issue or credential issue

3. **Check cluster status:**
   - Make sure your cluster is not paused
   - Go to "Clusters" and verify cluster is running

