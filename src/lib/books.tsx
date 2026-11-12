import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { monthStart, todayISO } from './format';
import type { Book, BookInput, ProgressRow, Status } from './types';

interface BooksState {
  loading: boolean;
  /** Mensagem pronta quando o carregamento falha; null se deu certo. */
  error: string | null;
  books: Book[];
  /** Páginas avançadas neste mês, somadas a partir do histórico gravado pelo banco. */
  monthPages: number;
  reload(): Promise<void>;
  add(input: BookInput): Promise<Book>;
  update(id: string, patch: Partial<BookInput>): Promise<Book>;
  remove(id: string): Promise<void>;
  /** Registra a página atual; ao chegar no total, o livro vira "concluído". */
  setPage(book: Book, page: number): Promise<Book>;
  setStatus(book: Book, status: Status): Promise<Book>;
}

const BooksCtx = createContext<BooksState | null>(null);

/** Ajustes que acompanham a troca de status, iguais na tela de edição e nos atalhos. */
export function statusPatch(book: Pick<Book, 'status' | 'started_on' | 'finished_on' | 'total_pages' | 'current_page'>, status: Status): Partial<BookInput> {
  const patch: Partial<BookInput> = { status };
  if (status === 'lendo') {
    if (book.status === 'concluido') {
      // Releitura: começa do zero, com a data de hoje.
      patch.started_on = todayISO();
      patch.current_page = 0;
    } else if (!book.started_on) {
      patch.started_on = todayISO();
    }
    patch.finished_on = null;
  }
  if (status === 'concluido') {
    if (!book.finished_on) patch.finished_on = todayISO();
    if (book.total_pages) patch.current_page = book.total_pages;
  }
  if (status === 'quero_ler') {
    patch.started_on = null;
    patch.finished_on = null;
    patch.current_page = 0;
    patch.rating = null;
  }
  return patch;
}

export function BooksProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  const loadProgress = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('reading_progress')
      .select('book_id, from_page, to_page, logged_at')
      .gte('logged_at', monthStart().toISOString());
    if (!e && data) setProgress(data as ProgressRow[]);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.from('books').select('*').order('updated_at', { ascending: false });
    if (e) {
      setError('Não foi possível carregar sua estante. Confira sua conexão e tente de novo.');
    } else {
      setBooks(data as Book[]);
      await loadProgress();
    }
    setLoading(false);
  }, [loadProgress]);

  useEffect(() => { void reload(); }, [reload, userId]);

  // Ao voltar para o app (por exemplo, depois da virada do mês), recarrega o histórico do mês atual.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void loadProgress(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadProgress]);

  const add = useCallback(async (input: BookInput) => {
    const { data, error: e } = await supabase.from('books').insert(input).select().single();
    if (e) throw e;
    const book = data as Book;
    setBooks((list) => [book, ...list]);
    return book;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<BookInput>) => {
    const { data, error: e } = await supabase.from('books').update(patch).eq('id', id).select().single();
    if (e) throw e;
    const book = data as Book;
    setBooks((list) => [book, ...list.filter((b) => b.id !== id)]);
    if ('current_page' in patch) void loadProgress();
    return book;
  }, [loadProgress]);

  const remove = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('books').delete().eq('id', id);
    if (e) throw e;
    setBooks((list) => list.filter((b) => b.id !== id));
    void loadProgress();
  }, [loadProgress]);

  const setPage = useCallback((book: Book, page: number) => {
    const done = !!book.total_pages && page >= book.total_pages;
    const patch: Partial<BookInput> = done ? { ...statusPatch(book, 'concluido'), current_page: page } : { current_page: page };
    if (!done && book.status === 'quero_ler' && page > 0) Object.assign(patch, statusPatch(book, 'lendo'));
    return update(book.id, patch);
  }, [update]);

  const setStatus = useCallback((book: Book, status: Status) => update(book.id, statusPatch(book, status)), [update]);

  const monthPages = useMemo(() => {
    // Soma por livro para que uma correção para trás não vire "páginas negativas".
    // Recomeços (voltar para "Quero ler", reler) não entram no histórico: o banco ignora.
    const perBook = new Map<string, number>();
    for (const r of progress) perBook.set(r.book_id, (perBook.get(r.book_id) ?? 0) + (r.to_page - r.from_page));
    let total = 0;
    perBook.forEach((v) => { total += Math.max(0, v); });
    return total;
  }, [progress]);

  return (
    <BooksCtx.Provider value={{ loading, error, books, monthPages, reload, add, update, remove, setPage, setStatus }}>
      {children}
    </BooksCtx.Provider>
  );
}

export function useBooks(): BooksState {
  const v = useContext(BooksCtx);
  if (!v) throw new Error('useBooks fora do BooksProvider');
  return v;
}
