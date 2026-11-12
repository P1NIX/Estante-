import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBooks } from '../lib/books';
import { errorMessage, fmtDate, hue, pct } from '../lib/format';
import { useToast } from '../lib/toast';
import type { Book } from '../lib/types';
import { Cover } from '../components/Cover';
import { Stars } from '../components/Stars';
import { Progress } from '../components/Progress';
import { IconBack } from '../components/Icons';

const STATUS_TAG = { lendo: 'Lendo', quero_ler: 'Quero ler', concluido: 'Concluído' } as const;

function headline(b: Book): string {
  const parts: string[] = [STATUS_TAG[b.status]];
  if (b.status === 'concluido' && b.finished_on) parts.push(`em ${fmtDate(b.finished_on)}`);
  if (b.status === 'lendo' && b.started_on) parts.push(`desde ${fmtDate(b.started_on, { day: 'numeric', month: 'long' })}`);
  let s = parts.join(' ');
  if (b.total_pages) s += ` · ${b.total_pages} páginas`;
  if (b.genre) s += ` · ${b.genre}`;
  return s;
}

export function BookDetailPage() {
  const { id } = useParams();
  const { books, loading, setPage, setStatus, remove } = useBooks();
  const toast = useToast();
  const nav = useNavigate();
  const book = books.find((b) => b.id === id);
  const [pageDraft, setPageDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (book) setPageDraft(String(book.current_page)); }, [book?.id, book?.current_page]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="fine" role="status">Carregando…</p>;
  if (!book) return <div className="empty"><div><h2>Livro não encontrado</h2><p>Ele pode ter sido excluído.</p><Link className="btn" to="/estante">Voltar à estante</Link></div></div>;

  /** Executa uma ação que fala com o servidor, com trava de clique duplo e aviso de erro. */
  async function run(action: () => Promise<Book | void>, ok: (b: Book | void) => string) {
    if (busy) return;
    setBusy(true);
    try { toast(ok(await action())); }
    catch (err) { toast(errorMessage(err)); }
    finally { setBusy(false); }
  }

  function savePage(target: number) {
    const b = book!;
    if (!Number.isInteger(target) || target < 0) return toast('Digite um número de página válido.');
    if (b.total_pages && target > b.total_pages) return toast(`O livro tem ${b.total_pages} páginas.`);
    if (target === b.current_page) return toast('Você já está nessa página.');
    void run(() => setPage(b, target), (saved) => {
      const s = saved as Book;
      return s.status === 'concluido' && b.status !== 'concluido'
        ? 'Livro concluído. Parabéns!'
        : `Página ${s.current_page}${s.total_pages ? ` de ${s.total_pages} (${pct(s.current_page, s.total_pages)}%)` : ''} registrada.`;
    });
  }
  const submitPage = (e: FormEvent) => { e.preventDefault(); savePage(Number(pageDraft)); };

  async function del() {
    setBusy(true);
    try { await remove(book!.id); toast('Livro excluído.'); nav('/estante', { replace: true }); }
    catch (err) { toast(errorMessage(err, 'Não foi possível excluir. Tente de novo.')); setBusy(false); }
  }

  const p = pct(book.current_page, book.total_pages);
  return (
    <>
      <header className="topbar">
        <Link className="btn ghost" id="back" to={`/estante${book.status === 'lendo' ? '' : `?s=${book.status}`}`}><IconBack />Estante</Link>
        <div className="actions">
          <Link className="btn" id="edit" to={`/livro/${book.id}/editar`}>Editar</Link>
          <button type="button" className="btn danger" id="del" onClick={() => setConfirming(true)}>Excluir</button>
        </div>
      </header>

      {confirming && (
        <div className="confirm" role="alertdialog" aria-label="Confirmar exclusão">
          <p>Excluir “{book.title}”? A resenha, as anotações e o histórico de progresso serão apagados e não dá para desfazer.</p>
          <div className="actions">
            <button type="button" className="btn" id="confirmNo" onClick={() => setConfirming(false)}>Cancelar</button>
            <button type="button" className="btn danger solid" id="confirmYes" disabled={busy} onClick={() => void del()}>Excluir livro</button>
          </div>
        </div>
      )}

      <article className="detail">
        <section className="hero" style={{ ['--h' as string]: hue(book.title + book.author) }}>
          <div className="detail-cover"><Cover title={book.title} author={book.author} /></div>
          <div className="detail-head">
            <p className="mono" id="headline">{headline(book)}</p>
            <h1>{book.title}</h1>
            <p className="author">{book.author}</p>
            {book.status !== 'quero_ler' && <div className="rate"><Stars value={book.rating} big />{book.rating ? <span className="mono">{book.rating} de 5</span> : null}</div>}
            <div className="quick">
              {book.status === 'quero_ler' && <button type="button" className="btn primary" id="startReading" disabled={busy} onClick={() => void run(() => setStatus(book, 'lendo'), () => 'Boa leitura! O livro foi para “Lendo”.')}>Começar a ler</button>}
              {book.status === 'lendo' && <button type="button" className="btn primary" id="finish" disabled={busy} onClick={() => void run(() => setStatus(book, 'concluido'), () => 'Livro concluído. Parabéns!')}>Marcar como concluído</button>}
              {book.status === 'concluido' && <button type="button" className="btn" id="reread" disabled={busy} onClick={() => void run(() => setStatus(book, 'lendo'), () => 'O livro voltou para “Lendo”.')}>Ler de novo</button>}
            </div>
          </div>
        </section>

        {book.status === 'lendo' && (
          <section className="sec progress-sec" aria-labelledby="progT">
            <h2 id="progT">Progresso</h2>
            {book.total_pages ? (
              <>
                <div className="prog-line"><b className="prog-pct" id="pctNow">{p}%</b><span className="fine">página {book.current_page} de {book.total_pages}</span></div>
                <Progress page={book.current_page} total={book.total_pages} label="Progresso da leitura" />
              </>
            ) : (
              <p className="fine">Informe o total de páginas em Editar para ver a porcentagem. Página atual: {book.current_page}.</p>
            )}
            <form className="mine-row" onSubmit={submitPage} noValidate>
              <div className="field"><label htmlFor="pageNow">Estou na página</label>
                <input id="pageNow" type="number" inputMode="numeric" min={0} max={book.total_pages ?? undefined} value={pageDraft} onChange={(e) => setPageDraft(e.target.value)} /></div>
              <button type="submit" className="btn primary" id="savePage" disabled={busy}>Registrar página</button>
              <button type="button" className="btn" id="plus10" disabled={busy} onClick={() => savePage(Math.min(book.total_pages ?? Infinity, book.current_page + 10))}>+10 páginas</button>
            </form>
          </section>
        )}

        <div className="detail-main">
          {book.status !== 'quero_ler' && (
            <section className="sec"><h2>Resenha</h2>
              <div className="ruled">{book.review || <span className="none">Ainda sem resenha. Toque em Editar para escrever.</span>}</div></section>
          )}
          <section className="sec"><h2>Anotações e trechos</h2>
            <div className="ruled notes">{book.notes || <span className="none">Nenhuma anotação.</span>}</div></section>
        </div>
      </article>
    </>
  );
}
