// Public barrel for the data layer.
// `api-client.ts` is the low-level transport (a Supabase-style query builder over
// the Express `/api` backend); `api-service.ts` holds the domain APIs built on it.
// Auth lives in `AuthContext`, not here.
export * from './api-service'
