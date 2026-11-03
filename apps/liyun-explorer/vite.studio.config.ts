import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./studio',import.meta.url)),base:'/studio/',publicDir:false,plugins:[react()],build:{outDir:fileURLToPath(new URL('./dist-studio',import.meta.url)),emptyOutDir:true}});
