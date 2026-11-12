import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBooks } from '../lib/books';
import { fmtDate, norm, pct } from '../lib/format';
import { STATUS_LABEL, STATUS_ORDER, type Book, type Status } from '../lib/types';
import { Cover } from '../components/Cover';
import { Stars } from '../components/Stars';
import { Progress } from '../components/Progress';
import { IconGrid, IconList, IconPlus, IconSearch } from '../components/Icons';

type Sort = 'recent' | 'title' | 'author' | 'rating';
type View = 'grid' | 'list';

/** Preferência de visualização fica só neste aparelho; não é dado da conta. */
function savedView(): View {
  try { return localStorage.getItem('estante.view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}

function meta(b: Book): string {
  if (b.status === 'concluido') return b.finished_on ? `Concluído em ${fmtDate(b.finished_on, { month: 'short', year: 'numeric' })}` : 'Concluído';
  if (b.status === 'lendo') return b.total_pages ? `${pct(b.current_page, b.total_pages)}% · página ${b.current_page} de ${b.total_pages}` : `Página ${b.current_page}`;
  return b.total_pages ? `${b.total_pages} páginas` : 'Na fila';
}

export function ShelfPage() {
  const { books, loading, error, reload } = useBooks();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('s') as Status | null;
  const status: Status = fromUrl && STATUS_ORDER.includes(fromUrl) ? fromUrl : 'lendo';
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<View>(savedView);

  useEffect(() => { try { localStorage.setItem('estante.view', view); } catch { /* sem armazenamento local */ } }, [view]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { lendo: 0, quero_ler: 0, concluido: 0 };
    books.forEach((b) => { c[b.status] += 1; });
    return c;
  }, [books]);
  const genres = useMemo(() => Array.from(new Set(books.map((b) => b.genre).filter((g): g is string => !!g))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [books]);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    const out = books.filter((b) =>
      b.status === status &&
      (!nq || norm(`${b.title} ${b.author}`).includes(nq)) &&
      (!genre || b.genre === genre) &&
      (!minRating || (b.rating ?? 0) >= minRating));
    out.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'author') return a.author.localeCompare(b.author, 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title, 'pt-BR');
      return b.updated_at.localeCompare(a.updated_at);
    });
    return out;
  }, [books, status, q, genre, minRating, sort]);

  if (loading) return <p className="fine" role="status">Carregando sua estante…</p>;
  if (error) return <div className="notice" role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => void reload()}>Tentar de novo</button></div>;

  const filtered = !!(q.trim() || genre || minRating);
  const clear = () => { setQ(''); setGenre(''); setMinRating(0); };

  return (
    <section className="shelf">
      <div className="sec-head">
        <h1 className="page-title">Estante</h1>
        <Link className="btn primary" id="add" to={`/livro/novo?s=${status}`}><IconPlus />Registrar livro</Link>
      </div>

      <div className="status-tabs" role="tablist" aria-label="Categorias da estante">
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" role="tab" id={`st-${s}`} aria-selected={status === s} onClick={() => setParams(s === 'lendo' ? {} : { s }, { replace: true })}>
            {STATUS_LABEL[s]}<span className="count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {books.length > 0 && (
        <div className="toolbar">
          <div className="search"><IconSearch /><label className="sr" htmlFor="q">Buscar por título ou autor</label>
            <input id="q" type="search" placeholder="Buscar por título ou autor" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <label className="sr" htmlFor="genre">Gênero</label>
          <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">Todos os gêneros</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <label className="sr" htmlFor="minRating">Avaliação</label>
          <select id="minRating" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Qualquer nota</option>
            <option value={5}>5 estrelas</option>
            <option value={4}>4 ou mais</option>
            <option value={3}>3 ou mais</option>
          </select>
          <label className="sr" htmlFor="sort">Ordenar</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Atualizados por último</option>
            <option value="title">Título (A a Z)</option>
            <option value="author">Autor (A a Z)</option>
            <option value="rating">Melhor nota</option>
          </select>
          <div className="viewsw" role="group" aria-label="Visualização">
            <button type="button" id="viewGrid" aria-pressed={view === 'grid'} aria-label="Ver em grade" onClick={() => setView('grid')}><IconGrid /></button>
            <button type="button" id="viewList" aria-pressed={view === 'list'} aria-label="Ver em lista" onClick={() => setView('list')}><IconList /></button>
          </div>
        </div>
      )}

      {!list.length ? (
        <div className="empty">
          <div>
            {filtered ? (
              <><h2>Nada encontrado</h2><p>Nenhum livro de “{STATUS_LABEL[status]}” corresponde aos filtros.</p>
                <button type="button" className="btn" id="clearFilters" onClick={clear}>Limpar filtros</button></>
            ) : (
              <><h2>{status === 'lendo' ? 'Nenhuma leitura em andamento' : status === 'quero_ler' ? 'Sua lista de desejos está vazia' : 'Nenhum livro concluído ainda'}</h2>
                <p>{status === 'lendo' ? 'Registre o livro que você está lendo para acompanhar o progresso.' : status === 'quero_ler' ? 'Guarde aqui os livros que você quer ler depois.' : 'Os livros que você terminar aparecem aqui, com nota e resenha.'}</p>
                <Link className="btn primary" to={`/livro/novo?s=${status}`}><IconPlus />Registrar livro</Link></>
            )}
          </div>
        </div>
      ) : view === 'grid' ? (
        <div id="grid" className="grid">
          {list.map((b) => (
            <Link key={b.id} to={`/livro/${b.id}`} className="book" data-id={b.id}>
              <Cover title={b.title} author={b.author} />
              <div><h3>{b.title}</h3><div className="by">{b.author}</div></div>
              {b.status === 'lendo' && b.total_pages ? <Progress page={b.current_page} total={b.total_pages} label={`Progresso de ${b.title}`} /> : null}
              {b.status === 'concluido' ? <Stars value={b.rating} /> : <span className="fine">{meta(b)}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <ul id="grid" className="rows">
          {list.map((b) => (
            <li key={b.id}>
              <Link to={`/livro/${b.id}`} className="rowbook" data-id={b.id}>
                <div className="row-cover"><Cover title={b.title} author={b.author} /></div>
                <div className="row-body">
                  <h3>{b.title}</h3>
                  <div className="by">{b.author}{b.genre ? ` · ${b.genre}` : ''}</div>
                  <span className="fine">{meta(b)}</span>
                </div>
                {b.status === 'concluido' && <Stars value={b.rating} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
