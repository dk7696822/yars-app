# YARS - Non Woven Bags Management System

A full-stack web application for managing non-woven bags business operations including orders, customers, invoices, and expenses.

## 🏗️ Project Structure

```
yars-app/
├── backend/          # Node.js/Express API server
├── frontend/         # React.js web application
└── README.md         # This file
```

## 🚀 Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database with Sequelize ORM
- **JWT** authentication
- **bcrypt** for password hashing
- **CORS** enabled for cross-origin requests

### Frontend
- **React 19** with Vite
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Lucide React** for icons

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database

## ⚙️ Environment Setup

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database Configuration
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=yars_db
DB_HOSTNAME=localhost
DB_PORT=5432
DB_DIALECT=postgres

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api
```

For production, create a `.env.production` file:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone <repository-url>
cd yars-app
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Set up environment variables (create .env file as shown above)

# Run database migrations
npm run migrate

# Seed the database (optional)
npm run seed

# Start development server
npm run dev
```

The backend server will start on `http://localhost:5000`

### 3. Frontend Setup
```bash
# Navigate to frontend directory (from root)
cd frontend

# Install dependencies
npm install

# Set up environment variables (create .env file as shown above)

# Start development server
npm run dev
```

The frontend application will start on `http://localhost:5173`

## 🏃‍♂️ Running the Application

### Development Mode

**Backend:**
```bash
cd backend
npm run dev          # Starts with nodemon for auto-reload
```

**Frontend:**
```bash
cd frontend
npm run dev          # Starts Vite dev server
```

### Production Mode

**Backend:**
```bash
cd backend
npm start            # Starts production server
```

**Frontend:**
```bash
cd frontend
npm run build        # Build for production
npm run preview      # Preview production build
```

## 📦 Available Scripts

### Backend Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data
- `npm test` - Run tests (not implemented yet)

### Frontend Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🗄️ Database Setup

1. **Install PostgreSQL** on your system
2. **Create a database** named `yars_db` (or as specified in your .env)
3. **Update database credentials** in backend/.env
4. **Run migrations** to set up tables:
   ```bash
   cd backend
   npm run migrate
   ```

## 🌐 API Endpoints

The backend API is available at `http://localhost:5000/api` with the following main endpoints:

- `/api/health` - Health check
- `/api/customers` - Customer management
- `/api/orders` - Order management
- `/api/invoices` - Invoice management
- `/api/expenses` - Expense tracking
- `/api/payments` - Payment records


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Verify PostgreSQL is running
   - Check database credentials in .env
   - Ensure database exists

2. **Frontend API errors:**
   - Verify backend is running on correct port
   - Check VITE_API_URL in frontend .env

3. **Port conflicts:**
   - Backend default: 5000
   - Frontend default: 5173
   - Change ports in respective configuration files if needed

### Getting Help

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that both frontend and backend servers are running
