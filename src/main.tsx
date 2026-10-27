import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline shell caching and seamless auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    // App shell and assets are cached and ready for offline local & AI gameplay
  },
});

createRoot(document.getElementById('root')!).render(<App />);
