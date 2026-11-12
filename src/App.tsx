import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { BooksProvider } from './lib/books';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { ResetPasswordPage } from './pages/ResetPassword';
import { HomePage } from './pages/Home';
import { ShelfPage } from './pages/Shelf';
import { BookFormPage } from './pages/BookForm';
import { BookDetailPage } from './pages/BookDetail';
import { ProfilePage } from './pages/Profile';

export function App() {
  const { loading, session, recovering } = useAuth();

  if (loading) return <p className="boot fine" role="status">Abrindo sua estante…</p>;

  // Quem chega pelo link de "esqueci minha senha" precisa escolher a nova senha antes de qualquer outra tela.
  if (recovering && session) return <ResetPasswordPage />;

  if (!session) {
    return (
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  // Rotas protegidas: só existem com sessão. Os dados em si são protegidos pelo banco (RLS).
  return (
    <BooksProvider userId={session.user.id} key={session.user.id}>
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/estante" element={<ShelfPage />} />
          <Route path="/livro/novo" element={<BookFormPage />} />
          <Route path="/livro/:id" element={<BookDetailPage />} />
          <Route path="/livro/:id/editar" element={<BookFormPage key="edit" />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BooksProvider>
  );
}
