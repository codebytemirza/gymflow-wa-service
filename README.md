# GymFlow

**Open-source gym management SaaS built for Pakistani gyms.**

Track members, collect payments, send WhatsApp reminders — all from one dashboard.

---

## Features

- **Member Management** — Add, track, and manage gym members with full profiles (CNIC, emergency contacts, billing day, status)
- **Payment Tracking** — Monitor dues, mark payments as paid, auto-detect overdue fees
- **WhatsApp Reminders** — Automated payment reminders via WhatsApp (due today, late reminders, final warnings)
- **Dashboard Analytics** — Stats cards showing active members, pending/overdue payments, revenue
- **Multi-tenant Architecture** — Support for multiple gyms with role-based access (gym_owner, super_admin)
- **Dark Mode** — Built-in theme switching with next-themes

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Charts | Recharts |
| Icons | Lucide React |
| Forms | Zod validation |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (login, register, password reset)
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (dashboard)/         # Protected dashboard pages
│   │   ├── dashboard/       # Overview & stats
│   │   ├── members/         # Member CRUD
│   │   ├── payments/        # Payment management
│   │   ├── reminders/       # Reminder configuration
│   │   ├── whatsapp/        # WhatsApp session management
│   │   └── settings/        # Gym settings
│   ├── api/
│   │   ├── auth/callback/   # Supabase auth callback
│   │   └── wa/[action]/     # WhatsApp service proxy
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Navbar, sidebar
│   ├── dashboard/          # Dashboard-specific components
│   ├── members/            # Member table components
│   ├── payments/           # Payment components
│   └── brand/              # Logo & branding
├── lib/
│   ├── supabase/           # Supabase client (browser, server, admin)
│   ├── validations/        # Zod schemas
│   └── utils.ts            # Utilities
└── types/
    └── database.types.ts   # Supabase-generated types
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `gyms` | Gym entities (name, address, default fee, currency, status) |
| `profiles` | User profiles linked to gyms (role, full_name, avatar) |
| `members` | Gym members (full_name, phone, CNIC, plan_fee, billing_day, status) |
| `payments` | Payment records (due_date, paid_date, amount, status) |
| `reminder_configs` | Reminder settings per gym (templates, enabled, schedule) |
| `reminder_logs` | History of sent reminders |
| `reminder_queue` | Pending reminders to be processed |
| `wa_sessions` | WhatsApp connection sessions per gym |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Supabase account

### 1. Clone & Install

```bash
git clone https://github.com/codebytemirza/gymflow-wa-service.git
cd gymflow-wa-service
npm install
```

### 2. Environment Setup

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=GymFlow
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# WhatsApp Service (microservice)
WA_SERVICE_URL=http://localhost:3001
WA_SERVICE_SECRET=your_shared_secret

# Optional
REDIS_URL=redis://localhost:6379
```

### 3. Database Setup

Run the SQL migrations in your Supabase dashboard to create the required tables (see `database.types.ts` for schema reference).

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## WhatsApp Integration

GymFlow integrates with a separate WhatsApp microservice for sending payment reminders. The microservice handles:

- QR code generation for WhatsApp Web connection
- Session persistence per gym
- Message queue processing
- Delivery status tracking

See `src/app/api/wa/[action]/route.ts` for the proxy implementation.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Author

**Muhammad Abdullah**

Built for the Pakistani gym community.

JazzCash Donate: 03284119134

---

## License

MIT License — feel free to use, modify, and distribute.