/**
 * Global Supabase stub declaration
 * This allows legacy code that uses `supabase` as a global to compile
 * The actual stub is defined in src/lib/api.ts
 */

type SupabaseStub = typeof import('../lib/api')['supabase'];

declare global {
  const supabase: SupabaseStub;
}

export {};
