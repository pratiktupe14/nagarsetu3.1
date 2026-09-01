import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'vendor-maps';
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('exifr')) {
              return 'vendor-exif';
            }
            if (id.includes('axios')) {
              return 'vendor-http';
            }
            if (id.includes('react-router') || id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor-misc';
          }
          if (id.includes('/src/pages/admin/')) {
            return 'portal-admin';
          }
          if (id.includes('/src/pages/departmentHead/')) {
            return 'portal-department-head';
          }
          if (id.includes('/src/pages/staff/')) {
            return 'portal-staff';
          }
          if (id.includes('/src/pages/citizen/')) {
            return 'portal-citizen';
          }
          if (id.includes('/src/services/')) {
            return 'app-services';
          }
        }
      }
    }
  }
})
