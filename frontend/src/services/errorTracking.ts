import { API_URL } from '../config';

export interface ErrorDetails {
  message: string;
  stack?: string;
  type: 'api' | 'runtime' | 'render' | 'network';
  url: string;
  userAgent: string;
  timestamp: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

class ErrorTracker {
  private apiUrl: string;
  private batchQueue: ErrorDetails[] = [];
  private batchSize = 10;
  private batchTimeout = 5000; // 5 seconds
  private timeoutId?: number;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async logError(error: ErrorDetails): Promise<void> {
    this.batchQueue.push(error);

    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = window.setTimeout(() => this.flush(), this.batchTimeout);
    }
  }

  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const errors = [...this.batchQueue];
    this.batchQueue = [];

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    try {
      await fetch(`${this.apiUrl}/api/log-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
        keepalive: true, // Ensure errors are sent even during page unload
      });
    } catch (err) {
      // Silent fail - don't want error tracking to break the app
      console.error('Failed to log errors:', err);
    }
  }

  // Flush on page unload
  setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      if (this.batchQueue.length > 0) {
        // Use sendBeacon for reliable delivery during unload
        const blob = new Blob(
          [JSON.stringify({ errors: this.batchQueue })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`${this.apiUrl}/api/log-error`, blob);
      }
    });
  }
}

export const errorTracker = new ErrorTracker(API_URL);
errorTracker.setupBeforeUnload();

export function logError(
  error: Error | string,
  type: ErrorDetails['type'],
  metadata?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  errorTracker.logError({
    message,
    stack,
    type,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata,
  });
}
