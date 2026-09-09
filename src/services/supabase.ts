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

const DEFAULT_SUPABASE_URL = 'https://eguemjvapewnzzjvccna.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndWVtanZhcGV3bnp6anZjY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc0NjQsImV4cCI6MjEwNDMyMzQ2NH0.9jGJ_RzznP3cUcayGwXxRRfHkPhACYRID0hDmfnFyGw';

const supabaseUrl = getMetaEnv('VITE_SUPABASE_URL') || getMetaEnv('SUPABASE_URL') || getStoredSupabaseUrl() || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = getMetaEnv('VITE_SUPABASE_ANON_KEY') || getMetaEnv('SUPABASE_ANON_KEY') || getStoredSupabaseKey() || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
