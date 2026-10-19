// main.tsx — root render; wraps app in all providers
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import WelcomePage from './pages/WelcomePage'
import './index.css'

const queryClient = new QueryClient()

// When no backend is configured (demo / welcome-page-only deploy),
// render WelcomePage directly — no router, no auth, no redirects possible.
if (!import.meta.env.VITE_API_BASE_URL) {
  createRoot(document.getElementById('root')!).render(<WelcomePage />)
} else {
  createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>,
  )
}
