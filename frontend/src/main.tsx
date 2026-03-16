import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeContext'
import { applyTheme, loadTheme } from './theme/theme'

applyTheme(loadTheme())

const routerBase = (() => {
  const rawBase = (import.meta.env.BASE_URL || "/").trim();
  if (rawBase === "/") return "/";
  return rawBase.replace(/\/+$/, "");
})();

const appTree = (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
)

createRoot(document.getElementById('root')!).render(appTree)
