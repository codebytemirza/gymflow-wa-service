-- ============================================================
-- GymFlow SaaS — Complete Database Migration
-- Run this entire script in Supabase SQL Editor (once)
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- ──────────────────────────── Extensions ──────────────────────

create extension if not exists "pg_cron" schema cron;
create extension if not exists "pg_net" schema extensions;

-- ──────────────────────────── Enums ──────────────────────────

do $$ begin
  create type public.user_role as enum ('super_admin', 'gym_owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_type as enum ('due_today', 'late_reminder', 'final_warning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_status as enum ('sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wa_status as enum ('connected', 'disconnected', 'connecting', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gym_status as enum ('active', 'suspended', 'trial');
exception when duplicate_object then null; end $$;

-- ──────────────────────────── Helper Functions ────────────────

-- Auto-update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ──────────────────────────── Tables ─────────────────────────

-- GYMS (tenant record)
create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  address     text,
  phone       text,
  logo_url    text,
  default_fee numeric(10,2) not null default 3000,
  currency    text not null default 'PKR',
  status      public.gym_status not null default 'trial',
  trial_ends_at timestamptz default (now() + interval '30 days'),
  timezone    text not null default 'Asia/Karachi',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  gym_id      uuid references public.gyms(id) on delete cascade,
  role        public.user_role not null default 'gym_owner',
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- MEMBERS
create table if not exists public.members (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid references public.gyms(id) on delete cascade not null,
  full_name         text not null,
  phone             text not null,
  cnic              text,
  address           text,
  emergency_contact text,
  plan_fee          numeric(10,2) not null,
  billing_day       int not null default 1 check (billing_day between 1 and 28),
  join_date         date not null default current_date,
  status            public.member_status not null default 'active',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (gym_id, phone)
);

-- PAYMENTS
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid references public.gyms(id) on delete cascade not null,
  member_id    uuid references public.members(id) on delete cascade not null,
  due_date     date not null,
  paid_date    date,
  amount       numeric(10,2) not null,
  status       public.payment_status not null default 'pending',
  collected_by uuid references auth.users(id),
  receipt_url  text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (member_id, due_date)
);

-- REMINDER CONFIGS (one per gym)
create table if not exists public.reminder_configs (
  id                   uuid primary key default gen_random_uuid(),
  gym_id               uuid references public.gyms(id) on delete cascade not null unique,
  remind_on_due_date   boolean not null default true,
  late_reminder_days   int[] not null default '{2,5}',
  final_warning_days   int not null default 7,
  due_date_template    text not null default 'Assalam u Alaikum {{name}}! Your gym fee of PKR {{amount}} is due today ({{date}}). Please pay to continue your membership. - {{gym_name}}',
  late_template        text not null default 'Assalam u Alaikum {{name}}! Your gym fee of PKR {{amount}} is {{days}} days overdue (due {{date}}). Please pay as soon as possible. - {{gym_name}}',
  final_template       text not null default 'FINAL REMINDER: {{name}}, your gym fee of PKR {{amount}} is 7 days overdue. Please pay immediately or your membership will be suspended. - {{gym_name}}',
  reminders_enabled    boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- REMINDER LOGS (audit trail)
create table if not exists public.reminder_logs (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid references public.gyms(id) on delete cascade not null,
  member_id    uuid references public.members(id) on delete cascade not null,
  payment_id   uuid references public.payments(id),
  type         public.reminder_type not null,
  message_text text not null,
  status       public.reminder_status not null,
  error_msg    text,
  sent_at      timestamptz not null default now()
);

-- REMINDER QUEUE (jobs for WA service)
create table if not exists public.reminder_queue (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid references public.gyms(id) on delete cascade not null,
  member_id    uuid references public.members(id) on delete cascade not null,
  payment_id   uuid references public.payments(id),
  type         public.reminder_type not null,
  message_text text not null,
  phone        text not null,
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- WA SESSIONS (one per gym)
create table if not exists public.wa_sessions (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid references public.gyms(id) on delete cascade not null unique,
  phone_number     text,
  status           public.wa_status not null default 'disconnected',
  session_data     text,  -- encrypted Baileys auth state (stored in Redis, this is backup)
  qr_code          text,  -- temporary QR code string
  connected_at     timestamptz,
  disconnected_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ──────────────────────────── Indexes ────────────────────────

create index if not exists idx_members_gym_id on public.members(gym_id);
create index if not exists idx_members_status on public.members(gym_id, status);
create index if not exists idx_payments_gym_id on public.payments(gym_id);
create index if not exists idx_payments_status on public.payments(gym_id, status);
create index if not exists idx_payments_member_id on public.payments(member_id);
create index if not exists idx_payments_due_date on public.payments(due_date);
create index if not exists idx_reminder_queue_unprocessed on public.reminder_queue(processed) where processed = false;

-- ──────────────────────────── Updated_at Triggers ────────────

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

-- ──────────────────────────── Core Functions ─────────────────

-- Returns the gym_id of the calling user
create or replace function public.get_my_gym_id()
returns uuid language sql stable security definer as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

-- Returns true if the calling user is a super_admin
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Auto-creates gym + profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_gym_id uuid;
  gym_name   text;
begin
  -- Use gym_name from user metadata, fallback to email prefix
  gym_name := coalesce(
    new.raw_user_meta_data->>'gym_name',
    split_part(new.email, '@', 1) || '''s Gym'
  );

  -- Create gym record
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

  -- Create reminder config (defaults)
  insert into public.reminder_configs (gym_id)
  values (new_gym_id);

  -- Create WA session record
  insert into public.wa_sessions (gym_id)
  values (new_gym_id);

  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generate first payment when a member is added
create or replace function public.generate_monthly_payment_for_member()
returns trigger language plpgsql security definer as $$
declare
  due date;
begin
  -- Calculate first due date based on billing_day
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

-- Mark overdue payments (pg_cron calls this daily at 00:01 UTC)
create or replace function public.mark_overdue_payments()
returns void language plpgsql security definer as $$
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;
end;
$$;

-- Generate monthly payment for all active members (pg_cron calls on 28th)
create or replace function public.generate_monthly_payments()
returns void language plpgsql security definer as $$
declare
  rec record;
  due date;
begin
  for rec in
    select id, gym_id, plan_fee, billing_day
    from public.members
    where status = 'active'
  loop
    due := date_trunc('month', now() + interval '1 month')::date + (rec.billing_day - 1);
    insert into public.payments (gym_id, member_id, due_date, amount, status)
    values (rec.gym_id, rec.id, due, rec.plan_fee, 'pending')
    on conflict (member_id, due_date) do nothing;
  end loop;
end;
$$;

-- Queue payment reminders (pg_cron calls this daily at 00:05 UTC)
create or replace function public.queue_payment_reminders()
returns void language plpgsql security definer as $$
declare
  rec record;
  cfg record;
  msg text;
  days_late int;
begin
  for rec in
    select
      p.id             as payment_id,
      p.gym_id,
      p.member_id,
      p.due_date,
      p.amount,
      p.status,
      m.phone,
      m.full_name,
      g.name           as gym_name,
      current_date - p.due_date as days_overdue
    from public.payments p
    join public.members m on m.id = p.member_id
    join public.gyms g on g.id = p.gym_id
    where p.status in ('pending', 'overdue')
      and m.status = 'active'
  loop
    -- Get gym reminder config
    select * into cfg from public.reminder_configs where gym_id = rec.gym_id;
    if not found or not cfg.reminders_enabled then continue; end if;

    -- Due today reminder
    if rec.due_date = current_date and cfg.remind_on_due_date then
      msg := replace(replace(replace(replace(
        cfg.due_date_template,
        '{{name}}', rec.full_name),
        '{{amount}}', rec.amount::text),
        '{{date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{gym_name}}', rec.gym_name);

      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'due_today', msg, rec.phone)
      on conflict do nothing;

    -- Late reminder (check if days_overdue is in late_reminder_days array)
    elsif rec.days_overdue = any(cfg.late_reminder_days) then
      msg := replace(replace(replace(replace(replace(
        cfg.late_template,
        '{{name}}', rec.full_name),
        '{{amount}}', rec.amount::text),
        '{{date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{days}}', rec.days_overdue::text),
        '{{gym_name}}', rec.gym_name);

      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'late_reminder', msg, rec.phone)
      on conflict do nothing;

    -- Final warning
    elsif rec.days_overdue = cfg.final_warning_days then
      msg := replace(replace(replace(replace(
        cfg.final_template,
        '{{name}}', rec.full_name),
        '{{amount}}', rec.amount::text),
        '{{date}}', to_char(rec.due_date, 'DD Mon YYYY')),
        '{{gym_name}}', rec.gym_name);

      insert into public.reminder_queue (gym_id, member_id, payment_id, type, message_text, phone)
      values (rec.gym_id, rec.member_id, rec.payment_id, 'final_warning', msg, rec.phone)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- ──────────────────────────── Row Level Security ──────────────

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_configs enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.reminder_queue enable row level security;
alter table public.wa_sessions enable row level security;

-- GYMS policies
create policy "Owners can manage their own gym"
  on public.gyms for all using (
    owner_id = auth.uid() or public.is_super_admin()
  );

-- PROFILES policies
create policy "Users can read their own profile"
  on public.profiles for select using (
    id = auth.uid() or public.is_super_admin()
  );

create policy "Users can update their own profile"
  on public.profiles for update using (id = auth.uid());

-- MEMBERS policies
create policy "Gym owners manage their members"
  on public.members for all using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- PAYMENTS policies
create policy "Gym owners manage their payments"
  on public.payments for all using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- REMINDER CONFIGS policies
create policy "Gym owners manage their reminder config"
  on public.reminder_configs for all using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- REMINDER LOGS policies
create policy "Gym owners view their reminder logs"
  on public.reminder_logs for select using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- REMINDER QUEUE policies
create policy "Gym owners view their reminder queue"
  on public.reminder_queue for select using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- WA SESSIONS policies
create policy "Gym owners manage their WA session"
  on public.wa_sessions for all using (
    gym_id = public.get_my_gym_id() or public.is_super_admin()
  );

-- ──────────────────────────── pg_cron Jobs ────────────────────

-- Daily 00:01 UTC — mark overdue payments
select cron.schedule(
  'mark-overdue-payments',
  '1 0 * * *',
  $$ select public.mark_overdue_payments(); $$
);

-- Daily 00:05 UTC — queue payment reminders
select cron.schedule(
  'queue-payment-reminders',
  '5 0 * * *',
  $$ select public.queue_payment_reminders(); $$
);

-- 28th of every month 01:00 UTC — generate next month payments
select cron.schedule(
  'generate-monthly-payments',
  '0 1 28 * *',
  $$ select public.generate_monthly_payments(); $$
);

-- ──────────────────────────── Done ───────────────────────────

-- Verify:
-- select count(*) from public.gyms;       -- should be 0
-- select count(*) from public.profiles;   -- should be 0
-- select * from cron.job;                 -- should see 3 cron jobs
