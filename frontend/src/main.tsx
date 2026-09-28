// main.tsx — root render; wraps app in all providers
// This is the entry point for the React application.
// It mounts the React component tree onto the actual HTML page.

// createRoot is the modern React 18 API for mounting the app
import { createRoot } from 'react-dom/client'
// BrowserRouter enables URL-based navigation throughout the app
import { BrowserRouter } from 'react-router-dom'
// QueryClient and its provider manage all server-state fetching and caching
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// AuthProvider supplies login/logout state to every component in the tree
import { AuthProvider } from './context/AuthContext'
// App contains all page routes and top-level structure
import App from './App'
// Global stylesheet — design tokens, fonts, and Tailwind base styles
import './index.css'

// Create a single shared React Query client for the whole application
const queryClient = new QueryClient()

// Find the #root div in index.html and render the full React tree into it
createRoot(document.getElementById('root')!).render(
  // No StrictMode — it double-fires effects and state initialisers in dev,
  // which breaks the token-restore logic in AuthContext.
  <BrowserRouter>
    {/* QueryClientProvider makes the query client available app-wide */}
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider stores the logged-in user and auth helpers */}
      <AuthProvider>
        {/* App renders the route tree that maps URLs to pages */}
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>,
)
