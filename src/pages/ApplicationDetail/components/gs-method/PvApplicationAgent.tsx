import { useEffect, useState } from 'react'
import { Plane, LogIn, Save } from 'lucide-react'
import { AgentShell } from './AgentShell'
import { processingAccountsAPI } from '@/lib/api'
import { saveLastInit, loadLastInit } from './lastInit'
import type { ApplicationData } from '../../types'

interface Props {
  application: ApplicationData
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const DOC_LABELS: Record<string, string> = {
  pv_application_receipt: 'Pearson VUE Registration Receipt',
  pv_application_att: 'Authorization to Test (ATT)',
}

// 50 US states + DC + a few territories. Pearson VUE accepts the spelled-out
// name; the runner falls back to a free-text match if needed.
const BOARDS = [
  'New York', 'New Jersey', 'California', 'Texas', 'Florida', 'Illinois',
  'Pennsylvania', 'Connecticut', 'Massachusetts', 'Washington', 'Virginia',
  'Georgia', 'Arizona', 'Maryland', 'Ohio', 'Michigan', 'North Carolina',
]

export function PvApplicationAgent({ application, showToast }: Props) {
  const appId = application.grit_app_id || application.id
  const [examType, setExamType] = useState<'NCLEX-RN' | 'NCLEX-PN'>('NCLEX-RN')
  const [boardOfNursing, setBoardOfNursing] = useState('New York')
  const [useExistingAccount, setUseExistingAccount] = useState(false)
  const [pvUsername, setPvUsername] = useState('')
  const [pvPassword, setPvPassword] = useState('')
  // The Pearson VUE processing-account row holds the saved credentials.
  // Pre-fill the form from it on mount so the admin doesn't retype each run.
  const [pearsonAcctId, setPearsonAcctId] = useState<string | null>(null)
  const [savingCreds, setSavingCreds] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadSavedCreds() {
      try {
        const accounts = await processingAccountsAPI.getByApplication(appId)
        if (cancelled) return
        const acct = (accounts || []).find((a: any) => a.account_type === 'pearson_vue')
        if (acct) {
          setPearsonAcctId(acct.id)
          if (acct.email) setPvUsername(acct.email)
          if (acct.password) setPvPassword(acct.password)
          // Default the checkbox on when this account has already been
          // activated — at that point the admin has decided it exists.
          if (acct.status === 'active') setUseExistingAccount(true)
        }
      } catch {
        // Non-blocking — the admin can still type creds by hand.
      }
    }
    loadSavedCreds()
    return () => { cancelled = true }
  }, [appId])

  // Restore the last-used pre-init choices for this application. Creds still
  // come from the processing-account row above; we only restore the toggles
  // and the exam/board picks here.
  useEffect(() => {
    const saved = loadLastInit<{
      examType: 'NCLEX-RN' | 'NCLEX-PN'
      boardOfNursing: string
      useExistingAccount: boolean
    }>(appId, 'pv-application')
    if (!saved) return
    if (saved.examType === 'NCLEX-RN' || saved.examType === 'NCLEX-PN') setExamType(saved.examType)
    if (typeof saved.boardOfNursing === 'string' && saved.boardOfNursing) setBoardOfNursing(saved.boardOfNursing)
    if (typeof saved.useExistingAccount === 'boolean') setUseExistingAccount(saved.useExistingAccount)
  }, [appId])

  async function handleSaveCredentials() {
    if (!pvUsername || !pvPassword) {
      showToast('Enter both username and password before saving.', 'warning')
      return
    }
    if (!pearsonAcctId) {
      showToast('Cannot save: Pearson VUE account row not found. Open the Processing Accounts tab once to auto-provision it.', 'error')
      return
    }
    setSavingCreds(true)
    try {
      await processingAccountsAPI.patch(pearsonAcctId, {
        email: pvUsername,
        password: pvPassword,
      })
      showToast('Pearson VUE credentials saved.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Failed to save credentials', 'error')
    } finally {
      setSavingCreds(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <Plane className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          home.pearsonvue.com/nclex — register for the NCLEX exam ($200) and save the receipt
        </p>
      </div>

      <AgentShell
        kind="pv-application"
        title="PV Application Agent"
        subtitle="Creates a Pearson VUE account (or signs in), registers for the NCLEX, pays the $200 fee, captures the confirmation."
        appId={appId}
        showToast={showToast}
        preInitialize={
          <div className="rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/20 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Exam type</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as 'NCLEX-RN' | 'NCLEX-PN')}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="NCLEX-RN">NCLEX-RN (Registered Nurse)</option>
                  <option value="NCLEX-PN">NCLEX-PN (Practical Nurse)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Board of nursing (state)</label>
                <select
                  value={boardOfNursing}
                  onChange={(e) => setBoardOfNursing(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                >
                  {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={useExistingAccount}
                onChange={(e) => setUseExistingAccount(e.target.checked)}
              />
              <LogIn className="h-3.5 w-3.5" />
              The applicant already has a Pearson VUE account — sign in instead of creating one
            </label>

            {useExistingAccount && (
              <div className="pl-5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">PV username</label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={pvUsername}
                      onChange={(e) => setPvUsername(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">PV password</label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={pvPassword}
                      onChange={(e) => setPvPassword(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Saved credentials are stored on the application's Pearson VUE processing account so future runs auto-fill these fields.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    disabled={savingCreds || !pearsonAcctId}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={pearsonAcctId ? 'Save these credentials for next time' : 'No Pearson VUE processing-account row yet — open the Processing Accounts tab to provision it.'}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingCreds ? 'Saving…' : 'Save credentials'}
                  </button>
                </div>
              </div>
            )}
          </div>
        }
        buildStartPayload={() => {
          if (useExistingAccount && (!pvUsername || !pvPassword)) {
            showToast('Enter the PV username and password, or uncheck "existing account".', 'warning')
            return null
          }
          // Fire-and-forget persistence so the admin doesn't have to remember
          // the Save button — next time the panel mounts, fields are pre-filled.
          if (useExistingAccount && pearsonAcctId) {
            processingAccountsAPI
              .patch(pearsonAcctId, { email: pvUsername, password: pvPassword })
              .catch(() => { /* non-fatal — agent still runs */ })
          }
          // Persist the toggle/exam choices so the next visit pre-fills them.
          saveLastInit(appId, 'pv-application', {
            examType,
            boardOfNursing,
            useExistingAccount,
          })
          return {
            examType,
            boardOfNursing,
            ...(useExistingAccount ? { pvUsername, pvPassword } : {}),
          }
        }}
        steps={
          <ol className="space-y-1 list-decimal list-inside">
            <li>Open <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">home.pearsonvue.com/nclex</code> and {useExistingAccount ? 'sign in with the provided credentials' : 'create a new account using this application'}.</li>
            <li>Fill personal information, address, and DOB on the registration form.</li>
            <li>Choose <b>{examType}</b> and board of nursing: <b>{boardOfNursing}</b>.</li>
            <li>Accept the candidate agreements / attestations.</li>
            <li>Pay the <b>$200</b> NCLEX registration fee with the CC from <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">.env</code>.</li>
            <li>Capture the Pearson VUE confirmation number and save the receipt PDF to Documents.</li>
          </ol>
        }
        describeResult={(raw) => ({
          error: raw?.error,
          rows: [
            ...(raw?.username ? [{ label: 'PV username', value: raw.username }] : []),
            ...(raw?.password ? [{ label: 'PV password', value: raw.password, secret: true }] : []),
            ...(raw?.confirmationNumber ? [{ label: 'Confirmation #', value: raw.confirmationNumber }] : []),
            ...(raw?.paid ? [{ label: 'Paid', value: 'Yes' }] : []),
          ],
          documentsSaved: raw?.documentsSaved || [],
          documentLabels: DOC_LABELS,
        })}
      />
    </div>
  )
}
