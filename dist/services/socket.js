"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
let io;
const initializeSocket = (server) => {
    // Allow both development and production origins
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5000',
    ];
    // In production, also allow the same origin (combined deployment)
    if (process.env.NODE_ENV === 'production') {
        // Allow requests from same origin (combined deployment)
        allowedOrigins.push('*');
    }
    io = new socket_io_1.Server(server, {
        cors: {
            origin: allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        path: '/socket.io',
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            console.log('🔌 Socket connected (no auth token - demo mode)');
            return next();
        }
        try {
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                console.error('❌ JWT_SECRET not configured');
                return next(new Error('Server configuration error'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            socket.data.user = decoded;
            console.log('🔌 Socket connected (authenticated):', decoded.email);
            next();
        }
        catch (error) {
            // Token is invalid but allow connection in demo mode
            console.log('🔌 Socket connected (invalid token - demo mode)');
            next();
        }
    });
    io.on('connection', (socket) => {
        console.log('✅ Client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('👋 Client disconnected:', socket.id);
        });
    });
    console.log('🔌 Socket.io initialized successfully');
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
exports.getIO = getIO;
