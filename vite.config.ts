import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

export default defineConfig({
  // تأكد أن الاسم يطابق اسم المستودع وحالة الأحرف
  base: "/RemoveBG/", 
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // هذا السطر يضمن أن المسارات داخل ملف الـ HTML تكون نسبية وصحيحة
    assetsDir: "./",
  }
});
