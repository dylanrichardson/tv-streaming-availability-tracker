// API URL - must be set via VITE_API_URL environment variable
// For local dev: VITE_API_URL=http://localhost:8787 npm run dev
// For production: Set in .env.production or CI/CD
export const API_URL = import.meta.env.VITE_API_URL || (() => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  throw new Error('VITE_API_URL must be set in production builds');
})();
