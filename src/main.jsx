import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/theme.css';
import { DATA_SOURCE, loadSupabase } from './lib/supabase/client.js';

async function bootstrap() {
  // Em modo supabase, carrega a lib + cria o cliente antes de renderizar
  // (import dinâmico — fica fora do bundle do modo mock).
  if (DATA_SOURCE === 'supabase') await loadSupabase();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
