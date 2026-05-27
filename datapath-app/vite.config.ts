import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts')) return 'echarts';
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) return 'excel';
          if (id.includes('node_modules/ag-grid')) return 'ag-grid';
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
