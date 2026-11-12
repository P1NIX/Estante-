// Servidor de mentira SÓ PARA TESTES: responde como a API do Supabase (Auth + REST) a partir
// de dados em memória, para exercitar as telas sem um projeto real. Não faz parte do app.
// As regras de acesso de verdade são testadas em tests/rls_test.sql contra um PostgreSQL.
import { randomUUID } from 'node:crypto';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function createMock() {
  const db = { users: new Map(), profiles: new Map(), books: new Map(), progress: [], tokens: new Map(), refresh: new Map() };
  const opts = { confirmEmails: false, failBooksOnce: false, recoverRequests: [] };
  let tick = 0;
  const now = () => new Date(Date.now() + tick++).toISOString(); // carimbos sempre crescentes

  function session(user) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', exp })}.${randomUUID().replace(/-/g, '')}`;
    const refresh = randomUUID();
    db.tokens.set(access, user.id);
    db.refresh.set(refresh, user.id);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: pub(user) };
  }
  const pub = (u) => ({
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.confirmed ? u.created : null,
    app_metadata: { provider: 'email' }, user_metadata: u.meta, identities: [{ id: u.id, provider: 'email' }], created_at: u.created, updated_at: u.created,
  });
  const byEmail = (email) => [...db.users.values()].find((u) => u.email === email);
  const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const authErr = (status, code, msg) => json(status, { code: status, error_code: code, msg });
  const pgErr = (status, code, message) => json(status, { code, message, details: null, hint: null });

  function checkBook(b) {
    if (!b.title?.trim() || !b.author?.trim()) return '23514';
    if (b.total_pages != null && !(b.total_pages >= 1 && b.total_pages <= 20000)) return '23514';
    if (!(b.current_page >= 0) || (b.total_pages != null && b.current_page > b.total_pages)) return '23514';
    if (b.started_on && b.finished_on && b.started_on > b.finished_on) return '23514';
    if (b.rating != null && !(b.rating >= 1 && b.rating <= 5)) return '23514';
    // Mesmo check "status_coerente" da migração 0002.
    if (b.status === 'quero_ler' && (b.current_page !== 0 || b.started_on || b.finished_on || b.rating != null)) return '23514';
    if (b.status === 'lendo' && b.finished_on) return '23514';
    return null;
  }

  /** Recebe {method, url, headers, body} e devolve {status, contentType, body}. */
  function handle({ method, url, headers, body }) {
    const u = new URL(url);
    const path = u.pathname;
    const data = body ? JSON.parse(body) : {};
    const bearer = (headers.authorization || '').replace(/^Bearer /i, '');
    const uid = db.tokens.get(bearer) || null;
    const wantsObject = (headers.accept || '').includes('vnd.pgrst.object');
    const eqId = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    const one = (rows) => (wantsObject ? (rows.length === 1 ? json(200, rows[0]) : pgErr(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned')) : json(200, rows));

    // ---------- Auth ----------
    if (path === '/auth/v1/signup' && method === 'POST') {
      if (byEmail(data.email)) return authErr(422, 'user_already_exists', 'User already registered');
      if ((data.password || '').length < 6) return authErr(422, 'weak_password', 'Password should be at least 6 characters');
      const user = { id: randomUUID(), email: data.email, password: data.password, meta: data.data || {}, confirmed: !opts.confirmEmails, created: now() };
      db.users.set(user.id, user);
      const name = String(user.meta.display_name || '').trim().slice(0, 40);
      db.profiles.set(user.id, { id: user.id, display_name: name.length < 2 ? 'Leitor' : name }); // mesmo efeito do gatilho do banco
      return json(200, user.confirmed ? session(user) : pub(user));
    }
    if (path === '/auth/v1/token' && method === 'POST') {
      if (u.searchParams.get('grant_type') === 'refresh_token') {
        const user = db.users.get(db.refresh.get(data.refresh_token));
        return user ? json(200, session(user)) : authErr(400, 'refresh_token_not_found', 'Invalid Refresh Token');
      }
      const user = byEmail(data.email);
      if (!user || user.password !== data.password) return authErr(400, 'invalid_credentials', 'Invalid login credentials');
      if (!user.confirmed) return authErr(400, 'email_not_confirmed', 'Email not confirmed');
      return json(200, session(user));
    }
    if (path === '/auth/v1/recover' && method === 'POST') { opts.recoverRequests.push(data.email); return json(200, {}); }
    if (path === '/auth/v1/logout' && method === 'POST') { db.tokens.delete(bearer); return { status: 204, contentType: 'application/json', body: '' }; }
    if (path === '/auth/v1/user') {
      const user = db.users.get(uid);
      if (!user) return authErr(401, 'bad_jwt', 'invalid JWT');
      if (method === 'PUT') {
        if (data.password) {
          if (data.password.length < 6) return authErr(422, 'weak_password', 'Password should be at least 6 characters');
          if (data.password === user.password) return authErr(422, 'same_password', 'New password should be different from the old password.');
          user.password = data.password;
        }
      }
      return json(200, pub(user));
    }

    // ---------- REST (linhas do próprio usuário, como o RLS faria) ----------
    if (path.startsWith('/rest/v1/')) {
      if (!uid) return pgErr(401, 'PGRST301', 'JWT expired');
      const table = path.slice('/rest/v1/'.length);

      if (table === 'profiles') {
        const mine = db.profiles.get(uid);
        if (method === 'GET') return wantsObject ? json(200, eqId === uid ? mine : null) : json(200, eqId === uid && mine ? [mine] : []);
        if (method === 'PATCH') {
          if (eqId !== uid) return one([]);
          const n = String(data.display_name ?? mine.display_name);
          if (n.length < 2 || n.length > 40) return pgErr(400, '23514', 'check constraint');
          mine.display_name = n;
          return one([mine]);
        }
      }

      if (table === 'books') {
        const mine = () => [...db.books.values()].filter((b) => b.user_id === uid);
        if (method === 'GET') {
          if (opts.failBooksOnce) { opts.failBooksOnce = false; return pgErr(500, 'XX000', 'internal error'); }
          return json(200, mine().sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
        }
        if (method === 'POST') {
          const t = now();
          const row = { id: randomUUID(), user_id: uid, status: 'quero_ler', genre: null, total_pages: null, current_page: 0, started_on: null, finished_on: null, rating: null, review: '', notes: '', ...data, created_at: t, updated_at: t };
          if (row.user_id !== uid) return pgErr(403, '42501', 'new row violates row-level security policy');
          const bad = checkBook(row);
          if (bad) return pgErr(400, bad, 'check constraint');
          db.books.set(row.id, row);
          return wantsObject ? json(201, row) : json(201, [row]);
        }
        const target = db.books.get(eqId);
        const own = target && target.user_id === uid ? target : null;
        if (method === 'PATCH') {
          if (!own) return one([]);
          const next = { ...own, ...data, id: own.id, user_id: own.user_id, updated_at: now() };
          const bad = checkBook(next);
          if (bad) return pgErr(400, bad, 'check constraint');
          // Mesmas regras do gatilho log_reading_progress (migração 0002): recomeços e "fila -> concluído" não entram.
          const statusChanged = next.status !== own.status;
          const skip = statusChanged && (next.current_page === 0 || (own.status === 'quero_ler' && next.status === 'concluido'));
          if (next.current_page !== own.current_page && !skip) db.progress.push({ user_id: uid, book_id: own.id, from_page: own.current_page, to_page: next.current_page, logged_at: now() });
          db.books.set(own.id, next);
          return one([next]);
        }
        if (method === 'DELETE') {
          if (own) { db.books.delete(own.id); db.progress = db.progress.filter((p) => p.book_id !== own.id); }
          return { status: 204, contentType: 'application/json', body: '' };
        }
      }

      if (table === 'reading_progress' && method === 'GET') {
        const since = (u.searchParams.get('logged_at') || '').replace(/^gte\./, '');
        return json(200, db.progress.filter((p) => p.user_id === uid && (!since || p.logged_at >= since)).map(({ book_id, from_page, to_page, logged_at }) => ({ book_id, from_page, to_page, logged_at })));
      }
    }
    return json(404, { message: `rota não simulada: ${method} ${path}` });
  }

  return { db, opts, handle, session, byEmail };
}
