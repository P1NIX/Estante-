import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Falso enquanto o .env.local não tiver os dados de um projeto Supabase real. */
export const configured =
  !!url && !!anonKey && /^https?:\/\//.test(url) && !url.includes('SEU-PROJETO') && !anonKey.startsWith('sua-chave');

/**
 * Cliente único do app. Só a chave pública (anon) entra no frontend;
 * quem protege os dados são as políticas RLS do banco.
 */
export const supabase: SupabaseClient = configured ? createClient(url!, anonKey!) : (null as unknown as SupabaseClient);
