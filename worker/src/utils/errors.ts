/**
 * Build a standardized error response for API endpoints
 * Logs the error to console with detailed context and returns a formatted JSON response
 *
 * @param error - The error that occurred (unknown type from catch block)
 * @param message - Human-readable error message to return to client
 * @param status - HTTP status code (default: 500)
 * @param context - Optional context object for debugging
 * @returns Response object with error details
 */
export function buildErrorResponse(
  error: unknown,
  message: string,
  status = 500,
  context?: Record<string, unknown>
): Response {
  // Structured error logging for monitoring
  const errorLog = {
    timestamp: new Date().toISOString(),
    message,
    status,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context
  };

  console.error('[Error]', JSON.stringify(errorLog, null, 2));

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorDetails = {
    error: message,
    details: errorMessage,
    timestamp: new Date().toISOString()
  };

  return Response.json(errorDetails, { status });
}
