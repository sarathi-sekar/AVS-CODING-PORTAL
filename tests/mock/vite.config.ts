import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const r = (p: string) => path.resolve(__dirname, p);
export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  plugins: [react()],
  resolve: { alias: [
    { find: 'firebase/app', replacement: r('app.ts') }, { find: 'firebase/auth', replacement: r('auth.ts') }, { find: 'firebase/firestore', replacement: r('firestore.ts') }, { find: 'firebase/storage', replacement: r('storage.ts') },
    { find: '@monaco-editor/react', replacement: r('monaco.tsx') }, { find: /^(\.\.?\/)+lib\/api$/, replacement: r('api.ts') },
  ] },
  build: { outDir: '/tmp/dist-mock', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
