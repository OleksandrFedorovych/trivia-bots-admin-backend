/**
 * Express API Server
 * Admin Dashboard Backend API
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/index.js';

dotenv.config();

const app = express();
// Render.com provides PORT environment variable, fallback to ADMIN_PORT or 3001
const PORT = process.env.PORT || process.env.ADMIN_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import playersRoutes from './routes/players.js';
import sessionsRoutes from './routes/sessions.js';
import playerResultsRoutes from './routes/playerResults.js';
import leaguesRoutes from './routes/leagues.js';
import gptRoutes from './routes/gpt.js';

app.use('/api/players', playersRoutes);
app.use('/api/player-results', playerResultsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/gpt', gptRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 Admin API server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;

