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

const getStoredSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cafe_pos_supabase_url');
      if (stored && stored.trim().startsWith('http')) return stored.trim();
    } catch {}
  }
  return '';
};

const getStoredSupabaseKey = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cafe_pos_supabase_key');
      if (stored && stored.trim().length > 10) return stored.trim();
    } catch {}
  }
  return '';
};

const supabaseUrl = getMetaEnv('VITE_SUPABASE_URL') || getMetaEnv('SUPABASE_URL') || getStoredSupabaseUrl();
const supabaseAnonKey = getMetaEnv('VITE_SUPABASE_ANON_KEY') || getMetaEnv('SUPABASE_ANON_KEY') || getStoredSupabaseKey();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
