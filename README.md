# Auto Attendance Tracking System - Backend

A complete backend API for attendance tracking with fingerprint biometrics, built with Node.js, Express, MongoDB, and JWT authentication.

## 📋 Features

- **JWT Authentication** for Admin and Superadmin roles
- **Employee Management** (CRUD operations)
- **Attendance Marking** with location tracking
- **Fingerprint Template Storage** (MFS100/Precision PB100 compatible)
- **Superadmin Dashboard** access to complete attendance feed
- **Role-based Access Control**
- **MongoDB Atlas** cloud database

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (URI provided)
- Text editor (VS Code recommended)

### Installation

1. **Navigate to backend directory:**
```bash
cd auto-attendance-backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Generate password hashes:**
```bash
node generateHash.js
```
This will output bcrypt hashes for your admin and superadmin passwords.

4. **Create .env file:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your favorite editor
nano .env  # or code .env
```

5. **Update .env file with your values:**
```env
MONGODB_URI=mongodb+srv://autoattendancetracker:autoattendancetracker@autoattendancetracker.5ozrfea.mongodb.net/autoattendancetracker
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<paste hash from generateHash.js>
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD_HASH=<paste hash from generateHash.js>
```

6. **Start the server:**

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

You should see:
```
✅ MongoDB Connected: autoattendancetracker.5ozrfea.mongodb.net
🚀 Server is running on port 5000
```

## 📁 Project Structure

```
auto-attendance-backend/
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── User.js               # User schema (reference)
│   ├── Employee.js           # Employee schema
│   └── Attendance.js         # Attendance schema
├── middleware/
│   └── auth.js               # JWT authentication & authorization
├── routes/
│   ├── authRoutes.js         # Login endpoints
│   ├── adminRoutes.js        # Employee & attendance management
│   └── superadminRoutes.js   # Attendance feed & statistics
├── utils/
│   └── fingerprint.js        # Fingerprint handling documentation
├── .env                       # Environment variables (create this)
├── .env.example              # Example environment file
├── generateHash.js           # Password hash generator
├── package.json              # Dependencies
└── server.js                 # Main application entry point
```

## 🔐 API Endpoints

### Authentication Routes (`/api/auth`)

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "role": "ADMIN"
  }
}
```

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```

### Admin Routes (`/api/admin`)

All admin routes require `Authorization: Bearer <admin-token>` header.

#### Create Employee
```http
POST /api/admin/employees
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "John Doe",
  "employeeId": "EMP001",
  "jobRole": "Software Engineer",
  "department": "IT",
  "fingerprintTemplate": "base64_or_hex_template_string_from_sdk",
  "baseLocation": {
    "latitude": 10.0261,
    "longitude": 76.3125
  }
}
```

#### Get All Employees
```http
GET /api/admin/employees
Authorization: Bearer <token>
```

#### Get Single Employee
```http
GET /api/admin/employees/:id
Authorization: Bearer <token>
```

#### Mark Attendance
```http
POST /api/admin/attendance/mark
Content-Type: application/json
Authorization: Bearer <token>

{
  "employeeId": "EMP001",
  "date": "2025-12-15T09:00:00Z",
  "status": "PRESENT",
  "location": {
    "latitude": 10.0261,
    "longitude": 76.3125
  }
}
```

#### Get Attendance History
```http
GET /api/admin/attendance/history/:employeeId?startDate=2025-12-01&endDate=2025-12-15
Authorization: Bearer <token>
```

### Superadmin Routes (`/api/superadmin`)

All superadmin routes require `Authorization: Bearer <superadmin-token>` header.

#### Get Attendance Feed (Main Feed URL)
```http
GET /api/superadmin/attendance?startDate=2025-12-01&endDate=2025-12-15&page=1&limit=50
Authorization: Bearer <token>
```

Query parameters:
- `startDate`: Filter from date (ISO format)
- `endDate`: Filter to date (ISO format)
- `employeeId`: Filter by employee
- `department`: Filter by department
- `status`: Filter by status (PRESENT/ABSENT/LATE/HALF_DAY)
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50)

#### Get Employee Attendance
```http
GET /api/superadmin/attendance/:employeeId
Authorization: Bearer <token>
```

#### Get All Employees (with fingerprints)
```http
GET /api/superadmin/employees
Authorization: Bearer <token>
```

#### Get Statistics
```http
GET /api/superadmin/statistics?startDate=2025-12-01&endDate=2025-12-15
Authorization: Bearer <token>
```

## 💾 Database Schemas

### Employee
```javascript
{
  name: String,
  employeeId: String (unique),
  jobRole: String,
  department: String,
  fingerprintTemplate: String,  // Raw template from SDK
  baseLocation: {
    latitude: Number,
    longitude: Number
  },
  createdBy: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Attendance
```javascript
{
  employee: ObjectId (ref: Employee),
  employeeId: String,
  employeeName: String,
  department: String,
  jobRole: String,
  date: Date,
  status: String (PRESENT/ABSENT/LATE/HALF_DAY),
  fingerprintTemplate: String,  // Copied from employee
  location: {
    latitude: Number,
    longitude: Number
  },
  markedBy: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | mongodb+srv://... |
| `JWT_SECRET` | Secret key for JWT tokens | your_secret_key_here |
| `PORT` | Server port | 5000 |
| `ADMIN_USERNAME` | Admin username | admin |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password | $2a$10$... |
| `SUPERADMIN_USERNAME` | Superadmin username | superadmin |
| `SUPERADMIN_PASSWORD_HASH` | Bcrypt hash of superadmin password | $2a$10$... |

## 🧪 Testing the API

### Using curl

```bash
# Login as Admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Create Employee (replace <TOKEN> with actual token)
curl -X POST http://localhost:5000/api/admin/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "John Doe",
    "employeeId": "EMP001",
    "jobRole": "Developer",
    "department": "IT",
    "fingerprintTemplate": "dummy_template_string_123",
    "baseLocation": {"latitude": 10.0261, "longitude": 76.3125}
  }'
```

### Using Postman

1. Import the API endpoints
2. Set up environment variables for base URL and tokens
3. Use Collections for organized testing

## 🔒 Security Notes

1. **JWT Tokens**: Expire in 24 hours
2. **Password Hashing**: Uses bcrypt with 10 salt rounds
3. **Role-based Access**: Admin and Superadmin have different permissions
4. **CORS**: Currently allows all origins (configure for production)
5. **Fingerprint Data**: Stored as plain text (encrypt in production)

## 📝 Implementation Notes

### Fingerprint Template Handling

The system stores fingerprint templates as opaque strings:
- No validation or transformation
- Compatible with MFS100/Precision PB100 SDK format
- See `utils/fingerprint.js` for SDK integration guidance

### Superadmin Feed Architecture

- **Option A (Implemented)**: Attendance records are saved to database and Superadmin reads via API
- The `/api/superadmin/attendance` endpoint is the "feed URL" mentioned in requirements
- Includes complete attendance data with fingerprint templates

## 🐛 Troubleshooting

### MongoDB Connection Issues
```
Error: MongoServerError: bad auth
```
**Solution**: Check MONGODB_URI in .env file

### JWT Token Errors
```
Error: Invalid or expired token
```
**Solution**: Re-login to get a fresh token

### Port Already in Use
```
Error: EADDRINUSE: address already in use :::5000
```
**Solution**: Change PORT in .env or kill the process using that port

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT Introduction](https://jwt.io/introduction)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/)

## 👨‍💻 Development

### Adding New Routes

1. Create route file in `routes/` directory
2. Import necessary models and middleware
3. Define route handlers
4. Export router
5. Import and use in `server.js`

### Modifying Schemas

1. Edit model file in `models/` directory
2. Restart server to apply changes
3. Existing data remains unchanged

## 📄 License

ISC

## 🤝 Support

For issues or questions, create an issue in the repository or contact the development team.
