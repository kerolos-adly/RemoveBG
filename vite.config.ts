import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // تأكد أن اسم المستودع مكتوب صح بين السلش
  base: "/RemoveBG/",
  
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile()
  ],
  
  resolve: {
    alias: {
      // ده بيخلي الـ @ تشير لمجلد الـ src صح
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  build: {
    // إعدادات لضمان خروج الملفات بشكل سليم
    outDir: "dist",
    assetsDir: "."
  }
});
