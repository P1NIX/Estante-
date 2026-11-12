import { Brand } from '../components/Layout';

/** Aparece enquanto o projeto não tem as variáveis do Supabase. Não há modo "de mentira". */
export function SetupPage() {
  return (
    <main className="wrap narrow solo">
      <Brand />
      <section className="auth-panel">
        <h1 className="panel-title">Falta conectar o banco de dados</h1>
        <p>O app precisa de um projeto Supabase para criar contas e guardar os livros. Sem ele, nada é salvo.</p>
        <ol className="steps">
          <li>Crie um projeto em supabase.com e rode os arquivos de <code>supabase/migrations/</code> (0001 e depois 0002) no SQL Editor.</li>
          <li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</li>
          <li>Reinicie o servidor (<code>npm run dev</code>) ou publique de novo.</li>
        </ol>
        <p className="fine">O passo a passo completo está no README do projeto.</p>
      </section>
    </main>
  );
}
