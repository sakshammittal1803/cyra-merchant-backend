import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { initializeSocket, getIO } from './services/socket';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  listenToFirebaseOrders, 
  updateFirebaseOrderStatus, 
  syncMenuToFirebase,
  getFirebaseMenu,
  convertFirebaseOrderToMerchant 
} from './services/firebase';
import logger, { logAuthAttempt, logSecurity } from './utils/logger';
import { apiLimiter, authLimiter, orderLimiter, menuLimiter, webhookLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler, asyncHandler, AppError } from './middleware/errorHandler';
import { requestLogger, addRequestId, enhancedRequestLogger } from './middleware/requestLogger';
import { sanitizeInput } from './middleware/sanitizer';
import { securityAudit, trackAuthFailure, isIpBlocked, clearAuthFailures } from './middleware/securityAudit';
import {
  validateLogin,
  validateSignup,
  validateGoogleSignup,
  validateMenuItem,
  validateOrderStatus,
} from './middleware/validator';

dotenv.config();

// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    restaurantName?: string;
  };
}

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Trust proxy - important for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
app.use(compression());

// ✅ CORS (FIXED)
const allowedOrigins = [
  "https://cyra-merchant.vercel.app",
  "https://cyra-frontend.vercel.app",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])
].filter((o): o is string => Boolean(o));

logger.info('CORS allowed origins configured', { origins: allowedOrigins });

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn("Blocked Origin", { origin, allowedOrigins });
      logSecurity('CORS blocked origin', { origin, ip: 'unknown' });
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data
app.use(mongoSanitize());
app.use(sanitizeInput);

// Request ID and logging
app.use(addRequestId);
app.use(requestLogger);
app.use(enhancedRequestLogger);

// Security audit
app.use(securityAudit);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
}

// In-memory storage for demo
const demoData = {
  users: [
    {
      id: 1,
      email: 'admin@kitchen.com',
      password_hash: '$2a$10$HNOU5wR2FrzE6IF0MM10..9amWXgN.ZBN8NS1f4vq6aMFLQhz559G', // admin123
      role: 'admin',
      name: 'Admin User',
      restaurantName: 'Demo Kitchen'
    },
    {
      id: 2,
      email: 'staff@kitchen.com',
      password_hash: '$2a$10$O2HKgM768oO54uGs8NJxNuxn5kyj10muMJskL8D13z0uR/gitcT3C', // staff123
      role: 'staff',
      name: 'Kitchen Staff',
      restaurantName: 'Demo Kitchen'
    }
  ],
  orders: [] as any[],
  menuItems: [] as any[] // Will be loaded from Firebase
};

let orderIdCounter = 1;
let menuIdCounter = 1;

// Auth middleware
const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  logger.debug('Authentication attempt', {
    hasToken: !!token,
    ip: req.ip,
    path: req.path,
    requestId: (req as any).requestId,
  });
  
  if (!token) {
    logSecurity('No token provided', { 
      ip: req.ip, 
      path: req.path,
      requestId: (req as any).requestId,
    });
    return next(new AppError('No token provided', 401));
  }
  
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured in environment!');
      return next(new AppError('Server configuration error', 500));
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded;
    
    // Get user details including restaurant name
    const user = demoData.users.find(u => u.id === decoded.id);
    if (user && req.user) {
      req.user.restaurantName = user.restaurantName;
      logger.debug('User authenticated', { 
        email: user.email, 
        role: user.role,
        requestId: (req as any).requestId,
      });
    } else {
      logSecurity('Token valid but user not found', { 
        userId: decoded.id,
        requestId: (req as any).requestId,
      });
    }
    
    next();
  } catch (error: any) {
    logSecurity('Token verification failed', { 
      error: error.message, 
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    return next(new AppError('Invalid token', 401));
  }
};

// Routes
app.post('/api/auth/google', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, name, googleId } = req.body;
  logger.info('Google OAuth attempt', { email });
  
  // Check if user exists
  let user = demoData.users.find(u => u.email === email);
  
  if (user) {
    // User exists - login
    logger.info('Existing user login', { email });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        restaurantName: user.restaurantName,
      },
      isNewUser: false,
    });
  } else {
    // New user - return flag to show signup form
    logger.info('New Google user needs signup', { email });
    return res.json({
      isNewUser: true,
      email,
      name,
      googleId,
    });
  }
}));

app.post('/api/auth/google-signup', authLimiter, validateGoogleSignup, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, restaurantName, googleId } = req.body;
  logger.info('Google signup', { email, role });

  // Check if user already exists
  const existingUser = demoData.users.find(u => u.email === email);
  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
  }

  // Create new user (no password needed for Google OAuth)
  const newUser = {
    id: demoData.users.length + 1,
    email,
    password_hash: '', // No password for Google OAuth users
    role,
    name,
    restaurantName,
    googleId,
  };

  demoData.users.push(newUser);

  // Generate token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  logger.info('New Google user registered', { name, email, role });

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
      restaurantName: newUser.restaurantName,
    },
  });
}));

app.post('/api/auth/login', authLimiter, validateLogin, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = req.ip || 'unknown';
  
  // Check if IP is blocked
  if (isIpBlocked(ip)) {
    logAuthAttempt(email, false, ip, { reason: 'IP blocked' });
    throw new AppError('Too many failed attempts. Please try again later.', 429);
  }
  
  logger.info('Login attempt', { email, ip, requestId: (req as any).requestId });
  
  const user = demoData.users.find(u => u.email === email);
  
  if (!user) {
    trackAuthFailure(ip);
    logAuthAttempt(email, false, ip, { reason: 'User not found' });
    throw new AppError('Invalid credentials', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    trackAuthFailure(ip);
    logAuthAttempt(email, false, ip, { reason: 'Invalid password' });
    throw new AppError('Invalid credentials', 401);
  }

  // Clear failed attempts on successful login
  clearAuthFailures(ip);

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  logAuthAttempt(email, true, ip, { role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      restaurantName: user.restaurantName,
    },
  });
}));

app.post('/api/auth/signup', authLimiter, validateSignup, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, restaurantName } = req.body;

  // Check if user already exists
  const existingUser = demoData.users.find(u => u.email === email);
  if (existingUser) {
    throw new AppError('User already exists with this email', 400);
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
    restaurantName,
    created_at: new Date().toISOString(),
  };

  demoData.users.push(newUser);

  // Generate token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  logger.info('New user registered', { name, email, role });

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
      restaurantName: newUser.restaurantName,
    },
  });
}));

app.get('/api/dashboard/stats', authenticate, apiLimiter, asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Dashboard stats requested');
  
  // Get today's date (start of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Filter today's orders
  const todaysOrders = demoData.orders.filter(o => {
    const orderDate = new Date(o.created_at);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  });
  
  // Get completed orders
  const completedOrders = demoData.orders.filter(o => o.status === 'completed');
  
  // Calculate total revenue (all completed orders)
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  
  // Calculate today's revenue (only today's completed orders)
  const todaysCompletedOrders = todaysOrders.filter(o => o.status === 'completed');
  const todaysRevenue = todaysCompletedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  
  logger.debug('Stats calculated', {
    totalOrders: demoData.orders.length,
    totalRevenue,
    todaysRevenue,
    todaysOrdersCount: todaysOrders.length,
  });
  
  // Calculate real stats from orders
  const stats = {
    orders: {
      pending: demoData.orders.filter(o => o.status === 'pending').length,
      preparing: demoData.orders.filter(o => o.status === 'preparing').length,
      completed: completedOrders.length,
      cancelled: demoData.orders.filter(o => o.status === 'cancelled').length,
    },
    revenue: totalRevenue,
    todaysRevenue: todaysRevenue,
    todaysOrders: {
      total: todaysOrders.length,
      pending: todaysOrders.filter(o => o.status === 'pending').length,
      preparing: todaysOrders.filter(o => o.status === 'preparing').length,
      completed: todaysCompletedOrders.length,
      cancelled: todaysOrders.filter(o => o.status === 'cancelled').length,
    },
    recentOrders: demoData.orders
      .slice(-10)
      .reverse()
      .map(o => ({
        id: o.id,
        cyra_order_id: o.cyra_order_id,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        customer_email: o.customer_email,
        delivery_address: o.delivery_address,
        status: o.status,
        total_amount: o.total_amount,
        customer_notes: o.customer_notes,
        created_at: o.created_at,
        updated_at: o.updated_at,
        items: o.items,
      })),
  };
  
  res.status(200).json(stats);
}));

app.get('/api/orders', authenticate, apiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  let orders = demoData.orders;
  
  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  
  logger.debug('Orders fetched', { count: orders.length, status });
  res.json(orders.reverse());
}));

app.put('/api/orders/:id/status', authenticate, apiLimiter, validateOrderStatus, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const order = demoData.orders.find(o => o.id === parseInt(id));
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  
  order.status = status;
  order.updated_at = new Date().toISOString();
  
  // Update in Firebase if it has a firebase_key
  if (order.firebase_key) {
    updateFirebaseOrderStatus(order.firebase_key, status);
  }
  
  const io = getIO();
  io.emit('order:updated', order);
  
  logger.info('Order status updated', { orderId: id, status });
  res.json(order);
}));

app.post('/api/orders/:id/cancel', authenticate, apiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const order = demoData.orders.find(o => o.id === parseInt(id));
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  
  order.status = 'cancelled';
  order.updated_at = new Date().toISOString();
  
  // Update in Firebase if it has a firebase_key
  if (order.firebase_key) {
    updateFirebaseOrderStatus(order.firebase_key, 'cancelled');
  }
  
  const io = getIO();
  io.emit('order:updated', order);
  
  logger.info('Order cancelled', { orderId: id });
  res.json(order);
}));

app.get('/api/menu', authenticate, apiLimiter, asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Menu items fetched', { 
    count: demoData.menuItems.length,
    requestId: (req as any).requestId,
  });
  res.json(demoData.menuItems);
}));

app.post('/api/menu', authenticate, menuLimiter, validateMenuItem, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, price, category, is_available, phase } = req.body;
  
  logger.info('Creating new menu item', { name, category });
  
  const newItem = {
    id: menuIdCounter++,
    name,
    description,
    price: parseFloat(price),
    category,
    phase: phase || 'all',
    restaurantName: req.user?.restaurantName || 'Unknown Restaurant',
    image_url: null,
    is_available: is_available !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  demoData.menuItems.push(newItem);
  
  // Sync to Firebase
  syncMenuToFirebase(demoData.menuItems);
  
  const io = getIO();
  io.emit('menu:updated', { action: 'create', item: newItem });
  
  logger.info('Menu item created', { id: newItem.id, name: newItem.name });
  res.status(201).json(newItem);
}));

app.put('/api/menu/:id', authenticate, menuLimiter, validateMenuItem, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, price, category, is_available, phase } = req.body;
  
  const item = demoData.menuItems.find(m => m.id === parseInt(id));
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }
  
  Object.assign(item, {
    name,
    description,
    price: parseFloat(price),
    category,
    phase: phase || item.phase || 'all',
    restaurantName: item.restaurantName || req.user?.restaurantName || 'Unknown Restaurant',
    is_available,
    updated_at: new Date().toISOString(),
  });
  
  // Sync to Firebase
  syncMenuToFirebase(demoData.menuItems);
  
  const io = getIO();
  io.emit('menu:updated', { action: 'update', item });
  
  logger.info('Menu item updated', { id, name });
  res.json(item);
}));

app.delete('/api/menu/:id', authenticate, menuLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = demoData.menuItems.findIndex(m => m.id === parseInt(id));
  
  if (index === -1) {
    throw new AppError('Menu item not found', 404);
  }
  
  const [item] = demoData.menuItems.splice(index, 1);
  
  // Sync to Firebase
  syncMenuToFirebase(demoData.menuItems);
  
  const io = getIO();
  io.emit('menu:updated', { action: 'delete', item });
  
  logger.info('Menu item deleted', { id });
  res.json({ message: 'Menu item deleted' });
}));

// Webhook for demo - simulate CYRA orders
app.post('/api/webhook/cyra/order', webhookLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { order_id, customer, items, total_amount, notes } = req.body;
  
  const newOrder = {
    id: orderIdCounter++,
    cyra_order_id: order_id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    status: 'pending',
    total_amount,
    customer_notes: notes,
    items: items.map((item: any) => ({
      id: Math.random(),
      item_name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  demoData.orders.push(newOrder);
  
  const io = getIO();
  io.emit('order:new', newOrder);
  
  logger.info('New order received via webhook', { orderId: order_id });
  res.status(201).json({ success: true, order: newOrder });
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'demo',
    timestamp: new Date().toISOString(),
    stats: {
      totalOrders: demoData.orders.length,
      menuItems: demoData.menuItems.length,
      users: demoData.users.length,
    },
    firebase: {
      connected: true,
      databaseUrl: process.env.FIREBASE_DATABASE_URL,
    }
  });
});

// Debug endpoint to see all orders (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/orders', (req, res) => {
    const ordersWithDetails = demoData.orders.map(o => ({
      id: o.id,
      cyra_order_id: o.cyra_order_id,
      customer_name: o.customer_name,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
    }));
    
    const completedOrders = demoData.orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    res.json({
      totalOrders: demoData.orders.length,
      orders: ordersWithDetails,
      completedOrders: completedOrders.length,
      totalRevenue: totalRevenue,
      ordersByStatus: {
        pending: demoData.orders.filter(o => o.status === 'pending').length,
        preparing: demoData.orders.filter(o => o.status === 'preparing').length,
        completed: completedOrders.length,
        cancelled: demoData.orders.filter(o => o.status === 'cancelled').length,
      }
    });
  });
}

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize menu from Firebase
async function initializeMenu() {
  try {
    logger.info('Loading menu from Firebase...');
    const firebaseMenu = await getFirebaseMenu();
    
    if (firebaseMenu && Object.keys(firebaseMenu).length > 0) {
      // Convert Firebase menu to array format
      demoData.menuItems = Object.entries(firebaseMenu).map(([id, item]: [string, any]) => ({
        id: parseInt(id),
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        phase: item.phase || 'all',
        restaurantName: item.restaurantName || 'Demo Kitchen',
        image_url: item.imageUrl,
        is_available: item.isAvailable,
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      }));
      
      // Update menuIdCounter to be higher than the highest ID
      const maxId = Math.max(...demoData.menuItems.map(item => item.id), 0);
      menuIdCounter = maxId + 1;
      
      logger.info(`Loaded ${demoData.menuItems.length} menu items from Firebase`);
      
      // Re-sync to Firebase to ensure all items have restaurantName
      await syncMenuToFirebase(demoData.menuItems);
      logger.info('Menu re-synced with restaurant names');
    } else {
      // No items in Firebase, create default items
      logger.info('No menu items in Firebase, creating defaults...');
      demoData.menuItems = [
        {
          id: 1,
          name: 'Chicken Biryani',
          description: 'Aromatic rice with tender chicken',
          price: 12.99,
          category: 'Main Course',
          phase: 'all',
          restaurantName: 'Demo Kitchen',
          image_url: null,
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Butter Chicken',
          description: 'Creamy tomato-based curry',
          price: 14.99,
          category: 'Main Course',
          phase: 'all',
          restaurantName: 'Demo Kitchen',
          image_url: null,
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      menuIdCounter = 3;
      
      // Sync defaults to Firebase
      await syncMenuToFirebase(demoData.menuItems);
      logger.info('Default menu items synced to Firebase');
    }
  } catch (error) {
    logger.error('Error loading menu from Firebase', { error });
    // Fallback to default items
    demoData.menuItems = [
      {
        id: 1,
        name: 'Chicken Biryani',
        description: 'Aromatic rice with tender chicken',
        price: 12.99,
        category: 'Main Course',
        phase: 'all',
        restaurantName: 'Demo Kitchen',
        image_url: null,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    menuIdCounter = 2;
  }
}

// Initialize and start server
async function startServer() {
  try {
    // Initialize Socket.io FIRST
    initializeSocket(server);
    logger.info('Socket.io initialized');
    
    // Load menu from Firebase
    await initializeMenu();
    
    // Start Firebase listener for orders AFTER Socket.io is ready
    logger.info('Setting up Firebase order listener...');
    listenToFirebaseOrders((firebaseOrder) => {
      logger.info('New order from Firebase', {
        orderId: firebaseOrder.orderId,
        customer: firebaseOrder.customerName,
        total: firebaseOrder.totalAmount,
        items: firebaseOrder.items?.length || 0,
      });
      
      const merchantOrder: any = convertFirebaseOrderToMerchant(firebaseOrder);
      merchantOrder.id = orderIdCounter++;
      
      demoData.orders.push(merchantOrder);
      logger.info('Order added to merchant system', {
        orderId: merchantOrder.id,
        totalOrders: demoData.orders.length,
      });
      
      // Emit to connected clients
      try {
        const io = getIO();
        io.emit('order:new', merchantOrder);
        logger.debug('Order broadcasted to connected clients');
      } catch (error) {
        logger.error('Error broadcasting order', { error });
      }
    });
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running in DEMO MODE on port ${PORT}`);
      logger.info(`Firebase integration: ACTIVE`);
      logger.info(`Database: ${process.env.FIREBASE_DATABASE_URL}`);
      logger.info(`Menu items loaded: ${demoData.menuItems.length}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Login credentials: admin@kitchen.com / admin123');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the server
startServer();
