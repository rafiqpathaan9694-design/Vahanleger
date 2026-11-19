import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');

fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

interface PartnerShare {
  id: string;
  name: string;
  percentage: number;
}

interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

interface StoredVehicleRecord {
  id: string;
  vehicleNumber: string;
  customerName: string;
  customerPhone?: string;
  bankName: string;
  notes?: string;
  partnerCount: number;
  partners: PartnerShare[];
  dateTime: string;
  mediaAttachments: MediaAttachment[];
  createdAt: number;
  updatedAt: number;
}

interface MediaMeta {
  id: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  ext: string;
  createdAt: number;
}

function isSafeSegment(val: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(val);
}

function readVehicles(): StoredVehicleRecord[] {
  if (!fs.existsSync(VEHICLES_FILE)) return [];
  try {
    const raw = fs.readFileSync(VEHICLES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as StoredVehicleRecord[]).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  } catch {
    return [];
  }
}

function writeVehicles(records: StoredVehicleRecord[]): void {
  const tempPath = `${VEHICLES_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tempPath, VEHICLES_FILE);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max per media file
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

function getExtFromMime(mimeType: string, originalName: string): string {
  const extFromName = path.extname(originalName).toLowerCase();
  if (extFromName && /^[a-z0-9.]{2,8}$/i.test(extFromName)) {
    return extFromName;
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/quicktime') return '.mov';
  return mimeType.startsWith('video/') ? '.mp4' : '.jpg';
}

function deleteMediaFileById(mediaId: string): void {
  if (!isSafeSegment(mediaId)) return;
  const metaPath = path.join(UPLOADS_ROOT, `${mediaId}.meta.json`);
  if (!fs.existsSync(metaPath)) return;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as MediaMeta;
    const filePath = path.join(UPLOADS_ROOT, `${mediaId}${meta.ext}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore corrupted metadata
  }
  fs.unlinkSync(metaPath);
}

function sanitizeVehicleBody(body: unknown): Omit<StoredVehicleRecord, 'id' | 'createdAt' | 'updatedAt'> | string {
  if (!body || typeof body !== 'object') return 'Invalid request payload';
  const raw = body as Record<string, unknown>;

  const vehicleNumber =
    typeof raw.vehicleNumber === 'string'
      ? raw.vehicleNumber.trim().toUpperCase().slice(0, 32)
      : '';
  const customerName =
    typeof raw.customerName === 'string'
      ? raw.customerName.trim().slice(0, 120)
      : '';
  const bankName =
    typeof raw.bankName === 'string' ? raw.bankName.trim().slice(0, 100) : '';
  const dateTime =
    typeof raw.dateTime === 'string' ? raw.dateTime.trim().slice(0, 32) : '';

  if (vehicleNumber.length < 2) return 'Vehicle Number is required';
  if (!customerName) return 'Customer Name is required';
  if (!bankName) return 'Finance Bank Name is required';
  if (!dateTime) return 'Date & Time is required';

  const customerPhone =
    typeof raw.customerPhone === 'string' && raw.customerPhone.trim()
      ? raw.customerPhone.trim().slice(0, 24)
      : undefined;
  const notes =
    typeof raw.notes === 'string' && raw.notes.trim()
      ? raw.notes.trim().slice(0, 1000)
      : undefined;

  const rawPartners = Array.isArray(raw.partners) ? raw.partners : [];
  if (rawPartners.length < 1 || rawPartners.length > 10) {
    return 'Partners must be between 1 and 10';
  }

  const partners: PartnerShare[] = rawPartners.slice(0, 10).map((p, idx) => {
    const item = (p ?? {}) as Record<string, unknown>;
    return {
      id:
        typeof item.id === 'string' && item.id
          ? item.id.slice(0, 64)
          : crypto.randomUUID(),
      name:
        typeof item.name === 'string' && item.name.trim()
          ? item.name.trim().slice(0, 100)
          : `Partner ${idx + 1}`,
      percentage: Number(item.percentage) || 0,
    };
  });

  const rawMedia = Array.isArray(raw.mediaAttachments)
    ? raw.mediaAttachments
    : [];
  const mediaAttachments: MediaAttachment[] = rawMedia
    .slice(0, 20)
    .map((m): MediaAttachment => {
      const item = (m ?? {}) as Record<string, unknown>;
      return {
        id: typeof item.id === 'string' ? item.id.slice(0, 128) : '',
        type: item.type === 'video' ? 'video' : 'image',
        name:
          typeof item.name === 'string'
            ? item.name.slice(0, 120)
            : 'attachment',
        mimeType:
          typeof item.mimeType === 'string'
            ? item.mimeType.slice(0, 64)
            : 'application/octet-stream',
        size: Number(item.size) || 0,
        url: typeof item.url === 'string' ? item.url.slice(0, 256) : '',
      };
    })
    .filter((m) => m.id && m.url);

  return {
    vehicleNumber,
    customerName,
    ...(customerPhone ? { customerPhone } : {}),
    bankName,
    ...(notes ? { notes } : {}),
    partnerCount: partners.length,
    partners,
    dateTime,
    mediaAttachments,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Vehicle Records REST API (Login-free server persistence)
  app.get('/api/vehicles', (_req: Request, res: Response) => {
    res.json({ records: readVehicles() });
  });

  app.post('/api/vehicles', (req: Request, res: Response) => {
    const parsed = sanitizeVehicleBody(req.body);
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed });
      return;
    }

    const now = Date.now();
    const rawId =
      typeof (req.body as Record<string, unknown>)?.id === 'string'
        ? ((req.body as Record<string, unknown>).id as string)
        : '';
    const id = isSafeSegment(rawId) ? rawId : crypto.randomUUID();

    const record: StoredVehicleRecord = {
      id,
      ...parsed,
      createdAt: now,
      updatedAt: now,
    };

    const existing = readVehicles().filter((r) => r.id !== id);
    writeVehicles([record, ...existing]);
    res.status(201).json({ record });
  });

  app.put('/api/vehicles/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isSafeSegment(id)) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const parsed = sanitizeVehicleBody(req.body);
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed });
      return;
    }

    const existingList = readVehicles();
    const prev = existingList.find((r) => r.id === id);
    const now = Date.now();

    const updated: StoredVehicleRecord = {
      id,
      ...parsed,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };

    const nextList = [updated, ...existingList.filter((r) => r.id !== id)];
    writeVehicles(nextList);
    res.json({ record: updated });
  });

  app.delete('/api/vehicles/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isSafeSegment(id)) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const existingList = readVehicles();
    const target = existingList.find((r) => r.id === id);
    if (target) {
      for (const att of target.mediaAttachments) {
        deleteMediaFileById(att.id);
      }
    }

    writeVehicles(existingList.filter((r) => r.id !== id));
    res.json({ deleted: true });
  });

  // Media Upload / Stream / Delete API
  app.post(
    '/api/media',
    upload.single('file'),
    (req: Request, res: Response) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No media file uploaded' });
        return;
      }

      const mediaId = crypto.randomUUID();
      const ext = getExtFromMime(file.mimetype, file.originalname);
      const filePath = path.join(UPLOADS_ROOT, `${mediaId}${ext}`);
      const metaPath = path.join(UPLOADS_ROOT, `${mediaId}.meta.json`);

      const type: 'image' | 'video' = file.mimetype.startsWith('video/')
        ? 'video'
        : 'image';

      const meta: MediaMeta = {
        id: mediaId,
        type,
        name: file.originalname.slice(0, 120) || `${type}-${mediaId}${ext}`,
        mimeType: file.mimetype,
        size: file.size,
        ext,
        createdAt: Date.now(),
      };

      fs.writeFileSync(filePath, file.buffer);
      fs.writeFileSync(metaPath, JSON.stringify(meta));

      res.status(201).json({
        id: meta.id,
        type: meta.type,
        name: meta.name,
        mimeType: meta.mimeType,
        size: meta.size,
        url: `/api/media/${meta.id}`,
      });
    }
  );

  app.get('/api/media/:mediaId', (req: Request, res: Response) => {
    const { mediaId } = req.params;
    if (!isSafeSegment(mediaId)) {
      res.status(400).json({ error: 'Invalid media identifier' });
      return;
    }

    const metaPath = path.join(UPLOADS_ROOT, `${mediaId}.meta.json`);
    if (!fs.existsSync(metaPath)) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as MediaMeta;
    const filePath = path.join(UPLOADS_ROOT, `${mediaId}${meta.ext}`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Media file missing' });
      return;
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (Number.isNaN(start) || start >= stat.size || end >= stat.size) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': meta.mimeType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': meta.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  app.delete('/api/media/:mediaId', (req: Request, res: Response) => {
    const { mediaId } = req.params;
    if (!isSafeSegment(mediaId)) {
      res.status(400).json({ error: 'Invalid media identifier' });
      return;
    }
    deleteMediaFileById(mediaId);
    res.json({ deleted: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VahanLedger server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
