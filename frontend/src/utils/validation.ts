/**
 * Frontend form validation utilities
 * Validates user input before sending to API
 */

const MAX_TITLE_LENGTH = 200;
const MAX_TITLES_PER_REQUEST = 50;
const MIN_TITLE_LENGTH = 1;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedTitles?: string[];
}

/**
 * Sanitize and validate title input
 * Removes extra whitespace, filters empty entries, checks length constraints
 */
export function validateTitleInput(input: string): ValidationResult {
  // Split by newlines and commas, trim whitespace
  const titles = input
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Check if empty
  if (titles.length === 0) {
    return {
      valid: false,
      error: 'Please enter at least one title'
    };
  }

  // Check max count
  if (titles.length > MAX_TITLES_PER_REQUEST) {
    return {
      valid: false,
      error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import. You entered ${titles.length} titles.`
    };
  }

  // Check individual title lengths
  const tooLong = titles.filter(t => t.length > MAX_TITLE_LENGTH);
  if (tooLong.length > 0) {
    return {
      valid: false,
      error: `Some titles are too long (max ${MAX_TITLE_LENGTH} characters). First invalid: "${tooLong[0].substring(0, 50)}..."`
    };
  }

  const tooShort = titles.filter(t => t.length < MIN_TITLE_LENGTH);
  if (tooShort.length > 0) {
    return {
      valid: false,
      error: 'All titles must be at least 1 character long'
    };
  }

  // Check for potentially malicious patterns (basic XSS prevention)
  const suspiciousPatterns = /<script|javascript:|onerror=|onclick=/i;
  const suspicious = titles.filter(t => suspiciousPatterns.test(t));
  if (suspicious.length > 0) {
    return {
      valid: false,
      error: 'Invalid characters detected in title names'
    };
  }

  return {
    valid: true,
    sanitizedTitles: titles
  };
}

/**
 * Validate search query input
 */
export function validateSearchQuery(query: string): ValidationResult {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Search query cannot be empty'
    };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `Search query too long (max ${MAX_TITLE_LENGTH} characters)`
    };
  }

  // Check for potentially malicious patterns
  const suspiciousPatterns = /<script|javascript:|onerror=|onclick=/i;
  if (suspiciousPatterns.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid characters in search query'
    };
  }

  return {
    valid: true,
    sanitizedTitles: [trimmed]
  };
}
