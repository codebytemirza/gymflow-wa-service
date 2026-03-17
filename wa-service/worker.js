// ============================================================
// wa-service/worker.js
// Bull queue worker — polls Supabase reminder_queue every 30s
// and sends WhatsApp messages via the socket manager.
// Uses Bull for job management and retry logic.
// ============================================================
import Bull from 'bull';
import Redis from 'ioredis';
import supabase from './lib/supabase.js';
import { sendTextMessage } from './socket-manager.js';
import { validatePhone } from './lib/phone-utils.js';

// ──────────────────────────── Environment Validation ──────────

const requiredEnvVars = ['REDIS_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ [Worker] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('[Worker] Environment validated ✓');

// ──────────────────────────── Redis Setup ─────────────────────

// Bull needs three independent Redis connections — create fresh ones per type
function createRedisClient() {
  return new Redis(process.env.REDIS_URL, {
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: null, // required for Bull blocking commands
    enableReadyCheck: false,
  });
}

const reminderQueue = new Bull('reminder-queue', {
  createClient(type) {
    switch (type) {
      case 'client':      return createRedisClient();
      case 'subscriber':  return createRedisClient();
      case 'bclient':     return createRedisClient();
      default:            return createRedisClient();
    }
  },
});

/**
 * Process a reminder job — send WA message and mark as processed.
 */
reminderQueue.process(5 /* concurrency */, async (job) => {
  const { id, gym_id, member_id, payment_id, type, message_text, phone } = job.data;

  console.log(`[Worker] Sending ${type} to ${phone.slice(0, 6)}…`);

  // Validate phone before sending
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) {
    console.error(`[Worker] Invalid phone ${phone}: ${phoneValidation.error}`);
    throw new Error(`Invalid phone number: ${phoneValidation.error}`);
  }

  const result = await sendTextMessage(gym_id, phone, message_text);

  if (!result.success) {
    throw new Error(result.error || 'Failed to send message');
  }

  // Mark as processed in Supabase
  await supabase
    .from('reminder_queue')
    .update({ processed: true })
    .eq('id', id);

  // Log to reminder_logs with message ID for tracking
  await supabase.from('reminder_logs').insert({
    gym_id,
    member_id,
    payment_id,
    type,
    message_text,
    status: 'sent',
    wa_message_id: result.messageId,
  });

  console.log(`[Worker] ✓ Sent ${type} → ${phone.slice(0, 6)}… (ID: ${result.messageId})`);
});

reminderQueue.on('failed', async (job, err) => {
  console.error(`[Worker] ✗ Job ${job.id} failed:`, err.message);
  const { id, gym_id, member_id, payment_id, type, message_text } = job.data;

  // Only log on final failure (no more retries)
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await supabase.from('reminder_logs').insert({
      gym_id,
      member_id,
      payment_id,
      type,
      message_text,
      status: 'failed',
      error_msg: err.message.slice(0, 500),
    });

    // Mark processed so it won't be retried by the poll loop either
    await supabase
      .from('reminder_queue')
      .update({ processed: true })
      .eq('id', id);
  }
});

/**
 * Poll Supabase reminder_queue for unprocessed reminders
 * and enqueue them as Bull jobs with retry.
 */
async function pollReminderQueue() {
  const { data: items, error } = await supabase
    .from('reminder_queue')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[Worker] Poll error:', error.message);
    return;
  }
  if (!items?.length) return;

  console.log(`[Worker] ${items.length} reminder(s) to enqueue`);

  for (const item of items) {
    // Optimistically mark as processed to avoid double-send
    await supabase
      .from('reminder_queue')
      .update({ processed: true })
      .eq('id', item.id);

    await reminderQueue.add(item, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}

// Poll every 30 seconds
setInterval(pollReminderQueue, 30_000);
// Also immediately on startup
pollReminderQueue();

export { reminderQueue };
