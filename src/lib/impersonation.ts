// Impersonation session stack.
//
// An admin can "sign in as" an advisor, who can then "sign in as" a client.
// Each step pushes the *current* session onto a stack stored at
// `admin_session_backup`. "Back" pops the top, restoring the previous session.
// The legacy single-session shape is still accepted on read so existing stashed
// backups don't get orphaned.

export type ImpersonationFrame = {
  access_token: string
  refresh_token: string
  user: { first_name?: string; last_name?: string; role?: string } | null
}

const KEY = 'admin_session_backup'

export function readStack(): ImpersonationFrame[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    // Legacy single-session shape — treat as a one-frame stack.
    if (parsed && typeof parsed === 'object' && 'access_token' in parsed) return [parsed as ImpersonationFrame]
    return []
  } catch {
    return []
  }
}

function writeStack(stack: ImpersonationFrame[]): void {
  if (stack.length === 0) {
    localStorage.removeItem(KEY)
  } else {
    localStorage.setItem(KEY, JSON.stringify(stack))
  }
}

// The frame on top of the stack — i.e. the session we'll return to next.
export function peekStack(): ImpersonationFrame | null {
  const stack = readStack()
  return stack.length > 0 ? stack[stack.length - 1] : null
}

// Push the current session onto the stack. Call this *before* swapping in the
// new (impersonated) session's tokens.
export function pushCurrentSession(): void {
  const access_token = localStorage.getItem('gritsync_token')
  const refresh_token = localStorage.getItem('gritsync_refresh_token') || ''
  const userRaw = localStorage.getItem('gritsync_user')
  if (!access_token) return
  const frame: ImpersonationFrame = {
    access_token,
    refresh_token,
    user: userRaw ? JSON.parse(userRaw) : null,
  }
  const stack = readStack()
  stack.push(frame)
  writeStack(stack)
}

// Pop the top frame and restore that session's tokens. Returns the restored
// frame so the caller can decide where to redirect.
export function popToPreviousSession(): ImpersonationFrame | null {
  const stack = readStack()
  const frame = stack.pop() || null
  writeStack(stack)
  if (frame) {
    localStorage.setItem('gritsync_token', frame.access_token)
    localStorage.setItem('gritsync_refresh_token', frame.refresh_token || '')
    if (frame.user) localStorage.setItem('gritsync_user', JSON.stringify(frame.user))
  }
  return frame
}
