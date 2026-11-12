export type Status = 'quero_ler' | 'lendo' | 'concluido';

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string;
  status: Status;
  genre: string | null;
  total_pages: number | null;
  current_page: number;
  started_on: string | null;
  finished_on: string | null;
  rating: number | null;
  review: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Campos que o app envia ao criar ou editar um livro. */
export type BookInput = Pick<
  Book,
  'title' | 'author' | 'status' | 'genre' | 'total_pages' | 'current_page' | 'started_on' | 'finished_on' | 'rating' | 'review' | 'notes'
>;

export interface Profile {
  id: string;
  display_name: string;
}

export interface ProgressRow {
  book_id: string;
  from_page: number;
  to_page: number;
  logged_at: string;
}

export const STATUS_LABEL: Record<Status, string> = {
  lendo: 'Lendo',
  quero_ler: 'Quero ler',
  concluido: 'Concluídos',
};

export const STATUS_ORDER: Status[] = ['lendo', 'quero_ler', 'concluido'];

export const GENRES = [
  'Romance', 'Fantasia', 'Ficção científica', 'Suspense e policial', 'Terror', 'Clássico', 'Conto e crônica', 'Poesia',
  'Biografia', 'História', 'Não ficção', 'Desenvolvimento pessoal', 'Infantojuvenil', 'HQ e mangá', 'Outro',
] as const;
