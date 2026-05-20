require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const worksheetRoutes = require('./routes/worksheets');
const submissionRoutes = require('./routes/submissions');
const mediaRoutes = require('./routes/media');
const teamsRoutes = require('./routes/teams');
const classRoutes = require('./routes/classes');
const { initDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Handled by nginx in prod
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  const host = req.header('Host');
  
  const allowedOrigins = [
    process.env.BASE_URL,
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  
  let isAllowed = false;
  if (!origin) {
    isAllowed = true;
  } else if (allowedOrigins.includes(origin)) {
    isAllowed = true;
  } else {
    // In production, Nginx proxies the frontend and backend on the same host & port.
    // If the Origin's host matches the request's Host header, it is same-origin.
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        isAllowed = true;
      }
    } catch (e) {
      isAllowed = false;
    }
  }
  
  if (isAllowed) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

app.use(cors(corsOptionsDelegate));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use(limiter);

// Serve uploaded media files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/worksheets', worksheetRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/classes', classRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});

// Serve Vue frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Init DB then start
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ LearnFlow backend running on port ${PORT}`);
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
