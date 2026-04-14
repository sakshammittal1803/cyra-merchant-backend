// Simple JavaScript version for Vercel serverless
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://cyra-merchant.vercel.app',
      'https://cyra-frontend.vercel.app',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory data
const demoData = {
  users: [
    {
      id: 1,
      email: 'admin@kitchen.com',
      password_hash: '$2a$10$HNOU5wR2FrzE6IF0MM10..9amWXgN.ZBN8NS1f4vq6aMFLQhz559G',
      role: 'admin',
      name: 'Admin User',
      restaurantName: 'Demo Kitchen'
    }
  ],
  orders: [],
  menuItems: []
};

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'serverless',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Merchant Cyra Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = demoData.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        restaurantName: user.restaurantName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/menu', authenticate, (req, res) => {
  res.json(demoData.menuItems);
});

app.get('/api/orders', authenticate, (req, res) => {
  res.json(demoData.orders);
});

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  res.json({
    orders: {
      pending: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0
    },
    revenue: 0,
    todaysRevenue: 0,
    recentOrders: []
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Export for Vercel
module.exports = app;
