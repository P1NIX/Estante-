import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  /** true até sabermos se existe sessão salva. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** true quando a pessoa chegou pelo link de "esqueci minha senha". */
  recovering: boolean;
  signIn(email: string, password: string): Promise<void>;
  /** Devolve 'confirm' quando o Supabase exige confirmar o e-mail antes de entrar. */
  signUp(name: string, email: string, password: string): Promise<'in' | 'confirm'>;
  signOut(): Promise<void>;
  requestReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  saveName(name: string): Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

// O link de recuperação chega com type=recovery no endereço; lemos antes de o cliente limpar a URL.
const cameFromRecoveryLink = typeof window !== 'undefined' && /[#&?]type=recovery\b/.test(window.location.hash + window.location.search);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(cameFromRecoveryLink);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') { setProfile(null); setRecovering(false); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const uid = session?.user.id ?? null;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase.from('profiles').select('id, display_name').eq('id', uid).maybeSingle().then(({ data }) => {
      if (alive && data) setProfile(data as Profile);
    });
    return () => { alive = false; };
  }, [uid]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    // Com confirmação de e-mail ligada, um e-mail já cadastrado volta sem identidades.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
    }
    return data.session ? 'in' : 'confirm';
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const requestReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  }, []);

  const saveName = useCallback(async (name: string) => {
    if (!uid) return;
    const { data, error } = await supabase.from('profiles').update({ display_name: name }).eq('id', uid).select('id, display_name').single();
    if (error) throw error;
    setProfile(data as Profile);
  }, [uid]);

  return (
    <AuthCtx.Provider value={{ loading, session, profile, recovering, signIn, signUp, signOut, requestReset, updatePassword, saveName }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
