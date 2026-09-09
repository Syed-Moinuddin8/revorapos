import { neon } from '@neondatabase/serverless';

// Get Neon connection string from environment
const getNeonConnectionString = (): string => {
  // Try various environment variable names
  if (typeof import.meta !== 'undefined') {
    const meta = import.meta as any;
    if (meta?.env?.VITE_DATABASE_URL) return meta.env.VITE_DATABASE_URL;
    if (meta?.env?.DATABASE_URL) return meta.env.DATABASE_URL;
    if (meta?.env?.VITE_NEON_DATABASE_URL) return meta.env.VITE_NEON_DATABASE_URL;
  }
  
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_DATABASE_URL) return process.env.VITE_DATABASE_URL;
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    if (process.env.VITE_NEON_DATABASE_URL) return process.env.VITE_NEON_DATABASE_URL;
  }

  // Check localStorage for runtime configuration
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cafe_pos_database_url');
      if (stored && stored.trim().length > 10) return stored.trim();
    } catch {}
  }

  return '';
};

const connectionString = getNeonConnectionString();

export const isNeonConfigured = Boolean(
  connectionString &&
  connectionString.length > 10 &&
  (connectionString.includes('neon.tech') || connectionString.includes('postgres'))
);

// Create Neon SQL client
export const sql = isNeonConfigured ? neon(connectionString) : null;

// Helper function to execute queries
export async function executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  if (!sql) {
    console.warn('[Neon] Database not configured. Using fallback.');
    return [];
  }
  
  try {
    const result = await sql(query, params);
    return result as T[];
  } catch (error) {
    console.error('[Neon] Query error:', error);
    return [];
  }
}

// Helper to execute a single query and return first result
export async function executeQueryOne<T = any>(query: string, params: any[] = []): Promise<T | null> {
  const results = await executeQuery<T>(query, params);
  return results.length > 0 ? results[0] : null;
}

// Check connection status
export async function checkConnection(): Promise<boolean> {
  if (!sql) return false;
  
  try {
    await sql`SELECT 1 as test`;
    return true;
  } catch {
    return false;
  }
}

// Log configuration status (only in development)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('[Database Config]', {
    neonConfigured: isNeonConfigured,
    hasConnectionString: !!connectionString,
  });
}

export default {
  sql,
  executeQuery,
  executeQueryOne,
  checkConnection,
  isConfigured: isNeonConfigured,
};
