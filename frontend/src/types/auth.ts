// auth.ts — TypeScript types for all auth-related shapes
// These interfaces define the exact structure of data exchanged
// between the frontend and the authentication endpoints on the backend.

// The four possible roles a user can have in the system
export type UserRole = 'super_admin' | 'lawyer' | 'associate' | 'paralegal'

// Shape of the JSON body returned by /auth/login and /auth/refresh
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  // True when the user must change their password before continuing
  must_change_pw: boolean
}

// Claims decoded from the JWT access token payload
export interface TokenPayload {
  user_id: string
  // null for super_admin users who do not belong to any specific firm
  firm_id: string | null
  role: UserRole
  // Unix timestamp for when this token expires
  exp: number
  // Identifies the token type, e.g. "access" vs "refresh"
  type: string
}

// A single source passage returned alongside a generated answer
export interface GeneratePassage {
  text:        string
  // The filename of the document this passage came from
  filename:    string
  page_number: number
  document_id: string
  chunk_id:    string
}

// The full response shape from the AI generate/research endpoint
export interface GenerateResponse {
  // The AI-generated answer text, or null if the model refused
  answer:        string | null
  // True when the model declined to answer the question
  refused:       boolean
  // True when the answer came from a fallback rather than retrieved passages
  fallback:      boolean
  // Legal disclaimer text to display below the answer
  disclaimer:    string
  // Source passages the answer was grounded on
  passages:      GeneratePassage[]
  // Which provider actually ran this request (e.g. "groq", "ollama")
  provider_used?: string
}
