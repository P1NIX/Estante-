import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { statusPatch, useBooks } from '../lib/books';
import { errorMessage, todayISO } from '../lib/format';
import { useToast } from '../lib/toast';
import { GENRES, STATUS_ORDER, type Book, type BookInput, type Status } from '../lib/types';
import { StarsInput } from '../components/Stars';
import { IconBack } from '../components/Icons';

const SINGULAR: Record<Status, string> = { lendo: 'Lendo', quero_ler: 'Quero ler', concluido: 'Concluído' };

/** Converte o texto de um campo numérico em inteiro, ou null se vazio; NaN se inválido. */
function toInt(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

/** Espera a estante carregar antes de montar o formulário, para os campos nascerem preenchidos. */
export function BookFormPage() {
  const { id } = useParams();
  const { books, loading } = useBooks();
  if (id && loading) return <p className="fine" role="status">Carregando…</p>;
  const editing = id ? books.find((b) => b.id === id) : undefined;
  if (id && !editing) return <div className="empty"><div><h2>Livro não encontrado</h2><p>Ele pode ter sido excluído.</p><Link className="btn" to="/estante">Voltar à estante</Link></div></div>;
  return <BookForm key={editing?.id ?? 'novo'} editing={editing} />;
}

function BookForm({ editing }: { editing?: Book }) {
  const [params] = useSearchParams();
  const { add, update } = useBooks();
  const toast = useToast();
  const nav = useNavigate();
  const initialStatus = (STATUS_ORDER.includes(params.get('s') as Status) ? params.get('s') : 'lendo') as Status;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [author, setAuthor] = useState(editing?.author ?? '');
  const [status, setStatus] = useState<Status>(editing?.status ?? initialStatus);
  const [genre, setGenre] = useState(editing?.genre ?? '');
  const [total, setTotal] = useState(editing?.total_pages ? String(editing.total_pages) : '');
  const [page, setPage] = useState(editing ? String(editing.current_page) : '0');
  const [started, setStarted] = useState(editing?.started_on ?? (initialStatus === 'quero_ler' ? '' : todayISO()));
  const [finished, setFinished] = useState(editing?.finished_on ?? (initialStatus === 'concluido' ? todayISO() : ''));
  const [rating, setRating] = useState<number | null>(editing?.rating ?? null);
  const [review, setReview] = useState(editing?.review ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function pickStatus(s: Status) {
    setStatus(s);
    // Mesmos ajustes automáticos dos atalhos da página do livro.
    const p = statusPatch({ started_on: started || null, finished_on: finished || null, total_pages: toInt(total) || null, current_page: toInt(page) || 0 }, s);
    if ('started_on' in p) setStarted(p.started_on ?? '');
    if ('finished_on' in p) setFinished(p.finished_on ?? '');
    if ('current_page' in p) setPage(String(p.current_page));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim(), a = author.trim(), tp = toInt(total), cp = toInt(page) ?? 0;
    if (!t) return setError('Informe o título do livro.');
    if (!a) return setError('Informe o autor ou a autora.');
    if (tp !== null && !(tp >= 1 && tp <= 20000)) return setError('O total de páginas deve ficar entre 1 e 20.000.');
    if (!(cp >= 0)) return setError('A página atual precisa ser um número inteiro.');
    if (tp !== null && cp > tp) return setError(`A página atual não pode passar do total (${tp}).`);
    if (started && finished && started > finished) return setError('A data de término vem antes da data de início.');
    const input: BookInput = {
      title: t.slice(0, 200), author: a.slice(0, 200), status, genre: genre || null, total_pages: tp,
      current_page: status === 'quero_ler' ? 0 : status === 'concluido' && tp ? tp : cp,
      started_on: status === 'quero_ler' ? null : started || null,
      finished_on: status === 'concluido' ? finished || todayISO() : null,
      rating: status === 'quero_ler' ? null : rating,
      review: review.slice(0, 20000), notes: notes.slice(0, 20000),
    };
    setError('');
    setBusy(true);
    try {
      const saved = editing ? await update(editing.id, input) : await add(input);
      toast('Livro salvo.');
      nav(`/livro/${saved.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o livro. Tente de novo.'));
      setBusy(false);
    }
  }

  const back = editing ? `/livro/${editing.id}` : '/estante';
  return (
    <div className="narrow">
      <header className="topbar">
        <Link className="btn ghost" id="back" to={back}><IconBack />Voltar</Link>
        <h1 className="panel-title">{editing ? 'Editar livro' : 'Registrar livro'}</h1>
      </header>
      <form id="bookForm" onSubmit={submit} noValidate>
        <div className="row2">
          <div className="field"><label htmlFor="title">Título</label><input id="title" type="text" autoComplete="off" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="author">Autor(a)</label><input id="author" type="text" autoComplete="off" maxLength={200} value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
        </div>

        <div className="field"><span className="lbl" id="statusLbl">Em que estante fica</span>
          <div className="seg three" role="radiogroup" aria-labelledby="statusLbl">
            {STATUS_ORDER.map((s) => (
              <label key={s}><input className="sr" type="radio" name="status" value={s} checked={status === s} onChange={() => pickStatus(s)} /><span>{SINGULAR[s]}</span></label>
            ))}
          </div>
          <span className="hint">{status === 'quero_ler' ? 'Fica na sua lista de desejos, sem datas nem progresso.' : status === 'lendo' ? 'Aparece no Início com a barra de progresso.' : 'Entra nos concluídos com nota e resenha.'}</span>
        </div>

        <div className="row2">
          <div className="field"><label htmlFor="genre">Gênero</label>
            <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Sem gênero</option>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select></div>
          <div className="field"><label htmlFor="total">Total de páginas</label>
            <input id="total" type="number" inputMode="numeric" min={1} max={20000} placeholder="Ex.: 256" value={total} onChange={(e) => setTotal(e.target.value)} />
            <span className="hint">Usado para calcular a porcentagem lida.</span></div>
        </div>

        {status !== 'quero_ler' && (
          <div className="row2">
            <div className="field"><label htmlFor="started">Comecei em</label><input id="started" type="date" max={finished || undefined} value={started} onChange={(e) => setStarted(e.target.value)} /></div>
            {status === 'concluido'
              ? <div className="field"><label htmlFor="finished">Terminei em</label><input id="finished" type="date" min={started || undefined} value={finished} onChange={(e) => setFinished(e.target.value)} /></div>
              : <div className="field"><label htmlFor="page">Página atual</label><input id="page" type="number" inputMode="numeric" min={0} max={total || undefined} value={page} onChange={(e) => setPage(e.target.value)} /></div>}
          </div>
        )}

        {status !== 'quero_ler' && (
          <>
            <div className="field"><span className="lbl" id="ratingLbl">Nota</span><StarsInput value={rating} onChange={setRating} labelledBy="ratingLbl" /></div>
            <div className="field"><label htmlFor="review">Resenha</label><textarea id="review" className="ruled" maxLength={20000} value={review} onChange={(e) => setReview(e.target.value)} placeholder="O que você achou do livro?" /></div>
          </>
        )}
        <div className="field"><label htmlFor="notes">Anotações e trechos</label><textarea id="notes" className="ruled notes" maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Frases marcadas, ideias, quem indicou…" /></div>

        <p className="error" id="bookError" role="alert">{error}</p>
        <div className="form-actions">
          <Link className="btn" to={back}>Cancelar</Link>
          <button className="btn primary" id="save" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar livro'}</button>
        </div>
      </form>
    </div>
  );
}
