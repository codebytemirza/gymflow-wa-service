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
import { validatePhone } from './lib/phone-utils.js';

// Map of gymId → active socket
const sockets = new Map();

// Logger with proper configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'warn',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

// Rate limiting configuration (WhatsApp limits: ~100 messages/hour for business)
const RATE_LIMIT_CONFIG = {
  maxMessages: parseInt(process.env.WA_RATE_LIMIT_MAX || '100', 10),
  windowMs: parseInt(process.env.WA_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour default
};

// Track message counts per gym: Map<gymId, { count, resetTime }>
const rateLimitTracker = new Map();

/**
 * Check and update rate limit for a gym.
 * @param {string} gymId
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
function checkRateLimit(gymId) {
  const now = Date.now();
  const tracker = rateLimitTracker.get(gymId);

  if (!tracker || now > tracker.resetTime) {
    // Reset window
    rateLimitTracker.set(gymId, {
      count: 0,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxMessages,
      resetIn: RATE_LIMIT_CONFIG.windowMs,
    };
  }

  const remaining = RATE_LIMIT_CONFIG.maxMessages - tracker.count;
  const resetIn = tracker.resetTime - now;

  if (tracker.count >= RATE_LIMIT_CONFIG.maxMessages) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

/**
 * Increment message count for a gym.
 * @param {string} gymId
 */
function incrementMessageCount(gymId) {
  const tracker = rateLimitTracker.get(gymId);
  if (tracker) {
    tracker.count++;
  }
}

/**
 * Update wa_sessions table in Supabase.
 */
async function updateSession(gymId, patch) {
  const { error } = await supabase.from('wa_sessions').update(patch).eq('gym_id', gymId);
  if (error) {
    logger.error({ gymId, error: error.message }, 'Failed to update session');
  }
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

      logger.info(
        { gymId: gymId.slice(0, 8), statusCode, shouldReconnect },
        `Disconnected — autoReconnect: ${shouldReconnect}`
      );

      // Ban detection: 401 (Unauthorized) or 403 (Forbidden) usually means banned
      if (statusCode === 401 || statusCode === 403) {
        logger.error({ gymId: gymId.slice(0, 8), statusCode }, 'WhatsApp ban detected!');
        await updateSession(gymId, {
          status: 'banned',
          qr_code: null,
          disconnected_at: new Date().toISOString(),
        });
        sockets.delete(gymId);
        clearAuthFiles(gymId);
        console.log(`[WA:${gymId.slice(0, 8)}] ⚠️  BAN DETECTED — WhatsApp has banned this number!`);
        return;
      }

      // Connection lost — try to reconnect
      if (shouldReconnect) {
        await updateSession(gymId, {
          status: 'connecting',
          qr_code: null,
        });
        setTimeout(() => connectSocket(gymId), 1000);
        return;
      }

      // Full disconnect — clear auth and require re-pairing
      await updateSession(gymId, {
        status: 'disconnected',
        qr_code: null,
        disconnected_at: new Date().toISOString(),
      });

      sockets.delete(gymId);
      clearAuthFiles(gymId);
      console.log(`[WA:${gymId.slice(0, 8)}] Auth cleared — go to dashboard to reconnect`);
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
 * Phone number is validated and normalized automatically.
 * Implements rate limiting to prevent WhatsApp bans.
 *
 * @param {string} gymId
 * @param {string} phone - Phone number (any format, will be normalized)
 * @param {string} text - Message text
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, rateLimit?: object }>}
 */
export async function sendTextMessage(gymId, phone, text) {
  const sock = getSocket(gymId);
  if (!sock) {
    logger.error({ gymId }, 'No active socket for gym');
    return { success: false, error: 'No active socket for this gym' };
  }

  // Validate phone number
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) {
    logger.warn({ gymId, phone, error: phoneValidation.error }, 'Invalid phone number');
    return { success: false, error: phoneValidation.error };
  }
  const normalizedPhone = phoneValidation.normalized;

  // Check rate limit
  const rateLimit = checkRateLimit(gymId);
  if (!rateLimit.allowed) {
    const resetMinutes = Math.ceil(rateLimit.resetIn / 60000);
    logger.warn({ gymId, resetIn: rateLimit.resetIn }, 'Rate limit exceeded');
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${resetMinutes} minute(s).`,
      rateLimit: {
        remaining: 0,
        resetIn: rateLimit.resetIn,
        resetMinutes,
      },
    };
  }

  try {
    // WhatsApp JID format: number@s.whatsapp.net
    const jid = `${normalizedPhone}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text });

    // Increment message count after successful send
    incrementMessageCount(gymId);

    logger.info(
      { gymId, phone: normalizedPhone.slice(0, 6) + '...', messageId: result?.key?.id },
      'Message sent successfully'
    );

    return {
      success: true,
      messageId: result?.key?.id,
      rateLimit: {
        remaining: RATE_LIMIT_CONFIG.maxMessages - (rateLimitTracker.get(gymId)?.count || 0),
        resetIn: rateLimit.resetIn,
      },
    };
  } catch (err) {
    logger.error(
      { gymId, phone: normalizedPhone, error: err.message, stack: err.stack },
      'Failed to send message'
    );

    // Check for specific error types
    if (err.message?.includes('rate-overlimit')) {
      return {
        success: false,
        error: 'WhatsApp rate limit exceeded. Please wait before sending more messages.',
      };
    }

    if (err.message?.includes('not-authorized') || err.message?.includes('auth-revoked')) {
      // Mark session as disconnected
      await updateSession(gymId, { status: 'disconnected' });
      return {
        success: false,
        error: 'WhatsApp session expired. Please reconnect.',
      };
    }

    return { success: false, error: err.message };
  }
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
