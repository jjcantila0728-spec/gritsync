import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

/**
 * Public status page Meta sends a user to after they remove the GritSync
 * app via facebook.com → Settings → Apps and Websites → GritSync. The
 * callback at /api/integrations/facebook/data-deletion-callback returns
 * { url, confirmation_code } pointing here with ?id=<row id>; this page
 * looks up the row and confirms the deletion to the user.
 *
 * Intentionally unauthenticated — Meta passes the user here directly. No
 * sensitive data is returned by the status endpoint, just the
 * confirmation code + row counts.
 */
export function FacebookDataDeletionStatus() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ok'; confirmation_code: string; rows_deleted: number; completed_at: string | null; requested_at: string }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ kind: 'error', message: 'No deletion id was provided.' })
      return
    }
    fetch(`/api/integrations/facebook/data-deletion-status?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
        return j.data
      })
      .then((data) => {
        setState({
          kind: 'ok',
          confirmation_code: data.confirmation_code,
          rows_deleted: data.rows_deleted,
          completed_at: data.completed_at,
          requested_at: data.requested_at,
        })
      })
      .catch((err) => {
        setState({ kind: 'error', message: err.message || 'Could not fetch deletion status.' })
      })
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <img src="/gritsync_logo.png" alt="GritSync" className="h-10 w-10 rounded-lg" />
          <div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
              <span>Grit</span>
              <span className="text-primary-600">Sync</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">NCLEX Processing Agency</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 sm:p-10">
          {state.kind === 'loading' && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Confirming your Facebook data deletion…
            </div>
          )}

          {state.kind === 'error' && (
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Couldn't load deletion status</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">{state.message}</p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  If you believe this is in error, email{' '}
                  <a href="mailto:support@gritsync.com" className="text-primary-600 font-semibold">support@gritsync.com</a>{' '}
                  with the deletion id (<span className="font-mono">{id || '—'}</span>) and we'll confirm manually.
                </p>
              </div>
            </div>
          )}

          {state.kind === 'ok' && (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-950 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                    Facebook data removed
                  </h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    GritSync has deleted the data linked to your Facebook account in response to your removal of the
                    GritSync app from Facebook.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-3 text-sm border-t border-gray-100 dark:border-gray-800 pt-6">
                <dt className="col-span-1 text-gray-500 dark:text-gray-400">Confirmation code</dt>
                <dd className="col-span-2 font-mono text-gray-800 dark:text-gray-100 break-all">{state.confirmation_code}</dd>

                <dt className="col-span-1 text-gray-500 dark:text-gray-400">Records removed</dt>
                <dd className="col-span-2 text-gray-800 dark:text-gray-100">{state.rows_deleted}</dd>

                <dt className="col-span-1 text-gray-500 dark:text-gray-400">Requested</dt>
                <dd className="col-span-2 text-gray-800 dark:text-gray-100">{new Date(state.requested_at).toLocaleString()}</dd>

                {state.completed_at && (
                  <>
                    <dt className="col-span-1 text-gray-500 dark:text-gray-400">Completed</dt>
                    <dd className="col-span-2 text-gray-800 dark:text-gray-100">{new Date(state.completed_at).toLocaleString()}</dd>
                  </>
                )}
              </dl>

              <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                This page confirms the removal of data linked to your Facebook account from GritSync's systems. If you
                also held a separate GritSync customer account (with your own GritSync email login), that account is
                independent of your Facebook link and is not affected by this action — see{' '}
                <a href="/account/delete" className="text-primary-600 font-semibold">/account/delete</a> to remove it.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
