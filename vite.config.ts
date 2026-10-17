import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "vite";

// Clean production build: the app ships as a normal hashed JS/CSS bundle with a
// small cacheable index.html. (Platform-specific dev plugins — runtime inliner,
// debug/telemetry collector, storage proxy, JSX location tagger — were removed
// so nothing extra is injected into the shipped page.)
export default defineConfig({
  plugins: [react(), tailwindcss(),{
    name:'shared-import-parser',
    configureServer(server){server.middlewares.use((req,res,next)=>{
      const files:Record<string,string>={'/assets/yomu-import.js':'import-parse.js','/assets/fflate.min.js':'vendor/fflate.min.js'};
      const file=files[(req.url||'').split('?')[0]];if(!file)return next();
      res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.resolve(import.meta.dirname,file)));
    });},
    generateBundle(){for(const [fileName,sourceFile] of Object.entries({'assets/yomu-import.js':'import-parse.js','assets/fflate.min.js':'vendor/fflate.min.js'}))this.emitFile({type:'asset',fileName,source:fs.readFileSync(path.resolve(import.meta.dirname,sourceFile),'utf8')});}
  }],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Split vendor libs so the app chunk stays cacheable and smaller.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    fs: { strict: true, deny: ["**/.*"] },
  },
});
