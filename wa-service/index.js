// ============================================================
// wa-service/index.js
// Express REST API for WhatsApp session management.
// Auth: Bearer token from WA_SERVICE_SECRET env var.
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  restoreConnectedGyms,
} from './socket-manager.js';
import './worker.js'; // start Bull worker

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL ?? '*' }));

// ──────────────────────────── Auth middleware ─────────────────

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.WA_SERVICE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ──────────────────────────── Health ─────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ──────────────────────────── Connect ─────────────────────────
// POST /gym/:gymId/connect
// Starts QR pairing for a gym. Frontend polls /status to get QR.

app.post('/gym/:gymId/connect', authenticate, async (req, res) => {
  const { gymId } = req.params;
  try {
    await connectSocket(gymId);
    res.json({ ok: true, message: 'Socket connecting — poll /status for QR' });
  } catch (err) {
    console.error('[API] connect error:', err.message);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ error: isDev ? err.message : 'Failed to connect' });
  }
});

// ──────────────────────────── Status ─────────────────────────
// GET /gym/:gymId/status
// Returns connection status and QR code (if available).

app.get('/gym/:gymId/status', authenticate, async (req, res) => {
  const { gymId } = req.params;
  const sock = getSocket(gymId);

  // Read latest from Supabase (source of truth for status/QR)
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data } = await sb
    .from('wa_sessions')
    .select('status, qr_code, phone_number, connected_at')
    .eq('gym_id', gymId)
    .single();

  res.json({
    gymId,
    socketActive: !!sock,
    status: data?.status ?? 'disconnected',
    qrCode: data?.qr_code ?? null,
    phoneNumber: data?.phone_number ?? null,
    connectedAt: data?.connected_at ?? null,
  });
});

// ──────────────────────────── Disconnect ─────────────────────
// POST /gym/:gymId/disconnect

app.post('/gym/:gymId/disconnect', authenticate, async (req, res) => {
  const { gymId } = req.params;
  try {
    await disconnectSocket(gymId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── Send message (manual) ──────────
// POST /gym/:gymId/send
// Body: { phone: "923001234567", message: "Hello" }

app.post('/gym/:gymId/send', authenticate, async (req, res) => {
  const { gymId } = req.params;
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' });
  }
  // Validate E.164 without +: 10-15 digits, numeric only
  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'phone must be 10-15 digits, numeric only (no + or spaces)' });
  }
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4096) {
    return res.status(400).json({ error: 'message must be a non-empty string (max 4096 chars)' });
  }
  const sock = getSocket(gymId);
  if (!sock) {
    return res.status(503).json({ error: 'WhatsApp not connected for this gym' });
  }
  try {
    const jid = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    res.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ error: isDev ? err.message : 'Failed to send message' });
  }
});

// ──────────────────────────── Start ──────────────────────────

const PORT = process.env.PORT ?? process.env.WA_PORT ?? 3001;

app.listen(PORT, async () => {
  console.log(`[WA Service] Listening on port ${PORT}`);
  // Restore previously connected gyms after restart
  await restoreConnectedGyms();
});

// Keep-alive: ping self every 10 min to prevent Render free-tier sleep
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
  }, 10 * 60 * 1000);
}
