// useTheme.ts — persists light/dark preference in localStorage
// Applies/removes the `dark` class on <html> immediately.
// Any component can call this hook to read the current theme
// and toggle between light and dark mode.

// useState manages the active theme value; useEffect reacts to changes
import { useState, useEffect } from 'react'

// Union type that restricts theme to only the two supported values
type Theme = 'light' | 'dark'

// Custom hook that returns the current theme and a toggle function
export function useTheme() {
  // Initialise from localStorage so the user's choice survives a page reload
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    return stored ?? 'light'
  })

  // Apply class to <html> whenever theme changes
  // Adding 'dark' to the root element activates all dark-mode Tailwind variants
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // Persist the choice so it is restored the next time the page loads
    localStorage.setItem('theme', theme)
  }, [theme])

  // Flip between light and dark; each call inverts whatever is currently active
  function toggleTheme() {
    setThemeState(t => t === 'light' ? 'dark' : 'light')
  }

  // Return the current theme string and the toggle function to the caller
  return { theme, toggleTheme }
}
