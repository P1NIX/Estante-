import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useBooks } from '../lib/books';
import { fmtDate, monthName, monthStart, pct, plural } from '../lib/format';
import { Cover } from '../components/Cover';
import { Progress } from '../components/Progress';
import { IconPlus } from '../components/Icons';

export function HomePage() {
  const { profile } = useAuth();
  const { books, loading, error, reload, monthPages } = useBooks();
  const first = (profile?.display_name ?? '').split(' ')[0];

  if (loading) return <p className="fine" role="status">Carregando sua estante…</p>;
  if (error) return <div className="notice" role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => void reload()}>Tentar de novo</button></div>;

  const reading = books.filter((b) => b.status === 'lendo');
  const queue = books.filter((b) => b.status === 'quero_ler').slice(0, 4);
  const start = monthStart();
  const doneThisMonth = books.filter((b) => b.status === 'concluido' && b.finished_on && new Date(`${b.finished_on}T12:00:00`) >= start).length;

  return (
    <>
      <section className="intro">
        <h1>{first ? `Olá, ${first}.` : 'Olá.'}</h1>
        <p className="sub">{books.length ? plural(books.length, 'livro na sua estante', 'livros na sua estante') : 'Sua estante está esperando o primeiro livro.'}</p>
      </section>

      {!books.length ? (
        <div className="empty">
          <div className="ghost-cover" aria-hidden="true" />
          <div>
            <h2>Comece pela sua leitura atual</h2>
            <p>Registre o livro que você está lendo, um que quer ler ou um que já terminou. O progresso e o resumo do mês aparecem aqui.</p>
            <Link className="btn primary" to="/livro/novo" id="addFirst"><IconPlus />Registrar o primeiro livro</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="home-sec" aria-labelledby="nowT">
            <div className="sec-head"><h2 id="nowT" className="h-sec">Lendo agora</h2></div>
            {reading.length ? (
              <div className="now-list">
                {reading.map((b) => (
                  <Link key={b.id} to={`/livro/${b.id}`} className="now">
                    <div className="now-cover"><Cover title={b.title} author={b.author} /></div>
                    <div className="now-body">
                      <h3>{b.title}</h3>
                      <p className="sub">{b.author}</p>
                      {b.total_pages ? (
                        <>
                          <Progress page={b.current_page} total={b.total_pages} label={`Progresso de ${b.title}`} />
                          <p className="now-pct"><b>{pct(b.current_page, b.total_pages)}%</b><span className="fine">página {b.current_page} de {b.total_pages}</span></p>
                        </>
                      ) : (
                        <p className="fine">{b.current_page > 0 ? `Página ${b.current_page}. ` : ''}Informe o total de páginas para ver a porcentagem.</p>
                      )}
                      {b.started_on && <p className="mono">Desde {fmtDate(b.started_on, { day: 'numeric', month: 'short' })}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="quiet">Nenhuma leitura em andamento. Abra um livro da lista “Quero ler” e toque em “Começar a ler”.</p>
            )}
          </section>

          <section className="home-sec" aria-labelledby="monthT">
            <div className="sec-head"><h2 id="monthT" className="h-sec">Seu mês de {monthName()}</h2></div>
            <dl className="figures">
              <div><dd id="monthPages">{monthPages.toLocaleString('pt-BR')}</dd><dt className="mono">{monthPages === 1 ? 'Página lida' : 'Páginas lidas'}</dt></div>
              <div><dd>{doneThisMonth}</dd><dt className="mono">{doneThisMonth === 1 ? 'Livro concluído' : 'Livros concluídos'}</dt></div>
              <div><dd>{reading.length}</dd><dt className="mono">Em andamento</dt></div>
            </dl>
            <p className="fine">As páginas contam a partir de cada vez que você registra a página em que está.</p>
          </section>

          {queue.length > 0 && (
            <section className="home-sec" aria-labelledby="queueT">
              <div className="sec-head"><h2 id="queueT" className="h-sec">Na fila</h2><Link className="linkbtn" to="/estante?s=quero_ler">Ver todos</Link></div>
              <div className="strip">
                {queue.map((b) => (
                  <Link key={b.id} to={`/livro/${b.id}`} className="book">
                    <Cover title={b.title} author={b.author} />
                    <div><h3>{b.title}</h3><div className="by">{b.author}</div></div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
