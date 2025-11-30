import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { inngestServe } from './inngest/serve.js';
import generateRoute from './routes/generate.route.js';
import generateStreamRoute from './routes/generate-stream.route.js';
import paymentRoute from './routes/payment.route.js';
import healthRoute from './routes/health.route.js';
import nodesRoute from './routes/nodes.route.js';
import chatRoute from './routes/chat.route.js';
import persistenceRoute from './routes/persistence.route.js';
import executeRoute from './routes/workflow/execute.route.js';
import chatMessagesRoute from './routes/chat/messages.route.js';
import workflowSaveRoute from './routes/workflow/save.route.js';
import prisma from './utils/prisma.js';

const app = express();

// ============================================================================
// Middleware
// ============================================================================

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

app.use('/health', healthRoute);
app.use('/api/generate', generateRoute);
app.use('/api/workflow/stream', generateStreamRoute); // Separate endpoint to avoid conflicts
app.use('/api/workflow', executeRoute); // Workflow execution
app.use('/api/workflows', workflowSaveRoute); // Workflow save/load
app.use('/api/payment', paymentRoute);
app.use('/api/nodes', nodesRoute);
app.use('/api/chat', chatRoute);
app.use('/api/chat', chatMessagesRoute); // Chat message persistence
app.use('/api/workflows', persistenceRoute);
app.use('/api/chat', persistenceRoute);

// Inngest endpoint
app.use('/api/inngest', inngestServe);

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log('🚀 AptosFlow AI Agent API Server');
  console.log('================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Aptos Network: ${config.aptosNetwork}`);
  console.log(`💰 Payment Amount: ${config.aptosPaymentAmount} octas`);
  console.log(`🤖 AI Model: ${config.aiModel}`);
  console.log('================================');
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Generate API: http://localhost:${PORT}/api/generate`);
  console.log(`Payment API: http://localhost:${PORT}/api/payment`);
  console.log(`Nodes API: http://localhost:${PORT}/api/nodes`);
  console.log(`Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`Inngest: http://localhost:${PORT}/api/inngest`);
  console.log('================================');
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      console.log('Database connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
