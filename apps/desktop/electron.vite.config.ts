import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { resolve } from 'path'

// Plugin para compilar o worker após o build
const buildWorkerPlugin = () => {
  return {
    name: 'build-worker',
    buildStart() {
      // Compilar o worker antes do build do main
      try {
        const workerSrc = resolve(__dirname, 'src/main/stt/workers/sttWorker.ts')
        const workerOut = resolve(__dirname, 'dist/main/stt/workers')
        execSync(`mkdir -p ${workerOut} && npx tsc ${workerSrc} --outDir ${workerOut} --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node`, { stdio: 'ignore' })
      } catch (error) {
        // Ignorar erros silenciosamente
      }
    },
    buildEnd() {
      // Garantir que o worker está compilado após o build
      try {
        const workerSrc = resolve(__dirname, 'src/main/stt/workers/sttWorker.ts')
        const workerOut = resolve(__dirname, 'dist/main/stt/workers')
        execSync(`mkdir -p ${workerOut} && npx tsc ${workerSrc} --outDir ${workerOut} --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node`, { stdio: 'ignore' })
      } catch (error) {
        // Ignorar erros silenciosamente
      }
    }
  }
}

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin(), buildWorkerPlugin()],
        build: {
            outDir: 'dist/main',
            emptyOutDir: false // Não limpar o diretório para preservar o worker compilado
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist/preload'
        }
    },
    renderer: {
        plugins: [react()],
        build: {
            outDir: 'dist/renderer'
        }
    }
})
