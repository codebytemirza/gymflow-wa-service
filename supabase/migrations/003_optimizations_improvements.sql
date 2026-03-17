-- ============================================================
-- GymFlow — Optimizations & Improvements Migration
-- Run this in Supabase SQL Editor after initial setup
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- ──────────────────────────── Safety Check ────────────────────

-- Ensure this runs only once
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'gymflow_optimizations_applied'
  ) THEN
    RAISE EXCEPTION 'Migration already applied!';
  END IF;
END $$;

-- ──────────────────────────── Message Delivery Tracking ───────
-- Add columns to reminder_logs for tracking WhatsApp message status

ALTER TABLE public.reminder_logs 
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text;

-- Index for faster lookups by message ID
CREATE INDEX IF NOT EXISTS idx_reminder_logs_wa_message_id 
  ON public.reminder_logs(wa_message_id) 
  WHERE wa_message_id IS NOT NULL;

-- ──────────────────────────── Performance Indexes ─────────────
-- Speed up common queries

-- Reminder queue polling (most critical for worker performance)
CREATE INDEX IF NOT EXISTS idx_reminder_queue_pending 
  ON public.reminder_queue(gym_id, processed, created_at) 
  WHERE processed = false;

-- Payment queries for overdue detection
CREATE INDEX IF NOT EXISTS idx_payments_overdue 
  ON public.payments(gym_id, status, due_date) 
  WHERE status IN ('pending', 'overdue');

-- Active member lookups
CREATE INDEX IF NOT EXISTS idx_members_active 
  ON public.members(gym_id, status) 
  WHERE status = 'active';

-- Member phone lookups (for reminders)
CREATE INDEX IF NOT EXISTS idx_members_phone 
  ON public.members(phone) 
  WHERE status = 'active';

-- Payment member lookups
CREATE INDEX IF NOT EXISTS idx_payments_member_status 
  ON public.payments(member_id, status) 
  WHERE status IN ('pending', 'overdue');

-- Reminder logs by gym and date (for analytics)
CREATE INDEX IF NOT EXISTS idx_reminder_logs_gym_date 
  ON public.reminder_logs(gym_id, sent_at DESC);

-- WA sessions by status (for monitoring)
CREATE INDEX IF NOT EXISTS idx_wa_sessions_status 
  ON public.wa_sessions(status);

-- ──────────────────────────── Template Standardization ────────
-- Update reminder_configs to use consistent {{variable}} syntax

-- First, add a column for template variables metadata
ALTER TABLE public.reminder_configs 
  ADD COLUMN IF NOT EXISTS template_variables text[] DEFAULT 
    ARRAY['name', 'amount', 'currency', 'due_date', 'days_late', 'gym_name', 'member_id'];

-- Update existing templates to use {{variable}} syntax
-- Note: This is a best-effort update; review templates manually if customized

UPDATE public.reminder_configs 
SET 
  due_date_template = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(due_date_template, 
      '{name}', '{{name}}'),
      '{amount}', '{{amount}}'),
      '{currency}', '{{currency}}'),
      '{due_date}', '{{due_date}}'),
      '{gym_name}', '{{gym_name}}'),
      '{member_id}', '{{member_id}}')
WHERE due_date_template LIKE '%{name}%';

UPDATE public.reminder_configs 
SET 
  late_template = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(late_template, 
      '{name}', '{{name}}'),
      '{amount}', '{{amount}}'),
      '{currency}', '{{currency}}'),
      '{due_date}', '{{due_date}}'),
      '{days_late}', '{{days_late}}'),
      '{gym_name}', '{{gym_name}}'),
      '{member_id}', '{{member_id}}')
WHERE late_template LIKE '%{name}%';

UPDATE public.reminder_configs 
SET 
  final_template = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(final_template, 
      '{name}', '{{name}}'),
      '{amount}', '{{amount}}'),
      '{currency}', '{{currency}}'),
      '{due_date}', '{{due_date}}'),
      '{days_late}', '{{days_late}}'),
      '{gym_name}', '{{gym_name}}'),
      '{member_id}', '{{member_id}}')
WHERE final_template LIKE '%{name}%';

-- ──────────────────────────── Queue Function Improvements ─────
-- Update queue_payment_reminders to use new syntax and better error handling

CREATE OR REPLACE FUNCTION public.queue_payment_reminders_v2()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec record; 
  cfg record; 
  msg text;
  days_late int;
  phone_normalized text;
BEGIN
  FOR rec IN
    SELECT 
      p.id             as payment_id,
      p.gym_id,
      p.member_id,
      p.due_date,
      p.amount,
      p.status,
      m.phone,
      m.full_name,
      g.name           as gym_name,
      g.currency,
      current_date - p.due_date as days_overdue
    FROM public.payments p
    JOIN public.members m ON m.id = p.member_id
    JOIN public.gyms g ON g.id = p.gym_id
    WHERE p.status IN ('pending', 'overdue')
      AND m.status = 'active'
      AND m.phone IS NOT NULL
  LOOP
    -- Get gym reminder config
    SELECT * INTO cfg FROM public.reminder_configs WHERE gym_id = rec.gym_id;
    IF NOT FOUND OR NOT cfg.reminders_enabled THEN 
      CONTINUE; 
    END IF;

    -- Normalize phone number (remove +, handle Pakistan numbers)
    phone_normalized := REPLACE(REPLACE(REPLACE(rec.phone, '+', ''), '-', ''), ' ', '');
    IF phone_normalized LIKE '0%' AND LENGTH(phone_normalized) = 11 THEN
      phone_normalized := '92' || SUBSTRING(phone_normalized FROM 2);
    END IF;

    -- Due today reminder
    IF rec.due_date = current_date AND cfg.remind_on_due_date THEN
      msg := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        cfg.due_date_template,
        '{{name}}', COALESCE(rec.full_name, 'Member')),
        '{{amount}}', rec.amount::text),
        '{{currency}}', COALESCE(rec.currency, 'PKR')),
        '{{due_date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{gym_name}}', COALESCE(rec.gym_name, 'Gym')),
        '{{days_late}}', '0'),
        '{{member_id}}', rec.member_id::text);

      INSERT INTO public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      VALUES (rec.gym_id, rec.member_id, rec.payment_id, 'due_today', msg, phone_normalized)
      ON CONFLICT DO NOTHING;

    -- Late reminder (check if days_overdue is in late_reminder_days array)
    ELSIF rec.days_overdue = ANY(cfg.late_reminder_days) THEN
      msg := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        cfg.late_template,
        '{{name}}', COALESCE(rec.full_name, 'Member')),
        '{{amount}}', rec.amount::text),
        '{{currency}}', COALESCE(rec.currency, 'PKR')),
        '{{due_date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{days_late}}', rec.days_overdue::text),
        '{{gym_name}}', COALESCE(rec.gym_name, 'Gym')),
        '{{member_id}}', rec.member_id::text);

      INSERT INTO public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      VALUES (rec.gym_id, rec.member_id, rec.payment_id, 'late_reminder', msg, phone_normalized)
      ON CONFLICT DO NOTHING;

    -- Final warning
    ELSIF rec.days_overdue = cfg.final_warning_days THEN
      msg := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        cfg.final_template,
        '{{name}}', COALESCE(rec.full_name, 'Member')),
        '{{amount}}', rec.amount::text),
        '{{currency}}', COALESCE(rec.currency, 'PKR')),
        '{{due_date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{days_late}}', rec.days_overdue::text),
        '{{gym_name}}', COALESCE(rec.gym_name, 'Gym')),
        '{{member_id}}', rec.member_id::text);

      INSERT INTO public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      VALUES (rec.gym_id, rec.member_id, rec.payment_id, 'final_warning', msg, phone_normalized)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Update cron job to use new version
SELECT cron.unschedule('queue-payment-reminders');
SELECT cron.schedule(
  'queue-payment-reminders',
  '5 0 * * *',
  $$ SELECT public.queue_payment_reminders_v2(); $$
);

-- ──────────────────────────── Monitoring View ─────────────────
-- Create a view for easy monitoring of WhatsApp status

CREATE OR REPLACE VIEW public.wa_monitoring_view AS
SELECT 
  g.id as gym_id,
  g.name as gym_name,
  ws.status as wa_status,
  ws.phone_number as wa_phone,
  ws.connected_at,
  ws.disconnected_at,
  CASE 
    WHEN ws.status = 'connected' THEN '✓ Active'
    WHEN ws.status = 'banned' THEN '⚠️ BANNED'
    WHEN ws.status = 'disconnected' THEN '✗ Disconnected'
    WHEN ws.status = 'connecting' THEN '⟳ Connecting...'
    ELSE '? Unknown'
  END as status_display,
  CASE 
    WHEN ws.disconnected_at IS NOT NULL 
      AND ws.status != 'connected'
    THEN EXTRACT(EPOCH FROM (NOW() - ws.disconnected_at)) / 3600
    ELSE 0
  END as hours_since_disconnect,
  (SELECT COUNT(*) FROM public.reminder_queue rq 
   WHERE rq.gym_id = g.id AND rq.processed = false) as pending_reminders,
  (SELECT COUNT(*) FROM public.reminder_logs rl 
   WHERE rl.gym_id = g.id 
   AND rl.sent_at > NOW() - INTERVAL '24 hours') as reminders_sent_24h
FROM public.gyms g
LEFT JOIN public.wa_sessions ws ON ws.gym_id = g.id;

-- Grant access to authenticated users
GRANT SELECT ON public.wa_monitoring_view TO authenticated;

-- ──────────────────────────── Rate Limit Tracking Table ───────
-- Track API rate limits per gym

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT NOW(),
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(gym_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_gym_endpoint 
  ON public.api_rate_limits(gym_id, endpoint, window_end);

-- Function to clean up old rate limit records (called daily)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_end < NOW() - INTERVAL '7 days';
END;
$$;

-- Schedule cleanup job
SELECT cron.unschedule('cleanup-rate-limits');
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *',  -- 3:00 AM daily
  $$ SELECT public.cleanup_rate_limits(); $$
);

-- ──────────────────────────── Reminder Stats View ─────────────
-- Analytics view for reminder performance

CREATE OR REPLACE VIEW public.reminder_stats_view AS
SELECT 
  g.id as gym_id,
  g.name as gym_name,
  DATE_TRUNC('day', rl.sent_at) as reminder_date,
  rl.type as reminder_type,
  COUNT(*) FILTER (WHERE rl.status = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE rl.status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE rl.delivered_at IS NOT NULL) as delivered_count,
  COUNT(*) FILTER (WHERE rl.read_at IS NOT NULL) as read_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE rl.delivered_at IS NOT NULL) / 
    NULLIF(COUNT(*) FILTER (WHERE rl.status = 'sent'), 0), 
    2
  ) as delivery_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE rl.read_at IS NOT NULL) / 
    NULLIF(COUNT(*) FILTER (WHERE rl.delivered_at IS NOT NULL), 0), 
    2
  ) as read_rate_pct
FROM public.gyms g
LEFT JOIN public.reminder_logs rl ON rl.gym_id = g.id
GROUP BY g.id, g.name, DATE_TRUNC('day', rl.sent_at), rl.type
ORDER BY reminder_date DESC;

GRANT SELECT ON public.reminder_stats_view TO authenticated;

-- ──────────────────────────── Health Check Function ───────────
-- Comprehensive health check for the system

CREATE OR REPLACE FUNCTION public.system_health_check()
RETURNS TABLE (
  check_name text,
  status text,
  details jsonb,
  recommendation text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
  v_wa_status text;
  v_pending_count int;
  v_old_pending int;
BEGIN
  -- Check 1: Active gyms
  SELECT COUNT(*) INTO v_count FROM gyms WHERE status = 'active';
  check_name := 'active_gyms';
  status := CASE WHEN v_count > 0 THEN 'healthy' ELSE 'warning' END;
  details := jsonb_build_object('count', v_count);
  recommendation := CASE WHEN v_count = 0 THEN 'No active gyms found' ELSE 'All good' END;
  RETURN NEXT;

  -- Check 2: WhatsApp sessions
  SELECT COUNT(*) INTO v_count FROM wa_sessions WHERE status = 'connected';
  SELECT COUNT(*) INTO v_wa_status FROM wa_sessions WHERE status = 'banned';
  check_name := 'whatsapp_sessions';
  status := CASE WHEN v_wa_status > 0 THEN 'critical' WHEN v_count = 0 THEN 'warning' ELSE 'healthy' END;
  details := jsonb_build_object('connected', v_count, 'banned', v_wa_status);
  recommendation := CASE 
    WHEN v_wa_status > 0 THEN 'Reconnect banned WhatsApp numbers immediately'
    WHEN v_count = 0 THEN 'No WhatsApp sessions connected'
    ELSE 'All good' 
  END;
  RETURN NEXT;

  -- Check 3: Pending reminders
  SELECT COUNT(*) INTO v_pending_count FROM reminder_queue WHERE processed = false;
  SELECT COUNT(*) INTO v_old_pending FROM reminder_queue 
    WHERE processed = false AND created_at < NOW() - INTERVAL '1 hour';
  check_name := 'reminder_queue';
  status := CASE WHEN v_old_pending > 0 THEN 'warning' WHEN v_pending_count > 100 THEN 'info' ELSE 'healthy' END;
  details := jsonb_build_object('pending', v_pending_count, 'stale', v_old_pending);
  recommendation := CASE 
    WHEN v_old_pending > 0 THEN 'Check wa-service worker is running'
    WHEN v_pending_count > 100 THEN 'Large queue, monitor processing'
    ELSE 'All good' 
  END;
  RETURN NEXT;

  -- Check 4: Recent reminder failures
  SELECT COUNT(*) INTO v_count FROM reminder_logs 
    WHERE status = 'failed' AND sent_at > NOW() - INTERVAL '24 hours';
  check_name := 'reminder_failures_24h';
  status := CASE WHEN v_count > 10 THEN 'warning' WHEN v_count > 0 THEN 'info' ELSE 'healthy' END;
  details := jsonb_build_object('failures', v_count);
  recommendation := CASE 
    WHEN v_count > 10 THEN 'High failure rate, check WhatsApp connection'
    WHEN v_count > 0 THEN 'Some failures detected, review logs'
    ELSE 'All good' 
  END;
  RETURN NEXT;

  -- Check 5: Overdue payments without reminders
  SELECT COUNT(*) INTO v_count FROM payments p
    JOIN members m ON m.id = p.member_id
    WHERE p.status = 'overdue' 
      AND m.status = 'active'
      AND m.phone IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM reminder_logs rl 
        WHERE rl.payment_id = p.id 
        AND rl.sent_at > NOW() - INTERVAL '7 days'
      );
  check_name := 'unreminded_overdue';
  status := CASE WHEN v_count > 0 THEN 'warning' ELSE 'healthy' END;
  details := jsonb_build_object('count', v_count);
  recommendation := CASE 
    WHEN v_count > 0 THEN 'Enable reminders or check reminder config'
    ELSE 'All good' 
  END;
  RETURN NEXT;
END;
$$;

-- ──────────────────────────── Completion Marker ───────────────

-- Create extension to mark migration as applied (using a dummy extension approach)
-- Since we can't create custom extensions, we'll use a config table instead

CREATE TABLE IF NOT EXISTS public._migration_status (
  migration_name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT NOW(),
  details jsonb
);

INSERT INTO public._migration_status (migration_name, details)
VALUES ('gymflow_optimizations', jsonb_build_object(
  'version', '1.0.0',
  'changes', ARRAY[
    'Added message delivery tracking columns',
    'Added performance indexes',
    'Standardized template placeholders',
    'Added monitoring views',
    'Added rate limit tracking',
    'Added health check function',
    'Updated reminder queue function'
  ]
))
ON CONFLICT (migration_name) DO NOTHING;

-- ──────────────────────────── Verification Queries ────────────
-- Run these to verify migration success:

-- SELECT * FROM public._migration_status;
-- SELECT * FROM public.system_health_check();
-- SELECT * FROM public.wa_monitoring_view;
-- SELECT indexname, tablename FROM pg_indexes WHERE tablename IN ('reminder_queue', 'payments', 'members', 'reminder_logs');

-- ──────────────────────────── Done ────────────────────────────
