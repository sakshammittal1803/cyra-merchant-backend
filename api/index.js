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

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, restaurantName } = req.body;
    
    // Validation
    if (!name || !email || !password || !role || !restaurantName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user already exists
    const existingUser = demoData.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: demoData.users.length + 1,
      email,
      password_hash,
      role,
      name,
      restaurantName
    };
    
    demoData.users.push(newUser);
    
    // Generate token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        restaurantName: newUser.restaurantName
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
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

// Menu endpoints
app.get('/api/menu', authenticate, (req, res) => {
  res.json(demoData.menuItems);
});

app.post('/api/menu', authenticate, (req, res) => {
  try {
    const { name, description, price, category, image, available } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const newItem = {
      id: demoData.menuItems.length + 1,
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'Other',
      image: image || '',
      available: available !== false,
      createdAt: new Date().toISOString()
    };
    
    demoData.menuItems.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/menu/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, image, available } = req.body;
    
    const itemIndex = demoData.menuItems.findIndex(item => item.id === parseInt(id));
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    const updatedItem = {
      ...demoData.menuItems[itemIndex],
      name: name || demoData.menuItems[itemIndex].name,
      description: description !== undefined ? description : demoData.menuItems[itemIndex].description,
      price: price !== undefined ? parseFloat(price) : demoData.menuItems[itemIndex].price,
      category: category || demoData.menuItems[itemIndex].category,
      image: image !== undefined ? image : demoData.menuItems[itemIndex].image,
      available: available !== undefined ? available : demoData.menuItems[itemIndex].available,
      updatedAt: new Date().toISOString()
    };
    
    demoData.menuItems[itemIndex] = updatedItem;
    res.json(updatedItem);
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/menu/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const itemIndex = demoData.menuItems.findIndex(item => item.id === parseInt(id));
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    demoData.menuItems.splice(itemIndex, 1);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Order endpoints
app.get('/api/orders', authenticate, (req, res) => {
  res.json(demoData.orders);
});

app.put('/api/orders/:id/status', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const orderIndex = demoData.orders.findIndex(order => order.id === parseInt(id));
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    demoData.orders[orderIndex].status = status;
    demoData.orders[orderIndex].updatedAt = new Date().toISOString();
    
    res.json(demoData.orders[orderIndex]);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/orders/:id/cancel', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const orderIndex = demoData.orders.findIndex(order => order.id === parseInt(id));
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    demoData.orders[orderIndex].status = 'cancelled';
    demoData.orders[orderIndex].updatedAt = new Date().toISOString();
    
    res.json(demoData.orders[orderIndex]);
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
