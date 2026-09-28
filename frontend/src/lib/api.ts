// api.ts — axios client: attaches access token, silently refreshes on 401.
// Queue: if a refresh is already in flight, all concurrent 401 requests wait
// for it to resolve rather than each firing their own refresh call.

// Import axios for making HTTP requests to the backend API
import axios from 'axios'

// Create a pre-configured axios instance pointing at the backend base URL.
// All API calls in the app import and use this instance instead of raw axios.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// Attach access token to every outgoing request
// This interceptor runs before each request leaves the browser.
// It reads the stored token and adds it as a Bearer Authorization header.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── 401 handler with request queue ──────────────────────────────────────────
// Problem: if 3 requests fire simultaneously and all get 401, the naive
// implementation starts 3 concurrent refresh calls — the first succeeds,
// the other two burn the rotated refresh token and force a logout.
//
// Fix: the first 401 starts the refresh and records a promise. Every
// subsequent 401 that arrives while the refresh is in-flight queues itself
// on that same promise instead of starting another refresh.

// Shape of a single queued request waiting for the token refresh to finish
type QueueEntry = {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

// Flag that is true while a token refresh HTTP call is in progress
let isRefreshing = false
// List of requests that arrived with 401 while a refresh was already running
let queue: QueueEntry[] = []

// Drain the queue after a refresh attempt — resolve or reject every waiter
function processQueue(err: unknown, token: string | null) {
  for (const entry of queue) {
    if (err) entry.reject(err)
    else     entry.resolve(token!)
  }
  queue = []
}

// Response interceptor — handles all responses coming back from the server
api.interceptors.response.use(
  // Pass successful responses through unchanged
  (res) => res,
  async (error) => {
    const original = error.config

    // Only intercept 401s that haven't been retried yet
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // If a refresh is already running, queue this request
    // and wait for the refresh to finish before retrying
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }).catch(() => Promise.reject(error))
    }

    // Mark this request as already retried to prevent infinite loops
    original._retry = true
    isRefreshing    = true

    try {
      // Read the refresh token that was saved to localStorage at login time
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) throw new Error('no refresh token')

      // Call the backend refresh endpoint to exchange the old token for new ones
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
      )

      // Persist the new tokens so the next page load still has a valid session
      localStorage.setItem('access_token',  data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)

      // Unblock all queued requests with the new token
      processQueue(null, data.access_token)

      // Retry the original failed request with the freshly issued token
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (err) {
      // Tell all waiting requests that the refresh failed so they can reject
      processQueue(err, null)

      // Refresh failed — clear session and redirect to login
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('must_change_pw')
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      // Always reset the refreshing flag when the refresh attempt is done
      isRefreshing = false
    }
  },
)

// Export the configured axios instance for use throughout the application
export default api
