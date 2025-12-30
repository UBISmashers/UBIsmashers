# MongoDB Atlas Setup Guide

## Getting Your MongoDB Atlas Connection String

### Step 1: Get Your Connection String from MongoDB Atlas

1. **Log in to MongoDB Atlas**: https://cloud.mongodb.com

2. **Navigate to your cluster**:
   - Click on "Clusters" in the left sidebar
   - Select your cluster

3. **Click "Connect"**:
   - Click the "Connect" button on your cluster

4. **Choose "Connect your application"**:
   - Select "Drivers" tab
   - Choose "Node.js" as your driver
   - Copy the connection string (it looks like):
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```

### Step 2: Update Your Connection String

Replace the placeholders in the connection string:

1. **Replace `<username>`** with your MongoDB Atlas username
2. **Replace `<password>` with your MongoDB Atlas password** (URL-encode special characters if needed)
3. **Add your database name** at the end (before the `?`):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/court-cost-connect?retryWrites=true&w=majority
   ```

### Step 3: Configure Your .env File

Create or update `server/.env` file with:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/court-cost-connect?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

**Important Notes:**
- Replace `username` and `password` with your actual credentials
- Replace `cluster0.xxxxx.mongodb.net` with your actual cluster URL
- The database name `court-cost-connect` will be created automatically if it doesn't exist
- Make sure your IP address is whitelisted in MongoDB Atlas (see Step 4)

### Step 4: Whitelist Your IP Address

1. **In MongoDB Atlas**, go to "Network Access" (left sidebar)
2. **Click "Add IP Address"**
3. **For development**, you can:
   - Click "Add Current IP Address" (recommended)
   - Or click "Allow Access from Anywhere" (0.0.0.0/0) - **Only for development!**
4. **Click "Confirm"**

**Security Note**: For production, always whitelist specific IP addresses, never use 0.0.0.0/0

### Step 5: Verify Database User

1. **In MongoDB Atlas**, go to "Database Access" (left sidebar)
2. **Make sure you have a database user created**:
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Set a username and strong password
   - Select "Atlas Admin" role (or custom role with read/write permissions)
   - Click "Add User"

**Important**: Use this username and password in your connection string!

## Example .env File

Here's a complete example (replace with your actual values):

```env
PORT=5000
MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/court-cost-connect?retryWrites=true&w=majority
JWT_SECRET=my-super-secret-jwt-key-12345-67890-abcdef
JWT_REFRESH_SECRET=my-super-secret-refresh-key-12345-67890-abcdef
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

## Testing Your Connection

After setting up your `.env` file, start the server:

```bash
cd server
npm run dev
```

**Success message:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

**If you see connection errors:**

1. **Check your connection string format**:
   - Make sure it starts with `mongodb+srv://`
   - Verify username and password are correct
   - Check the database name is included

2. **Verify IP whitelist**:
   - Make sure your current IP is whitelisted
   - Or use 0.0.0.0/0 for development (not recommended for production)

3. **Check database user**:
   - Verify the username and password are correct
   - Make sure the user has proper permissions

4. **Network issues**:
   - Check your internet connection
   - Verify MongoDB Atlas cluster is running (not paused)

## Common Issues

### Issue: "Authentication failed"
- **Solution**: Double-check your username and password in the connection string
- Make sure special characters in password are URL-encoded (e.g., `@` becomes `%40`)

### Issue: "IP not whitelisted"
- **Solution**: Add your IP address in MongoDB Atlas Network Access
- Or temporarily allow 0.0.0.0/0 for testing (remember to remove it later!)

### Issue: "Connection timeout"
- **Solution**: Check your internet connection
- Verify the cluster URL is correct
- Make sure your cluster is not paused in MongoDB Atlas

### Issue: "Database name not found"
- **Solution**: The database will be created automatically when you first connect
- Make sure the database name in the connection string is correct

## Security Best Practices

1. **Never commit `.env` file to git** (it's already in `.gitignore`)
2. **Use strong passwords** for your database user
3. **Whitelist specific IPs** instead of 0.0.0.0/0 in production
4. **Rotate JWT secrets** regularly in production
5. **Use environment-specific connection strings** (dev, staging, production)

## Need Help?

- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- MongoDB Connection String Guide: https://docs.mongodb.com/manual/reference/connection-string/

