import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],

    build: {
        // Target modern Android browsers (Chrome 80+)
        target: ['chrome80', 'safari14', 'firefox78'],

        // Code splitting strategy — separate vendor chunks for better caching
        rollupOptions: {
            output: {
                manualChunks: {
                    // React core — very stable, cache a long time
                    'react-vendor': ['react', 'react-dom'],
                    // Router
                    'router': ['react-router-dom'],
                    // Animation library — large, rarely changes
                    'motion': ['framer-motion'],
                    // Firebase — large SDK, cache aggressively
                    'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                    // Icons
                    'icons': ['lucide-react'],
                },
            },
        },

        // Smaller chunks → faster on 3G
        chunkSizeWarningLimit: 400,

        // Gzip-friendly output
        reportCompressedSize: true,

        // Minification
        minify: 'esbuild',

        // Source maps only in production warnings (disable for prod)
        sourcemap: false,
    },

    // Explicit optimise deps for faster cold starts
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
    },
});
