// Persists the last set of pre-init choices each agent's "Initialize" button
// was clicked with, scoped per (application, agent kind). Loaded on mount so
// admins don't have to re-tick the same options on every run.
//
// Storage: localStorage (this is an admin-only screen; the data is the same
// stuff the admin just typed into the form, so no extra trust boundary).

const PREFIX = 'gs-agent-init:'

function key(appId: string, agent: string): string {
  return `${PREFIX}${appId}:${agent}`
}

export function saveLastInit(appId: string, agent: string, data: Record<string, unknown>): void {
  if (!appId || !agent) return
  try {
    localStorage.setItem(key(appId, agent), JSON.stringify(data))
  } catch {
    // Ignore quota / disabled storage — persistence is a convenience, not load-bearing.
  }
}

export function loadLastInit<T extends Record<string, unknown>>(appId: string, agent: string): Partial<T> | null {
  if (!appId || !agent) return null
  try {
    const raw = localStorage.getItem(key(appId, agent))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Partial<T>
    return null
  } catch {
    return null
  }
}
