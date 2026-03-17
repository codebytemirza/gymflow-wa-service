// ============================================================
// Next.js API route: /api/wa/[action]
// Proxies requests to the wa-service with Bearer auth.
// ============================================================
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ──────────────────────────── Config ──────────────────────────

const WA_SERVICE_URL = process.env.WA_SERVICE_URL ?? 'http://localhost:3001';
const WA_SECRET = process.env.WA_SERVICE_SECRET ?? '';

// Validate required env vars
if (!process.env.WA_SERVICE_SECRET) {
  console.warn('[WA API] WA_SERVICE_SECRET not set, using empty secret');
}

// Validate WA_SERVICE_URL is set and valid
if (!WA_SERVICE_URL) {
  console.error('[WA API] WA_SERVICE_URL not set - WhatsApp features will not work');
}

// Schema for the /send action body
const SendSchema = z.object({
  phone: z.string().regex(/^\d{10,15}$/, 'phone must be 10-15 digits, numeric only'),
  message: z.string().min(1).max(4096),
});

async function getGymId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('gym_id')
    .eq('id', user.id)
    .single();
  return (data as { gym_id: string } | null)?.gym_id ?? null;
}

type RouteContext = { params: Promise<{ action: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action } = await ctx.params;

  // Check if wa-service URL is configured
  if (!WA_SERVICE_URL) {
    return NextResponse.json(
      { error: 'WhatsApp service not configured', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(`${WA_SERVICE_URL}/gym/${gymId}/${action}`, {
      headers: { Authorization: `Bearer ${WA_SECRET}` },
      // Add connection timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: res.status });
    }

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[WA API] GET error:', err);

    // Check if it's a connection error (wa-service not running)
    const cause = err as { cause?: { code?: string } };
    if (cause.cause?.code === 'ECONNRESET' || cause.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          status: 'disconnected',
          qrCode: null,
          phoneNumber: null,
          connectedAt: null,
          socketActive: false,
          offline: true,
          error: 'WhatsApp service is not running',
          hint: 'Start the wa-service on port 3001',
        },
        { status: 503 }
      );
    }

    // wa-service is not running — return safe offline state
    return NextResponse.json({
      status: 'disconnected',
      qrCode: null,
      phoneNumber: null,
      connectedAt: null,
      socketActive: false,
      offline: true,
      error: 'WhatsApp service unavailable',
    });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action } = await ctx.params;
  const rawBody = req.headers.get('content-type')?.includes('application/json')
    ? await req.json().catch(() => ({})) as Record<string, unknown>
    : {};

  // Validate body for sensitive actions
  if (action === 'send') {
    const parsed = SendSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
  }

  // Check if wa-service URL is configured
  if (!WA_SERVICE_URL) {
    return NextResponse.json(
      { error: 'WhatsApp service not configured', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(`${WA_SERVICE_URL}/gym/${gymId}/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WA_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rawBody),
      // Add connection timeout to fail faster on unreachable server
      signal: AbortSignal.timeout(5000),
    });

    // Check if response is ok (status 200-299)
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: res.status });
    }

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[WA API] POST error:', err);

    // Check if it's a connection error (wa-service not running)
    const cause = err as { cause?: { code?: string } };
    if (cause.cause?.code === 'ECONNRESET' || cause.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'WhatsApp service is not running',
          code: 'SERVICE_UNAVAILABLE',
          hint: 'Start the wa-service on port 3001',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }
}
