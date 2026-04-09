# Court Cost Connect - Backend Server

This is the backend server for the Court Cost Connect application, built with Express.js, MongoDB, and Mongoose.

## Features

- **MongoDB Integration**: Robust database with Mongoose ODM
- **JWT Authentication**: Secure authentication with access and refresh tokens
- **Role-Based Access Control**: Admin and Member roles with appropriate permissions
- **RESTful API**: Complete CRUD operations for all entities

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the server directory (copy from `.env.example`):
```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/court-cost-connect
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

Optional mail env vars for the monthly public bills email:
```bash
MONTHLY_REPORT_ENABLED=true
MONTHLY_REPORT_TO=recipient@example.com
MONTHLY_REPORT_FROM=sender@example.com
MONTHLY_REPORT_TIMEZONE=Asia/Kolkata
MONTHLY_REPORT_BASE_URL=https://your-api-domain.com

# Option 1: SMTP / Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sender@example.com
SMTP_PASS=your-app-password

# or Gmail shorthand
MAIL_SERVICE=gmail
MAIL_USER=sender@example.com
MAIL_PASS=your-app-password

# Option 2: Resend HTTP API (recommended for Render production)
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=sender@yourdomain.com
```

Notes:
- For Gmail, use an App Password, not your regular Gmail password.
- If you set `MAIL_SERVICE=gmail` without explicit `SMTP_*`, the server now defaults to `smtp.gmail.com:465` with `secure=true`.
- For Render production, `RESEND_API_KEY` is recommended because it avoids SMTP connection timeouts entirely.
- You can test whether the backend can verify its mail setup with `GET /api/reports/monthly-public-bills/status`.

**Important**: Change the JWT secrets to strong, random strings in production!

## Running the Server

### Development Mode
```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - Create a new user account
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate refresh token

### Members (`/api/members`)
- `GET /api/members` - Get all members (admin) or own profile (member)
- `GET /api/members/:id` - Get a specific member
- `POST /api/members` - Create a new member (admin only)
- `PUT /api/members/:id` - Update a member
- `DELETE /api/members/:id` - Delete a member (admin only)

### Bookings (`/api/bookings`)
- `GET /api/bookings` - Get bookings (with optional date filters)
- `GET /api/bookings/:id` - Get a specific booking
- `POST /api/bookings` - Create a new booking
- `PUT /api/bookings/:id` - Update a booking
- `DELETE /api/bookings/:id` - Delete a booking

### Attendance (`/api/attendance`)
- `GET /api/attendance` - Get attendance records (with optional filters)
- `GET /api/attendance/date/:date` - Get attendance for a specific date
- `POST /api/attendance` - Create or update attendance (single or bulk)

### Expenses (`/api/expenses`)
- `GET /api/expenses` - Get expenses (with optional filters)
- `GET /api/expenses/:id` - Get a specific expense
- `POST /api/expenses` - Create a new expense (admin only)
- `PUT /api/expenses/:id` - Update an expense (admin only)
- `DELETE /api/expenses/:id` - Delete an expense (admin only)

### Reports (`/api/reports`)
- `GET /api/reports` - Get all reports (admin only)
- `GET /api/reports/:id` - Get a specific report
- `POST /api/reports/generate` - Generate a new report (admin only)

## Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

The access token expires after 15 minutes (configurable). Use the refresh token endpoint to get a new access token.

## Database Models

### User
- Email (unique)
- Password (hashed with bcrypt)
- Role (admin/member)
- Member reference
- Refresh token

### Member
- Name, Email, Phone
- Role (admin/member)
- Status (active/inactive)
- Balance
- Attendance rate
- Join date

### Booking
- Date, Time, Court
- Status (available/booked/pending/cancelled)
- Booked by (Member reference)
- Number of players

### Attendance
- Date
- Member reference
- Is present (boolean)

### Expense
- Date, Category, Description
- Amount
- Paid by (Member reference)
- Present members count
- Per member share (calculated)
- Status (pending/completed)

### Report
- Type (financial/attendance/booking/expense)
- Title, Description
- Data (JSON)
- Period (start/end dates)
- Generated by (Member reference)

## Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

Error responses follow this format:
```json
{
  "error": "Error message"
}
```

## Security Features

- Passwords are hashed using bcrypt
- JWT tokens for stateless authentication
- Refresh token mechanism for session persistence
- Role-based access control middleware
- CORS configuration for frontend integration

