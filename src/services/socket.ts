import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer;

export const initializeSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
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
      
      const decoded = jwt.verify(token, jwtSecret);
      socket.data.user = decoded;
      console.log('🔌 Socket connected (authenticated):', (decoded as any).email);
      next();
    } catch (error) {
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

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
