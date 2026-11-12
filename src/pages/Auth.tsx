import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/format';
import { Brand } from '../components/Layout';
import { Stars } from '../components/Stars';

type Mode = 'login' | 'signup' | 'forgot';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AuthPage() {
  const { signIn, signUp, requestReset } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Mensagem de "confira seu e-mail" depois do cadastro ou do pedido de nova senha. */
  const [sent, setSent] = useState<'' | 'confirm' | 'reset'>('');

  const change = (m: Mode) => { setMode(m); setError(''); setSent(''); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (mode === 'signup' && name.trim().length < 2) return setError('Informe seu nome.');
    if (!EMAIL_RE.test(mail)) return setError('Digite um e-mail válido, como voce@exemplo.com.');
    if (mode !== 'forgot') {
      if (mode === 'signup' && pw.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
      if (mode === 'login' && !pw) return setError('Digite sua senha.');
      if (mode === 'signup' && pw !== pw2) return setError('As senhas não são iguais.');
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(mail, pw);
      else if (mode === 'signup') { if ((await signUp(name.trim().slice(0, 40), mail, pw)) === 'confirm') setSent('confirm'); }
      else { await requestReset(mail); setSent('reset'); }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth wrap">
      <section className="auth-hero">
        <Brand />
        <h1>Sua biblioteca, seu diário de leitura e seus amigos leitores.</h1>
        <p className="lede">Registre o que quer ler, o que está lendo e o que já terminou. Acompanhe seu progresso em qualquer aparelho.</p>
        <div className="sample" aria-label="Exemplo de ficha de leitura">
          <span className="tag mono">Exemplo</span>
          <div className="row"><b>Título</b><span>Dom Casmurro</span></div>
          <div className="row"><b>Autor</b><span>Machado de Assis</span></div>
          <div className="row"><b>Nota</b><span><Stars value={5} /></span></div>
          <div className="row"><b>Progresso</b><span>página 128 de 256</span></div>
        </div>
      </section>

      <section className="auth-panel">
        {sent ? (
          <div className="sent" role="status">
            <h2>Confira seu e-mail</h2>
            <p>
              {sent === 'confirm'
                ? <>Enviamos um link de confirmação para <b>{email.trim().toLowerCase()}</b>. Abra o link para ativar sua conta e depois entre aqui.</>
                : <>Se existir uma conta com <b>{email.trim().toLowerCase()}</b>, enviamos um link para criar uma nova senha.</>}
            </p>
            <p className="fine">Não chegou? Veja a caixa de spam ou tente de novo em alguns minutos.</p>
            <button type="button" className="btn" id="backToLogin" onClick={() => change('login')}>Voltar para Entrar</button>
          </div>
        ) : (
          <>
            {mode === 'forgot' ? (
              <h2 className="panel-title">Criar nova senha</h2>
            ) : (
              <div className="tabs" role="tablist" aria-label="Acesso">
                <button type="button" role="tab" id="tab-login" aria-selected={mode === 'login'} onClick={() => change('login')}>Entrar</button>
                <button type="button" role="tab" id="tab-signup" aria-selected={mode === 'signup'} onClick={() => change('signup')}>Criar conta</button>
              </div>
            )}
            <form id="authForm" onSubmit={submit} noValidate>
              {mode === 'forgot' && <p className="fine">Informe o e-mail da sua conta. Enviaremos um link para você escolher uma nova senha.</p>}
              {mode === 'signup' && (
                <div className="field"><label htmlFor="name">Seu nome</label>
                  <input id="name" type="text" autoComplete="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></div>
              )}
              <div className="field"><label htmlFor="email">E-mail</label>
                <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {mode !== 'forgot' && (
                <div className="field"><label htmlFor="pw">Senha</label>
                  <div className="pwrow">
                    <input id="pw" type={showPw ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
                    <button type="button" className="linkbtn" aria-controls="pw" onClick={() => setShowPw((v) => !v)}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
                  </div>
                  {mode === 'signup' && <span className="hint">Use pelo menos 8 caracteres.</span>}
                </div>
              )}
              {mode === 'signup' && (
                <div className="field"><label htmlFor="pw2">Repita a senha</label>
                  <input id="pw2" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
              )}
              <p className="error" id="authError" role="alert">{error}</p>
              <button className="btn primary block" type="submit" disabled={busy}>
                {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
              </button>
            </form>
            {mode === 'login' && <button type="button" className="linkbtn" id="forgot" onClick={() => change('forgot')}>Esqueci minha senha</button>}
            {mode === 'forgot' && <button type="button" className="linkbtn" id="backToLogin" onClick={() => change('login')}>Voltar para Entrar</button>}
            <p className="fine">Sua conta fica protegida no servidor e seus livros acompanham você em qualquer aparelho.</p>
          </>
        )}
      </section>
    </main>
  );
}
