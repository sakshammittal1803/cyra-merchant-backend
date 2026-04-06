import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
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

// Middleware
app.use(cors());
app.use(express.json());
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
  console.log('🔐 Authentication attempt:', {
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
  });
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET not configured in environment!');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded;
    
    // Get user details including restaurant name
    const user = demoData.users.find(u => u.id === decoded.id);
    if (user && req.user) {
      req.user.restaurantName = user.restaurantName;
      console.log('✅ Authenticated:', user.email);
    } else {
      console.log('⚠️  Token valid but user not found:', decoded.id);
    }
    
    next();
  } catch (error: any) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, googleId } = req.body;
    console.log('🔐 Google OAuth attempt for:', email);
    
    // Check if user exists
    let user = demoData.users.find(u => u.email === email);
    
    if (user) {
      // User exists - login
      console.log('✅ Existing user found, logging in:', email);
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
      console.log('📝 New Google user, needs signup:', email);
      return res.json({
        isNewUser: true,
        email,
        name,
        googleId,
      });
    }
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/google-signup', async (req, res) => {
  try {
    const { name, email, role, restaurantName, googleId } = req.body;
    console.log('📝 Google signup for:', email);

    // Check if user already exists
    const existingUser = demoData.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Validate input
    if (!name || !email || !role || !restaurantName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
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

    console.log(`✅ New Google user registered: ${name} (${email}) as ${role}`);

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
  } catch (error) {
    console.error('Google signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt for:', email);
    
    const user = demoData.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✓ User found:', email);
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✓ Password valid for:', email);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful:', email);
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
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, restaurantName } = req.body;

    // Check if user already exists
    const existingUser = demoData.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
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

    console.log(`✅ New user registered: ${name} (${email}) as ${role}`);

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
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  console.log('📊 Dashboard stats requested');
  console.log(`📊 Total orders in system: ${demoData.orders.length}`);
  
  try {
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filter today's orders
    const todaysOrders = demoData.orders.filter(o => {
      const orderDate = new Date(o.created_at);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    
    // Get completed orders for debugging
    const completedOrders = demoData.orders.filter(o => o.status === 'completed');
    console.log(`📊 Completed orders: ${completedOrders.length}`);
    completedOrders.forEach(o => {
      console.log(`   - Order ${o.cyra_order_id}: ₹${o.total_amount}`);
    });
    
    // Calculate total revenue (all completed orders)
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    // Calculate today's revenue (only today's completed orders)
    const todaysCompletedOrders = todaysOrders.filter(o => o.status === 'completed');
    const todaysRevenue = todaysCompletedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    console.log(`💰 Total Revenue: ₹${totalRevenue} from ${completedOrders.length} orders`);
    console.log(`💰 Today's Revenue: ₹${todaysRevenue} from ${todaysCompletedOrders.length} orders`);
    
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
    
    console.log('📊 Stats calculated:', {
      pending: stats.orders.pending,
      preparing: stats.orders.preparing,
      completed: stats.orders.completed,
      totalRevenue: stats.revenue,
      todaysRevenue: stats.todaysRevenue,
      todaysOrdersCount: stats.todaysOrders.total,
      recentOrdersCount: stats.recentOrders.length,
    });
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('❌ Error calculating stats:', error);
    // Return empty stats on error
    res.status(200).json({
      orders: { pending: 0, preparing: 0, completed: 0, cancelled: 0 },
      revenue: 0,
      todaysRevenue: 0,
      todaysOrders: { total: 0, pending: 0, preparing: 0, completed: 0, cancelled: 0 },
      recentOrders: [],
    });
  }
});

app.get('/api/orders', authenticate, (req, res) => {
  const { status } = req.query;
  let orders = demoData.orders;
  
  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  
  res.json(orders.reverse());
});

app.put('/api/orders/:id/status', authenticate, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const order = demoData.orders.find(o => o.id === parseInt(id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  order.status = status;
  order.updated_at = new Date().toISOString();
  
  // Update in Firebase if it has a firebase_key
  if (order.firebase_key) {
    updateFirebaseOrderStatus(order.firebase_key, status);
  }
  
  const io = require('./services/socket').getIO();
  io.emit('order:updated', order);
  
  res.json(order);
});

app.post('/api/orders/:id/cancel', authenticate, (req, res) => {
  const { id } = req.params;
  
  const order = demoData.orders.find(o => o.id === parseInt(id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  order.status = 'cancelled';
  order.updated_at = new Date().toISOString();
  
  // Update in Firebase if it has a firebase_key
  if (order.firebase_key) {
    updateFirebaseOrderStatus(order.firebase_key, 'cancelled');
  }
  
  const io = require('./services/socket').getIO();
  io.emit('order:updated', order);
  
  res.json(order);
});

app.get('/api/menu', authenticate, (req, res) => {
  console.log(`📋 Fetching menu items. Total: ${demoData.menuItems.length}`);
  res.json(demoData.menuItems);
});

app.post('/api/menu', authenticate, (req: AuthRequest, res: Response) => {
  const { name, description, price, category, is_available, phase } = req.body;
  
  console.log('📝 Creating new menu item:', name);
  
  const newItem = {
    id: menuIdCounter++,
    name,
    description,
    price: parseFloat(price),
    category,
    phase: phase || 'all', // Default to 'all' if not specified
    restaurantName: req.user?.restaurantName || 'Unknown Restaurant',
    image_url: null,
    is_available: is_available !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  demoData.menuItems.push(newItem);
  console.log(`✅ Item added to memory. Total items: ${demoData.menuItems.length}`);
  
  // Sync to Firebase
  syncMenuToFirebase(demoData.menuItems);
  
  const io = require('./services/socket').getIO();
  io.emit('menu:updated', { action: 'create', item: newItem });
  
  res.status(201).json(newItem);
});

app.put('/api/menu/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, price, category, is_available, phase } = req.body;
  
  const item = demoData.menuItems.find(m => m.id === parseInt(id));
  if (!item) {
    return res.status(404).json({ error: 'Menu item not found' });
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
  
  const io = require('./services/socket').getIO();
  io.emit('menu:updated', { action: 'update', item });
  
  res.json(item);
});

app.delete('/api/menu/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const index = demoData.menuItems.findIndex(m => m.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Menu item not found' });
  }
  
  const [item] = demoData.menuItems.splice(index, 1);
  
  // Sync to Firebase
  syncMenuToFirebase(demoData.menuItems);
  
  const io = require('./services/socket').getIO();
  io.emit('menu:updated', { action: 'delete', item });
  
  res.json({ message: 'Menu item deleted' });
});

// Webhook for demo - simulate CYRA orders
app.post('/api/webhook/cyra/order', (req, res) => {
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
  
  const io = require('./services/socket').getIO();
  io.emit('order:new', newOrder);
  
  res.status(201).json({ success: true, order: newOrder });
});

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

// Debug endpoint to see all orders
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

// Initialize menu from Firebase
async function initializeMenu() {
  try {
    console.log('📥 Loading menu from Firebase...');
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
        restaurantName: item.restaurantName || 'Demo Kitchen', // Add restaurant name with fallback
        image_url: item.imageUrl,
        is_available: item.isAvailable,
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      }));
      
      // Update menuIdCounter to be higher than the highest ID
      const maxId = Math.max(...demoData.menuItems.map(item => item.id), 0);
      menuIdCounter = maxId + 1;
      
      console.log(`✅ Loaded ${demoData.menuItems.length} menu items from Firebase`);
      
      // Re-sync to Firebase to ensure all items have restaurantName
      console.log('🔄 Re-syncing menu to add missing fields...');
      await syncMenuToFirebase(demoData.menuItems);
      console.log('✅ Menu re-synced with restaurant names');
    } else {
      // No items in Firebase, create default items
      console.log('📝 No menu items in Firebase, creating defaults...');
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
      console.log('✅ Default menu items synced to Firebase');
    }
  } catch (error) {
    console.error('❌ Error loading menu from Firebase:', error);
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

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Initialize and start server
async function startServer() {
  // Initialize Socket.io FIRST
  initializeSocket(server);
  console.log('✅ Socket.io initialized');
  
  // Load menu from Firebase
  await initializeMenu();
  
  // Start Firebase listener for orders AFTER Socket.io is ready
  console.log('🔄 Setting up Firebase order listener...');
  listenToFirebaseOrders((firebaseOrder) => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📱 NEW ORDER FROM FIREBASE!');
    console.log('═══════════════════════════════════════');
    console.log('   Order ID:', firebaseOrder.orderId);
    console.log('   Customer:', firebaseOrder.customerName);
    console.log('   Phone:', firebaseOrder.customerPhone || 'N/A');
    console.log('   Email:', firebaseOrder.customerEmail || 'N/A');
    if (firebaseOrder.deliveryAddress) {
      console.log('   📍 Delivery Address:');
      console.log('      ', firebaseOrder.deliveryAddress.fullAddress || 
                  `${firebaseOrder.deliveryAddress.address}, ${firebaseOrder.deliveryAddress.city}, ${firebaseOrder.deliveryAddress.state} - ${firebaseOrder.deliveryAddress.pincode}`);
    }
    console.log('   Total: ₹', firebaseOrder.totalAmount);
    console.log('   Items:', firebaseOrder.items?.length || 0);
    console.log('   Status:', firebaseOrder.status);
    console.log('   Firebase Key:', firebaseOrder.firebaseKey);
    console.log('───────────────────────────────────────');
    
    const merchantOrder: any = convertFirebaseOrderToMerchant(firebaseOrder);
    merchantOrder.id = orderIdCounter++;
    
    demoData.orders.push(merchantOrder);
    console.log(`✅ Order added to merchant system!`);
    console.log(`📊 Total orders in system: ${demoData.orders.length}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    
    // Emit to connected clients
    try {
      const io = getIO();
      io.emit('order:new', merchantOrder);
      console.log('📡 Order broadcasted to connected clients');
    } catch (error) {
      console.error('❌ Error broadcasting order:', error);
    }
  });
  
  // Start server
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running in DEMO MODE on port ${PORT}`);
    console.log(`🔥 Firebase integration: ACTIVE`);
    console.log(`📊 Database: ${process.env.FIREBASE_DATABASE_URL}`);
    console.log(`📋 Menu items loaded: ${demoData.menuItems.length}`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: admin@kitchen.com`);
    console.log(`   Password: admin123\n`);
  });
}

// Start the server
startServer();
