import { logError } from '../services/errorTracking';

export function setupGlobalErrorHandlers(): void {
  // Catch unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    logError(event.error || event.message, 'runtime', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      'runtime',
      {
        type: 'unhandled_promise_rejection',
      }
    );
  });
}
