import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import routes
import financialRoutes from './routes/financial.js';
import uploadRoutes from './routes/upload.js';
import reportRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';

// Import database connection
import connectDB from './config/database.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploaded files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// API Routes
app.use('/api/financial', financialRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id} (${socket.handshake.address})`);
    console.log(`Connection details:`, {
        transport: socket.conn.transport.name,
        secure: socket.conn.secure,
        headers: socket.handshake.headers
    });

    // Send immediate confirmation to client
    socket.emit('connection-confirmed', {
        id: socket.id,
        timestamp: new Date().toISOString(),
        message: 'Connected to Financial Dashboard WebSocket'
    });

    socket.on('join-dashboard', (userId) => {
        socket.join(`dashboard-${userId}`);
        console.log(`User ${userId} joined dashboard room`);
    });

    socket.on('test-connection', () => {
        console.log(`Test connection received from ${socket.id}`);
        socket.emit('test-response', { message: 'Test successful', timestamp: new Date() });
    });

    socket.on('disconnect', (reason) => {
        console.log(`❌ Client disconnected: ${socket.id} (Reason: ${reason})`);
    });

    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

// Make io accessible to routes
app.set('io', io);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
            console.log(`Real-time WebSocket server initialized`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;