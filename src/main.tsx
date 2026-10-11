import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'; // ✅ this line
import { Analytics } from "@vercel/analytics/react";
import './index.css'
import App from './App.tsx'
import './stylesheets/Themes.css'

async function mount() {
  if (new URLSearchParams(location.search).get('theme-demo') === '1') {
    const { installThemeFixtures } = await import('./previews/themeFixtures')
    installThemeFixtures()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <Analytics />
        <App />
      </BrowserRouter>
    </StrictMode>,
  );

  const preloader = document.getElementById("preloader");
  if (preloader) preloader.remove();
}

void mount()
