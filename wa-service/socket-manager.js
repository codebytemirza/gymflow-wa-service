// ============================================================
// wa-service/socket-manager.js
// Core Baileys socket manager — one socket per gym.
// Handles QR, connection lifecycle, reconnect, and session
// persistence via Redis auth state.
// ============================================================
import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestWaWebVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import supabase from './lib/supabase.js';
import { useRedisAuthState, clearAuthState } from './lib/auth-state.js';

// Map of gymId → active socket
const sockets = new Map();

// Always silent — pino JSON blobs are too noisy in the console
const logger = pino({ level: 'silent' });

/**
 * Update wa_sessions table in Supabase.
 */
async function updateSession(gymId, patch) {
  await supabase.from('wa_sessions').update(patch).eq('gym_id', gymId);
}

/**
 * Wipe Redis auth state for a gym.
 */
async function clearAuthFiles(gymId) {
  await clearAuthState(gymId);
}

/**
 * Connect (or reconnect) a gym's WhatsApp socket.
 * @param {string} gymId
 */
export async function connectSocket(gymId) {
  if (sockets.has(gymId)) {
    try { sockets.get(gymId).end(); } catch {}
    sockets.delete(gymId);
  }

  const { state, saveCreds } = await useRedisAuthState(gymId);
  const { version, isLatest } = await fetchLatestWaWebVersion();
  console.log(`[WA:${gymId.slice(0, 8)}] Using WA v${version.join('.')} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined,
  });

  sockets.set(gymId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrBase64 = await QRCode.toDataURL(qr);
        await updateSession(gymId, {
          status: 'connecting',
          qr_code: qrBase64,
          phone_number: null,
        });
        console.log(`[WA:${gymId.slice(0, 8)}] New QR generated`);
      } catch (err) {
        console.error(`[WA:${gymId.slice(0, 8)}] QR error:`, err.message);
      }
    }

    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] ?? null;
      await updateSession(gymId, {
        status: 'connected',
        phone_number: phone,
        qr_code: null,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
      });
      console.log(`[WA:${gymId.slice(0, 8)}] Connected as ${phone}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode === DisconnectReason.restartRequired;

      console.log(
        `[WA:${gymId.slice(0, 8)}] Disconnected (${statusCode}) — autoReconnect: ${shouldReconnect}`
      );

      await updateSession(gymId, {
        status: 'disconnected',
        qr_code: null,
        disconnected_at: new Date().toISOString(),
      });

      sockets.delete(gymId);

      if (shouldReconnect) {
        setTimeout(() => connectSocket(gymId), 1000);
      } else {
        clearAuthFiles(gymId);
        console.log(`[WA:${gymId.slice(0, 8)}] Auth cleared — go to dashboard to reconnect`);
      }
    }
  });

  return sock;
}

/**
 * Disconnect a gym's socket and clear auth state.
 * @param {string} gymId
 */
export async function disconnectSocket(gymId) {
  if (sockets.has(gymId)) {
    try { sockets.get(gymId).logout(); } catch {}
    sockets.delete(gymId);
  }
  clearAuthFiles(gymId);
  await updateSession(gymId, {
    status: 'disconnected',
    qr_code: null,
    phone_number: null,
    disconnected_at: new Date().toISOString(),
  });
}

/**
 * Get the active socket for a gym (or null).
 * @param {string} gymId
 */
export function getSocket(gymId) {
  return sockets.get(gymId) ?? null;
}

/**
 * Send a text WhatsApp message to a phone number.
 * Phone must be in E.164 format without '+': e.g. "923001234567"
 * @param {string} gymId
 * @param {string} phone
 * @param {string} text
 */
export async function sendTextMessage(gymId, phone, text) {
  const sock = getSocket(gymId);
  if (!sock) throw new Error(`No active socket for gym ${gymId}`);

  // WhatsApp JID format: number@s.whatsapp.net
  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

/**
 * Restore all previously connected gyms on service startup.
 * Reads wa_sessions where status = 'connected' and reconnects.
 */
export async function restoreConnectedGyms() {
  const { data: sessions } = await supabase
    .from('wa_sessions')
    .select('gym_id, status')
    .eq('status', 'connected');

  if (!sessions?.length) return;

  console.log(`[WA] Restoring ${sessions.length} connected session(s)…`);
  for (const { gym_id } of sessions) {
    try { await connectSocket(gym_id); } catch (e) {
      console.error(`[WA] Failed to restore ${gym_id}:`, e.message);
    }
  }
}
