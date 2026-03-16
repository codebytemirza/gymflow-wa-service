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

  await sendTextMessage(gym_id, phone, message_text);

  // Mark as processed in Supabase
  await supabase
    .from('reminder_queue')
    .update({ processed: true })
    .eq('id', id);

  // Log to reminder_logs
  await supabase.from('reminder_logs').insert({
    gym_id,
    member_id,
    payment_id,
    type,
    message_text,
    status: 'sent',
  });

  console.log(`[Worker] ✓ Sent ${type} → ${phone.slice(0, 6)}…`);
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
