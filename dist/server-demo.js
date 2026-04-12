"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const socket_1 = require("./services/socket");
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const firebase_1 = require("./services/firebase");
const logger_1 = __importStar(require("./utils/logger"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const sanitizer_1 = require("./middleware/sanitizer");
const securityAudit_1 = require("./middleware/securityAudit");
const validator_1 = require("./middleware/validator");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 5000;
// Trust proxy - important for rate limiting behind reverse proxy
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
}));
// Compression middleware
app.use((0, compression_1.default)());
// ✅ CORS (FIXED)
const allowedOrigins = [
    "https://cyra-merchant.vercel.app",
    "https://cyra-frontend.vercel.app",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])
].filter((o) => Boolean(o));
logger_1.default.info('CORS allowed origins configured', { origins: allowedOrigins });
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
        if (isAllowed) {
            callback(null, true);
        }
        else {
            logger_1.default.warn("Blocked Origin", { origin, allowedOrigins });
            (0, logger_1.logSecurity)('CORS blocked origin', { origin, ip: 'unknown' });
            callback(new Error("CORS not allowed"));
        }
    },
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Sanitize data
app.use((0, express_mongo_sanitize_1.default)());
app.use(sanitizer_1.sanitizeInput);
// Request ID and logging
app.use(requestLogger_1.addRequestId);
app.use(requestLogger_1.requestLogger);
app.use(requestLogger_1.enhancedRequestLogger);
// Security audit
app.use(securityAudit_1.securityAudit);
// Static files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend/dist')));
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
    orders: [],
    menuItems: [] // Will be loaded from Firebase
};
let orderIdCounter = 1;
let menuIdCounter = 1;
// Auth middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    logger_1.default.debug('Authentication attempt', {
        hasToken: !!token,
        ip: req.ip,
        path: req.path,
        requestId: req.requestId,
    });
    if (!token) {
        (0, logger_1.logSecurity)('No token provided', {
            ip: req.ip,
            path: req.path,
            requestId: req.requestId,
        });
        return next(new errorHandler_1.AppError('No token provided', 401));
    }
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger_1.default.error('JWT_SECRET not configured in environment!');
            return next(new errorHandler_1.AppError('Server configuration error', 500));
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = decoded;
        // Get user details including restaurant name
        const user = demoData.users.find(u => u.id === decoded.id);
        if (user && req.user) {
            req.user.restaurantName = user.restaurantName;
            logger_1.default.debug('User authenticated', {
                email: user.email,
                role: user.role,
                requestId: req.requestId,
            });
        }
        else {
            (0, logger_1.logSecurity)('Token valid but user not found', {
                userId: decoded.id,
                requestId: req.requestId,
            });
        }
        next();
    }
    catch (error) {
        (0, logger_1.logSecurity)('Token verification failed', {
            error: error.message,
            ip: req.ip,
            requestId: req.requestId,
        });
        return next(new errorHandler_1.AppError('Invalid token', 401));
    }
};
// Routes
app.post('/api/auth/google', rateLimiter_1.authLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, name, googleId } = req.body;
    logger_1.default.info('Google OAuth attempt', { email });
    // Check if user exists
    let user = demoData.users.find(u => u.email === email);
    if (user) {
        // User exists - login
        logger_1.default.info('Existing user login', { email });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
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
    }
    else {
        // New user - return flag to show signup form
        logger_1.default.info('New Google user needs signup', { email });
        return res.json({
            isNewUser: true,
            email,
            name,
            googleId,
        });
    }
}));
app.post('/api/auth/google-signup', rateLimiter_1.authLimiter, validator_1.validateGoogleSignup, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, role, restaurantName, googleId } = req.body;
    logger_1.default.info('Google signup', { email, role });
    // Check if user already exists
    const existingUser = demoData.users.find(u => u.email === email);
    if (existingUser) {
        throw new errorHandler_1.AppError('User already exists with this email', 400);
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
    const token = jsonwebtoken_1.default.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    logger_1.default.info('New Google user registered', { name, email, role });
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
app.post('/api/auth/login', rateLimiter_1.authLimiter, validator_1.validateLogin, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip || 'unknown';
    // Check if IP is blocked
    if ((0, securityAudit_1.isIpBlocked)(ip)) {
        (0, logger_1.logAuthAttempt)(email, false, ip, { reason: 'IP blocked' });
        throw new errorHandler_1.AppError('Too many failed attempts. Please try again later.', 429);
    }
    logger_1.default.info('Login attempt', { email, ip, requestId: req.requestId });
    const user = demoData.users.find(u => u.email === email);
    if (!user) {
        (0, securityAudit_1.trackAuthFailure)(ip);
        (0, logger_1.logAuthAttempt)(email, false, ip, { reason: 'User not found' });
        throw new errorHandler_1.AppError('Invalid credentials', 401);
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!isValidPassword) {
        (0, securityAudit_1.trackAuthFailure)(ip);
        (0, logger_1.logAuthAttempt)(email, false, ip, { reason: 'Invalid password' });
        throw new errorHandler_1.AppError('Invalid credentials', 401);
    }
    // Clear failed attempts on successful login
    (0, securityAudit_1.clearAuthFailures)(ip);
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    (0, logger_1.logAuthAttempt)(email, true, ip, { role: user.role });
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
app.post('/api/auth/signup', rateLimiter_1.authLimiter, validator_1.validateSignup, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, role, restaurantName } = req.body;
    // Check if user already exists
    const existingUser = demoData.users.find(u => u.email === email);
    if (existingUser) {
        throw new errorHandler_1.AppError('User already exists with this email', 400);
    }
    // Hash password
    const password_hash = await bcryptjs_1.default.hash(password, 10);
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
    const token = jsonwebtoken_1.default.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    logger_1.default.info('New user registered', { name, email, role });
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
app.get('/api/dashboard/stats', authenticate, rateLimiter_1.apiLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    logger_1.default.debug('Dashboard stats requested');
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
    logger_1.default.debug('Stats calculated', {
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
app.get('/api/orders', authenticate, rateLimiter_1.apiLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status } = req.query;
    let orders = demoData.orders;
    if (status) {
        orders = orders.filter(o => o.status === status);
    }
    logger_1.default.debug('Orders fetched', { count: orders.length, status });
    res.json(orders.reverse());
}));
app.put('/api/orders/:id/status', authenticate, rateLimiter_1.apiLimiter, validator_1.validateOrderStatus, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const order = demoData.orders.find(o => o.id === parseInt(id));
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    order.status = status;
    order.updated_at = new Date().toISOString();
    // Update in Firebase if it has a firebase_key
    if (order.firebase_key) {
        (0, firebase_1.updateFirebaseOrderStatus)(order.firebase_key, status);
    }
    const io = (0, socket_1.getIO)();
    io.emit('order:updated', order);
    logger_1.default.info('Order status updated', { orderId: id, status });
    res.json(order);
}));
app.post('/api/orders/:id/cancel', authenticate, rateLimiter_1.apiLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const order = demoData.orders.find(o => o.id === parseInt(id));
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    order.status = 'cancelled';
    order.updated_at = new Date().toISOString();
    // Update in Firebase if it has a firebase_key
    if (order.firebase_key) {
        (0, firebase_1.updateFirebaseOrderStatus)(order.firebase_key, 'cancelled');
    }
    const io = (0, socket_1.getIO)();
    io.emit('order:updated', order);
    logger_1.default.info('Order cancelled', { orderId: id });
    res.json(order);
}));
app.get('/api/menu', authenticate, rateLimiter_1.apiLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    logger_1.default.debug('Menu items fetched', {
        count: demoData.menuItems.length,
        requestId: req.requestId,
    });
    res.json(demoData.menuItems);
}));
app.post('/api/menu', authenticate, rateLimiter_1.menuLimiter, validator_1.validateMenuItem, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, description, price, category, is_available, phase } = req.body;
    logger_1.default.info('Creating new menu item', { name, category });
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
    (0, firebase_1.syncMenuToFirebase)(demoData.menuItems);
    const io = (0, socket_1.getIO)();
    io.emit('menu:updated', { action: 'create', item: newItem });
    logger_1.default.info('Menu item created', { id: newItem.id, name: newItem.name });
    res.status(201).json(newItem);
}));
app.put('/api/menu/:id', authenticate, rateLimiter_1.menuLimiter, validator_1.validateMenuItem, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, is_available, phase } = req.body;
    const item = demoData.menuItems.find(m => m.id === parseInt(id));
    if (!item) {
        throw new errorHandler_1.AppError('Menu item not found', 404);
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
    (0, firebase_1.syncMenuToFirebase)(demoData.menuItems);
    const io = (0, socket_1.getIO)();
    io.emit('menu:updated', { action: 'update', item });
    logger_1.default.info('Menu item updated', { id, name });
    res.json(item);
}));
app.delete('/api/menu/:id', authenticate, rateLimiter_1.menuLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const index = demoData.menuItems.findIndex(m => m.id === parseInt(id));
    if (index === -1) {
        throw new errorHandler_1.AppError('Menu item not found', 404);
    }
    const [item] = demoData.menuItems.splice(index, 1);
    // Sync to Firebase
    (0, firebase_1.syncMenuToFirebase)(demoData.menuItems);
    const io = (0, socket_1.getIO)();
    io.emit('menu:updated', { action: 'delete', item });
    logger_1.default.info('Menu item deleted', { id });
    res.json({ message: 'Menu item deleted' });
}));
// Webhook for demo - simulate CYRA orders
app.post('/api/webhook/cyra/order', rateLimiter_1.webhookLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { order_id, customer, items, total_amount, notes } = req.body;
    const newOrder = {
        id: orderIdCounter++,
        cyra_order_id: order_id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        status: 'pending',
        total_amount,
        customer_notes: notes,
        items: items.map((item) => ({
            id: Math.random(),
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    demoData.orders.push(newOrder);
    const io = (0, socket_1.getIO)();
    io.emit('order:new', newOrder);
    logger_1.default.info('New order received via webhook', { orderId: order_id });
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
        res.sendFile(path_1.default.join(__dirname, '../../frontend/dist/index.html'));
    });
}
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// Error handler (must be last)
app.use(errorHandler_1.errorHandler);
// Initialize menu from Firebase
async function initializeMenu() {
    try {
        logger_1.default.info('Loading menu from Firebase...');
        const firebaseMenu = await (0, firebase_1.getFirebaseMenu)();
        if (firebaseMenu && Object.keys(firebaseMenu).length > 0) {
            // Convert Firebase menu to array format
            demoData.menuItems = Object.entries(firebaseMenu).map(([id, item]) => ({
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
            logger_1.default.info(`Loaded ${demoData.menuItems.length} menu items from Firebase`);
            // Re-sync to Firebase to ensure all items have restaurantName
            await (0, firebase_1.syncMenuToFirebase)(demoData.menuItems);
            logger_1.default.info('Menu re-synced with restaurant names');
        }
        else {
            // No items in Firebase, create default items
            logger_1.default.info('No menu items in Firebase, creating defaults...');
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
            await (0, firebase_1.syncMenuToFirebase)(demoData.menuItems);
            logger_1.default.info('Default menu items synced to Firebase');
        }
    }
    catch (error) {
        logger_1.default.error('Error loading menu from Firebase', { error });
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
        (0, socket_1.initializeSocket)(server);
        logger_1.default.info('Socket.io initialized');
        // Load menu from Firebase
        await initializeMenu();
        // Start Firebase listener for orders AFTER Socket.io is ready
        logger_1.default.info('Setting up Firebase order listener...');
        (0, firebase_1.listenToFirebaseOrders)((firebaseOrder) => {
            logger_1.default.info('New order from Firebase', {
                orderId: firebaseOrder.orderId,
                customer: firebaseOrder.customerName,
                total: firebaseOrder.totalAmount,
                items: firebaseOrder.items?.length || 0,
            });
            const merchantOrder = (0, firebase_1.convertFirebaseOrderToMerchant)(firebaseOrder);
            merchantOrder.id = orderIdCounter++;
            demoData.orders.push(merchantOrder);
            logger_1.default.info('Order added to merchant system', {
                orderId: merchantOrder.id,
                totalOrders: demoData.orders.length,
            });
            // Emit to connected clients
            try {
                const io = (0, socket_1.getIO)();
                io.emit('order:new', merchantOrder);
                logger_1.default.debug('Order broadcasted to connected clients');
            }
            catch (error) {
                logger_1.default.error('Error broadcasting order', { error });
            }
        });
        // Start server
        server.listen(PORT, () => {
            logger_1.default.info(`Server running in DEMO MODE on port ${PORT}`);
            logger_1.default.info(`Firebase integration: ACTIVE`);
            logger_1.default.info(`Database: ${process.env.FIREBASE_DATABASE_URL}`);
            logger_1.default.info(`Menu items loaded: ${demoData.menuItems.length}`);
            logger_1.default.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger_1.default.info('Login credentials: admin@kitchen.com / admin123');
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server', { error });
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger_1.default.info('HTTP server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger_1.default.info('HTTP server closed');
        process.exit(0);
    });
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});
// Start the server
startServer();
