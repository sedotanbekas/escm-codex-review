import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Konfigurasi Vite untuk GUI Codex Review.
// - Saat `npm run dev`, semua permintaan /api di-proxy ke backend Express
//   (port 8787) agar tidak ada masalah CORS dan frontend bisa fokus ke UI.
// - Saat `npm run build`, hasil masuk ke ./dist dan disajikan oleh server.mjs.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8787",
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
});
