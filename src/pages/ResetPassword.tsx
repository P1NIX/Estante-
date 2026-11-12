import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/format';
import { useToast } from '../lib/toast';
import { Brand } from '../components/Layout';

/** Destino do link "esqueci minha senha". Só funciona com a sessão criada por esse link. */
export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (pw !== pw2) return setError('As senhas não são iguais.');
    setError('');
    setBusy(true);
    try {
      await updatePassword(pw);
      toast('Senha alterada.');
      nav('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap narrow solo">
      <Brand />
      <section className="auth-panel">
        <h1 className="panel-title">Nova senha</h1>
        {loading ? (
          <p className="fine" role="status">Conferindo o link…</p>
        ) : !session ? (
          <>
            <p>Este link expirou ou já foi usado. Peça um novo na tela de entrada, em “Esqueci minha senha”.</p>
            <Link className="btn" to="/">Ir para a entrada</Link>
          </>
        ) : (
          <form id="resetForm" onSubmit={submit} noValidate>
            <div className="field"><label htmlFor="npw">Nova senha</label>
              <input id="npw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <span className="hint">Use pelo menos 8 caracteres.</span></div>
            <div className="field"><label htmlFor="npw2">Repita a nova senha</label>
              <input id="npw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <p className="error" role="alert">{error}</p>
            <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
