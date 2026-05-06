import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isLibraryMode = mode === 'library'
  const outDir = isLibraryMode ? 'dist/lib' : 'dist/app'

  return {
    base: mode === 'development' ? '/' : './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@services': path.resolve(__dirname, './src/services'),
        '@store': path.resolve(__dirname, './src/store'),
      },
    },
    build: isLibraryMode
      ? {
          outDir,
          emptyOutDir: true,
          sourcemap: false,
          cssCodeSplit: true,
          lib: {
            entry: path.resolve(__dirname, './src/index.ts'),
            name: 'Greeble3D',
            formats: ['es'],
            fileName: () => 'greeble3d.js',
          },
        }
      : {
          outDir,
          emptyOutDir: true,
          sourcemap: false,
          cssCodeSplit: true,
          chunkSizeWarningLimit: 1000,
        },
  }
})
