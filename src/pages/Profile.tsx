import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useBooks } from '../lib/books';
import { errorMessage, initials } from '../lib/format';
import { useToast } from '../lib/toast';

export function ProfilePage() {
  const { session, profile, saveName, updatePassword, signOut } = useAuth();
  const { books } = useBooks();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { if (profile) setName(profile.display_name); }, [profile]);

  const done = books.filter((b) => b.status === 'concluido');
  const rated = done.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
  const year = String(new Date().getFullYear());
  const doneYear = done.filter((b) => (b.finished_on ?? '').startsWith(year)).length;
  const pages = done.reduce((a, b) => a + (b.total_pages ?? 0), 0);

  async function submitName(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 40).trim();
    if (n.length < 2) return toast('Digite um nome com pelo menos 2 letras.');
    setBusy('name');
    try { await saveName(n); toast('Nome atualizado.'); }
    catch (err) { toast(errorMessage(err)); }
    finally { setBusy(''); }
  }

  async function submitPw(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setPwError('A senha precisa ter pelo menos 8 caracteres.');
    if (pw !== pw2) return setPwError('As senhas não são iguais.');
    setPwError('');
    setBusy('pw');
    try { await updatePassword(pw); setPw(''); setPw2(''); toast('Senha alterada.'); }
    catch (err) { setPwError(errorMessage(err)); }
    finally { setBusy(''); }
  }

  async function logout() {
    setBusy('out');
    try { await signOut(); }
    catch (err) { toast(errorMessage(err, 'Não foi possível sair agora. Tente de novo.')); setBusy(''); }
  }

  const shown = profile?.display_name ?? '';
  return (
    <div className="narrow">
      <section className="profile-head">
        <span className="av big" aria-hidden="true">{initials(shown || '?')}</span>
        <div className="ph-b"><h1 id="profileName">{shown || 'Seu perfil'}</h1><p className="sub">{session?.user.email}</p></div>
      </section>

      <dl className="figures six">
        <div><dd>{done.length}</dd><dt className="mono">Concluídos</dt></div>
        <div><dd>{doneYear}</dd><dt className="mono">Concluídos em {year}</dt></div>
        <div><dd>{avg}</dd><dt className="mono">Nota média</dt></div>
        <div><dd>{pages.toLocaleString('pt-BR')}</dd><dt className="mono">Páginas concluídas</dt></div>
        <div><dd>{books.filter((b) => b.status === 'lendo').length}</dd><dt className="mono">Lendo</dt></div>
        <div><dd>{books.filter((b) => b.status === 'quero_ler').length}</dd><dt className="mono">Quero ler</dt></div>
      </dl>

      <section className="pcard">
        <h2>Seu nome</h2>
        <form className="pc-row" onSubmit={submitName}>
          <div className="field grow"><label htmlFor="pname">Como você aparece no app</label>
            <input id="pname" type="text" maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button type="submit" className="btn" id="saveName" disabled={busy === 'name'}>Salvar nome</button>
        </form>
      </section>

      <section className="pcard">
        <h2>Trocar senha</h2>
        <form className="stack" onSubmit={submitPw} noValidate>
          <div className="row2">
            <div className="field"><label htmlFor="ppw">Nova senha</label><input id="ppw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="field"><label htmlFor="ppw2">Repita a nova senha</label><input id="ppw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          </div>
          <p className="error" role="alert">{pwError}</p>
          <div className="actions"><button type="submit" className="btn" id="savePw" disabled={busy === 'pw'}>Salvar nova senha</button></div>
        </form>
      </section>

      <section className="pcard">
        <h2>Conta</h2>
        <p className="fine">Seus livros ficam guardados na sua conta. Ao entrar em outro aparelho com o mesmo e-mail, tudo aparece lá.</p>
        <div className="actions"><button type="button" className="btn danger" id="logout" disabled={busy === 'out'} onClick={() => void logout()}>Sair da conta</button></div>
      </section>
    </div>
  );
}
