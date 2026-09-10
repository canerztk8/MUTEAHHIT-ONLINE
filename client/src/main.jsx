import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary name="Müteahhit Online">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// 🔄 Vite dinamik modül / chunk yükleme hatalarında (yeni deploy yapıldığında eski chunk hash'i silinirse)
// tarayıcının hata ekranında kalmasını önleyip son sürüm için sayfayı otomatik olarak yeniler
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Yeni sürüm dağıtıldı veya dinamik modül yüklenemedi. Sayfa otomatik yenileniyor...', event);
  event.preventDefault();
  window.location.reload();
});

// ⚡ Register Service Worker for Cache-First offline & asset caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update();
    }).catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}
