-- ============================================================
-- GymFlow — Functions, Triggers & RLS
-- Run this in Supabase SQL Editor (tables already exist)
-- Dashboard → SQL Editor → New query → Paste all → Run
-- ============================================================

-- ──────────────────────── Helper ─────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ──────────────────────── updated_at triggers ─────────────────

do $$ begin
  create trigger set_gyms_updated_at before update on public.gyms
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_profiles_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_members_updated_at before update on public.members
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_payments_updated_at before update on public.payments
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_wa_sessions_updated_at before update on public.wa_sessions
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_reminder_configs_updated_at before update on public.reminder_configs
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ──────────────────────── Core Functions ──────────────────────

-- Returns the gym_id of the calling user
create or replace function public.get_my_gym_id()
returns uuid language sql stable security definer as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

-- Returns true if calling user is super_admin
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

-- ──────────────────────── handle_new_user ─────────────────────
-- Runs automatically when a new user signs up.
-- Creates: gym → profile → reminder_config → wa_session

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_gym_id uuid;
  gym_name   text;
begin
  gym_name := coalesce(
    new.raw_user_meta_data->>'gym_name',
    split_part(new.email, '@', 1) || '''s Gym'
  );

  -- Create gym
  insert into public.gyms (owner_id, name)
  values (new.id, gym_name)
  returning id into new_gym_id;

  -- Create profile
  insert into public.profiles (id, gym_id, role, full_name)
  values (
    new.id,
    new_gym_id,
    'gym_owner',
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );

  -- Create reminder config with defaults
  insert into public.reminder_configs (gym_id)
  values (new_gym_id)
  on conflict (gym_id) do nothing;

  -- Create WA session record
  insert into public.wa_sessions (gym_id)
  values (new_gym_id)
  on conflict (gym_id) do nothing;

  return new;
end;
$$;

-- Attach to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────── Member → Payment trigger ────────────
-- Auto-creates first pending payment when a member is added

create or replace function public.generate_monthly_payment_for_member()
returns trigger language plpgsql security definer as $$
declare
  due date;
begin
  due := date_trunc('month', current_date)::date + (new.billing_day - 1);
  if due < current_date then
    due := due + interval '1 month';
  end if;

  insert into public.payments (gym_id, member_id, due_date, amount, status)
  values (new.gym_id, new.id, due, new.plan_fee, 'pending')
  on conflict (member_id, due_date) do nothing;

  return new;
end;
$$;

drop trigger if exists on_member_created on public.members;
create trigger on_member_created
  after insert on public.members
  for each row execute function public.generate_monthly_payment_for_member();

-- ──────────────────────── Cron Functions ──────────────────────

-- Mark pending → overdue (called daily by pg_cron)
create or replace function public.mark_overdue_payments()
returns void language plpgsql security definer as $$
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending' and due_date < current_date;
end;
$$;

-- Generate payments for next month active members (called on 28th by pg_cron)
create or replace function public.generate_monthly_payments()
returns void language plpgsql security definer as $$
declare rec record; due date; begin
  for rec in select id, gym_id, plan_fee, billing_day from public.members where status = 'active'
  loop
    due := date_trunc('month', now() + interval '1 month')::date + (rec.billing_day - 1);
    insert into public.payments (gym_id, member_id, due_date, amount, status)
    values (rec.gym_id, rec.id, due, rec.plan_fee, 'pending')
    on conflict (member_id, due_date) do nothing;
  end loop;
end;
$$;

-- Queue reminders for due/overdue payments (called daily by pg_cron)
create or replace function public.queue_payment_reminders()
returns void language plpgsql security definer as $$
declare
  rec record; cfg record; msg text;
begin
  for rec in
    select p.id as payment_id, p.gym_id, p.member_id, p.due_date, p.amount, p.status,
           m.phone, m.full_name, g.name as gym_name, g.currency,
           current_date - p.due_date as days_overdue
    from public.payments p
    join public.members m on m.id = p.member_id
    join public.gyms g on g.id = p.gym_id
    where p.status in ('pending', 'overdue') and m.status = 'active'
  loop
    select * into cfg from public.reminder_configs where gym_id = rec.gym_id;
    if not found or not cfg.reminders_enabled then continue; end if;

    if rec.due_date = current_date and cfg.remind_on_due_date then
      msg := replace(replace(replace(replace(replace(
        cfg.due_date_template,
        '{name}', rec.full_name), '{amount}', rec.amount::text),
        '{currency}', rec.currency), '{due_date}', to_char(rec.due_date,'DD Mon YYYY')),
        '{gym_name}', rec.gym_name);
      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'due_today', msg, rec.phone);

    elsif rec.days_overdue = any(cfg.late_reminder_days) then
      msg := replace(replace(replace(replace(replace(replace(
        cfg.late_template,
        '{name}', rec.full_name), '{amount}', rec.amount::text),
        '{currency}', rec.currency), '{due_date}', to_char(rec.due_date,'DD Mon YYYY')),
        '{days_late}', rec.days_overdue::text), '{gym_name}', rec.gym_name);
      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'late_reminder', msg, rec.phone);

    elsif rec.days_overdue = cfg.final_warning_days then
      msg := replace(replace(replace(replace(replace(
        cfg.final_template,
        '{name}', rec.full_name), '{amount}', rec.amount::text),
        '{currency}', rec.currency), '{gym_name}', rec.gym_name),
        '{due_date}', to_char(rec.due_date,'DD Mon YYYY'));
      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'final_warning', msg, rec.phone);
    end if;
  end loop;
end;
$$;

-- ──────────────────────── RLS Policies ────────────────────────

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_configs enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.reminder_queue enable row level security;
alter table public.wa_sessions enable row level security;

-- Drop existing policies first (safe to re-run)
drop policy if exists "gym_owner_gyms" on public.gyms;
drop policy if exists "gym_owner_profiles_select" on public.profiles;
drop policy if exists "gym_owner_profiles_update" on public.profiles;
drop policy if exists "gym_owner_members" on public.members;
drop policy if exists "gym_owner_payments" on public.payments;
drop policy if exists "gym_owner_reminder_configs" on public.reminder_configs;
drop policy if exists "gym_owner_reminder_logs" on public.reminder_logs;
drop policy if exists "gym_owner_reminder_queue" on public.reminder_queue;
drop policy if exists "gym_owner_wa_sessions" on public.wa_sessions;

create policy "gym_owner_gyms" on public.gyms
  for all using (owner_id = auth.uid() or public.is_super_admin());

create policy "gym_owner_profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

create policy "gym_owner_profiles_update" on public.profiles
  for update using (id = auth.uid());

create policy "gym_owner_members" on public.members
  for all using (gym_id = public.get_my_gym_id() or public.is_super_admin());

create policy "gym_owner_payments" on public.payments
  for all using (gym_id = public.get_my_gym_id() or public.is_super_admin());

create policy "gym_owner_reminder_configs" on public.reminder_configs
  for all using (gym_id = public.get_my_gym_id() or public.is_super_admin());

create policy "gym_owner_reminder_logs" on public.reminder_logs
  for select using (gym_id = public.get_my_gym_id() or public.is_super_admin());

create policy "gym_owner_reminder_queue" on public.reminder_queue
  for select using (gym_id = public.get_my_gym_id() or public.is_super_admin());

create policy "gym_owner_wa_sessions" on public.wa_sessions
  for all using (gym_id = public.get_my_gym_id() or public.is_super_admin());

-- ──────────────────────── pg_cron Jobs ───────────────────────
-- Only run these if pg_cron extension is enabled in your project

select cron.schedule('mark-overdue-payments',    '1 0 * * *',  $$ select public.mark_overdue_payments(); $$);
select cron.schedule('queue-payment-reminders',  '5 0 * * *',  $$ select public.queue_payment_reminders(); $$);
select cron.schedule('generate-monthly-payments','0 1 28 * *',  $$ select public.generate_monthly_payments(); $$);

-- ──────────────────────── Verify ─────────────────────────────
-- After running, check: select * from cron.job;
-- Then test signup at http://localhost:3000/register
