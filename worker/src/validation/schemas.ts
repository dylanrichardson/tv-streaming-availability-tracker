import { z } from 'zod';

/**
 * Validation schemas for API request bodies
 * Provides runtime type checking and input sanitization
 */

// Sync endpoint - import titles by name
export const SyncRequestSchema = z.object({
  titles: z.array(z.string().trim().min(1, 'Title name cannot be empty').max(200, 'Title name too long'))
    .min(1, 'At least one title required')
    .max(50, 'Maximum 50 titles per request')
});

// Preview endpoint - search for titles to see matches before importing
export const PreviewRequestSchema = z.object({
  titles: z.array(z.string().trim().min(1).max(200))
    .min(1, 'At least one title required')
    .max(50, 'Maximum 50 titles per request')
});

// Confirm endpoint - confirm specific JustWatch matches
export const ConfirmRequestSchema = z.object({
  selections: z.array(z.object({
    query: z.string().trim().min(1).max(200),
    jwResult: z.object({
      id: z.number(),
      title: z.string(),
      object_type: z.enum(['movie', 'show']),
      fullPath: z.string().optional(),
      poster: z.string().nullable(),
      offers: z.array(z.any()).optional()  // Complex nested structure, validate at runtime
    })
  }))
  .min(1, 'At least one selection required')
  .max(50, 'Maximum 50 selections per request')
});

// Search endpoint - search for a specific title
export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1, 'Search query cannot be empty').max(200, 'Search query too long')
});

/**
 * Helper function to validate and parse request body
 * Returns parsed data or throws ZodError with validation details
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}
