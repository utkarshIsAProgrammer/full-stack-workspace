import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './utils/sentry';
import { trackPageView } from './utils/analytics';

// Initialize Sentry for error tracking
initSentry();

// Track initial page view
trackPageView('home');

// Register Service Worker for PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((_registration) => {
      // console.log('SW registered: ', _registration);
    }).catch((_registrationError) => {
      // console.log('SW registration failed: ', _registrationError);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
