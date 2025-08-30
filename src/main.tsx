import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'; // ✅ this line
import { Analytics } from "@vercel/analytics/react";
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter> {/* ✅ wrap in router */}
      <Analytics />
      <App />
    </BrowserRouter>
  </StrictMode>,
);

const preloader = document.getElementById("preloader");
if (preloader) preloader.remove();
