import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa libs grandes em chunks próprios (melhor cache e paralelismo).
        // O @supabase/supabase-js NÃO entra aqui: é carregado via import()
        // dinâmico só no modo supabase (ver src/lib/supabase/client.js).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || /[\\/]react[\\/]/.test(id) || id.includes('scheduler'))
            return 'react-vendor';
          if (id.includes('@tanstack')) return 'react-query';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('zod')) return 'zod';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
