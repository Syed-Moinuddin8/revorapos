import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getMetaEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined') {
      const meta = import.meta as any;
      if (meta && meta.env) {
        if (key === 'VITE_SUPABASE_URL') return meta.env.VITE_SUPABASE_URL || '';
        if (key === 'SUPABASE_URL') return meta.env.SUPABASE_URL || '';
        if (key === 'VITE_SUPABASE_ANON_KEY') return meta.env.VITE_SUPABASE_ANON_KEY || '';
        if (key === 'SUPABASE_ANON_KEY') return meta.env.SUPABASE_ANON_KEY || '';
      }
    }
  } catch {}
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

const supabaseUrl = getMetaEnv('VITE_SUPABASE_URL') || getMetaEnv('SUPABASE_URL');
const supabaseAnonKey = getMetaEnv('VITE_SUPABASE_ANON_KEY') || getMetaEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
