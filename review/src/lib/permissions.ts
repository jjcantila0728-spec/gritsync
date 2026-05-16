// Minimal permissions helper for the standalone review subapp. Mirrors
// the homePathForRole signature from the main app's src/lib/permissions.ts.

export function homePathForRole(role: string | null | undefined): string {
  switch (role) {
    case 'admin': return '/admin/dashboard'
    case 'affiliate': return '/affiliate/dashboard'
    case 'advisor': return '/advisor/dashboard'
    default: return '/dashboard'
  }
}
