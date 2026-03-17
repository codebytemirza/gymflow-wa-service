// ============================================================
// Health Check API — /api/health
// Returns system health status for monitoring
// ============================================================
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const healthChecks = {
    api: { status: 'healthy' as const, latency: 0 },
    database: { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy', latency: 0 },
    auth: { status: 'healthy' as 'healthy' | 'degraded', user: null as string | null },
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();

  // Check database connection
  try {
    const { error, data } = await supabase.from('gyms').select('id').limit(1);
    healthChecks.database.latency = Date.now() - startTime;
    
    if (error) {
      healthChecks.database.status = 'unhealthy';
      console.error('[Health] Database check failed:', error.message);
    } else {
      healthChecks.database.status = data ? 'healthy' : 'degraded';
    }
  } catch (err) {
    healthChecks.database.status = 'unhealthy';
    healthChecks.database.latency = Date.now() - startTime;
    console.error('[Health] Database check error:', err);
  }

  // Check auth
  try {
    const { data: { user } } = await supabase.auth.getUser();
    healthChecks.auth.user = user?.email ?? null;
  } catch {
    healthChecks.auth.status = 'degraded';
  }

  // Overall status
  const overallStatus = 
    healthChecks.database.status === 'unhealthy' ? 'unhealthy' :
    healthChecks.database.status === 'degraded' || healthChecks.auth.status === 'degraded' ? 'degraded' :
    'healthy';

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

  return NextResponse.json({
    status: overallStatus,
    checks: healthChecks,
    version: process.env.npm_package_version ?? '0.1.0',
    environment: process.env.NODE_ENV ?? 'development',
  }, { status: statusCode });
}
