const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const rawUploadDir = process.env.UPLOAD_DIR || './uploads';
const UPLOAD_DIR = path.isAbsolute(rawUploadDir)
  ? rawUploadDir
  : path.resolve(__dirname, '..', rawUploadDir);
const MAX_SIZE_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB || '50');

function getPagination(req, defaultPageSize = 50, maxPageSize = 200) {
  const pageRaw = Number(req.query.page);
  const pageSizeRaw = Number(req.query.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), maxPageSize)
    : defaultPageSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function hasPaginationQuery(req) {
  return req.query.page !== undefined || req.query.pageSize !== undefined;
}

// Ensure upload directories exist
['images', 'audio'].forEach(dir => {
  fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAudio = file.mimetype.startsWith('audio/');
    cb(null, path.join(UPLOAD_DIR, isAudio ? 'audio' : 'images'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }
});

// ─── Upload media file ────────────────────────────────────────────────────────
router.post('/upload', requireAuth, requireRole('teacher', 'admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const isAudio = req.file.mimetype.startsWith('audio/');
  const subDir = isAudio ? 'audio' : 'images';
  const url = `/uploads/${subDir}/${req.file.filename}`;

  const db = getDB();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO media_files (id, filename, original_name, mime_type, size_bytes, uploaded_by, url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
    req.user.userId || null, url);

  res.json({
    id,
    url,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    type: isAudio ? 'audio' : 'image'
  });
});

// ─── List media (teacher) ──────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const { page, pageSize, offset } = getPagination(req);
  const whereClause = req.user.role === 'admin' ? '' : 'WHERE m.uploaded_by = ?';
  const params = req.user.role === 'admin' ? [] : [req.user.userId];
  const files = db.prepare(`
    SELECT m.*, u.name as uploader_name
    FROM media_files m
    LEFT JOIN users u ON u.id = m.uploaded_by
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  if (!hasPaginationQuery(req)) return res.json(files);

  const total = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM media_files m
    ${whereClause}
  `).get(...params).cnt || 0;
  res.json({ data: files, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});

// ─── Delete media ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const file = db.prepare('SELECT * FROM media_files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (file.uploaded_by !== req.user.userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const isAudio = file.mime_type.startsWith('audio/');
  const safeFilename = path.basename(file.filename || '');
  if (!safeFilename || safeFilename !== file.filename) {
    return res.status(400).json({ error: 'Invalid stored filename' });
  }
  const filePath = path.join(UPLOAD_DIR, isAudio ? 'audio' : 'images', safeFilename);

  try {
    db.prepare('DELETE FROM media_files WHERE id = ?').run(req.params.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
