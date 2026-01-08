import type { Env } from '../types';

interface ErrorLog {
  message: string;
  stack?: string;
  type: 'api' | 'runtime' | 'render' | 'network';
  url: string;
  userAgent: string;
  timestamp: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorLogRequest {
  errors: ErrorLog[];
}

export async function handleLogError(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as ErrorLogRequest;
    const { errors } = body;

    if (!Array.isArray(errors) || errors.length === 0) {
      return Response.json({ error: 'errors array is required' }, { status: 400 });
    }

    // Write to Analytics Engine for time-series analysis (if available)
    if (env.ERROR_ANALYTICS) {
      for (const error of errors) {
        env.ERROR_ANALYTICS.writeDataPoint({
          blobs: [
            error.type,                    // blob1: error type
            error.message.slice(0, 100),   // blob2: truncated message
            error.url,                     // blob3: page URL
            error.userAgent.slice(0, 100), // blob4: user agent
            error.component || 'unknown',  // blob5: component name
          ],
          doubles: [
            1,                             // double1: count (for aggregations)
          ],
          indexes: [
            error.timestamp,               // index1: timestamp for sampling
          ],
        });
      }
    }

    // Write to D1 for detailed storage (last 30 days)
    for (const error of errors) {
      await env.DB.prepare(`
        INSERT INTO error_logs (
          message, stack, type, url, user_agent,
          timestamp, component, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        error.message,
        error.stack || null,
        error.type,
        error.url,
        error.userAgent,
        error.timestamp,
        error.component || null,
        error.metadata ? JSON.stringify(error.metadata) : null
      ).run();
    }

    return Response.json({
      success: true,
      logged: errors.length
    });
  } catch (error) {
    console.error('Error logging failed:', error);
    // Don't fail the request - error logging should be best-effort
    return Response.json({ success: false }, { status: 200 });
  }
}
