// Single source of truth for the JWT signing secret.
//
// Lazy getter (rather than a module-level constant) so that simply importing
// a module that signs/verifies tokens doesn't crash test environments where
// JWT_SECRET isn't set — the error only fires when a token operation is
// actually attempted without a configured secret. There is deliberately NO
// hardcoded fallback: a guessable default secret would let anyone forge
// valid auth tokens.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}
