const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Primeiro instante do mês atual, no fuso do aparelho, em ISO (para filtrar o histórico). */
export function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function fmtDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', opts);
}

export function monthName(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long' });
}

/** Cor estável da capa gerada, derivada do título e do autor. */
export function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function pct(page: number, total: number | null): number {
  return total && total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.charAt(0) ?? '?') + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
}

export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}

/** Traduz os erros mais comuns do Supabase para algo que a pessoa consiga resolver. */
export function errorMessage(err: unknown, fallback = 'Não foi possível concluir. Tente de novo.'): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (msg.includes('already registered') || code === 'user_already_exists') return 'Já existe uma conta com este e-mail. Use a aba Entrar.';
  if (code === 'weak_password' || msg.includes('password should be')) return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  if (code === 'same_password' || msg.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  if (code === 'over_email_send_rate_limit' || e?.status === 429 || msg.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) return 'Sem conexão com o servidor. Confira sua internet e tente de novo.';
  if (code === '23514') return 'Algum valor está fora do permitido. Confira as páginas e as datas.';
  if (code === '42501' || code === 'PGRST301') return 'Sua sessão expirou. Entre de novo.';
  return fallback;
}
