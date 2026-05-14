import { useEffect, useState } from 'react'
import { GraduationCap, LogIn, Save, Mail, FileCheck2 } from 'lucide-react'
import { AgentShell } from './AgentShell'
import { processingAccountsAPI } from '@/lib/api'
import { saveLastInit, loadLastInit } from './lastInit'
import type { ApplicationData } from '../../types'

interface Props {
  application: ApplicationData
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const DOC_LABELS: Record<string, string> = {
  mandatory_course_infection_control: 'Infection Control and Barrier Precautions',
  mandatory_course_child_abuse: 'Child Abuse: New York Mandated Reporter Training',
}

export function MandatoryCourseAgent({ application, showToast }: Props) {
  const appId = application.grit_app_id || application.id
  const [useExistingAccount, setUseExistingAccount] = useState(false)
  const [nyrUsername, setNyrUsername] = useState('')
  const [nyrPassword, setNyrPassword] = useState('')
  // Per-run side-action toggles. Default is tied to the existing-account
  // checkbox: when the applicant already has an account, email + report
  // default to OFF (the certs are usually already on record there). For a
  // fresh-register run they default to ON.
  const [shouldSendEmail, setShouldSendEmail] = useState(true)
  const [shouldReport, setShouldReport] = useState(true)
  // The Mandatory Courses processing-account row holds the saved credentials.
  // Pre-fill the form from it on mount so the admin doesn't retype each run.
  const [mandatoryAcctId, setMandatoryAcctId] = useState<string | null>(null)
  const [savingCreds, setSavingCreds] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadSavedCreds() {
      try {
        const accounts = await processingAccountsAPI.getByApplication(appId)
        if (cancelled) return
        const acct = (accounts || []).find((a: any) => a.account_type === 'mandatory_courses')
        if (acct) {
          setMandatoryAcctId(acct.id)
          if (acct.email) setNyrUsername(acct.email)
          if (acct.password) setNyrPassword(acct.password)
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

  // Restore the last-used pre-init choices for this application. Runs once
  // on mount — credentials still load from the processing-account row
  // (more trustworthy), so we only override the toggles here.
  useEffect(() => {
    const saved = loadLastInit<{
      useExistingAccount: boolean
      shouldSendEmail: boolean
      shouldReport: boolean
    }>(appId, 'mandatory-courses')
    if (!saved) return
    if (typeof saved.useExistingAccount === 'boolean') setUseExistingAccount(saved.useExistingAccount)
    if (typeof saved.shouldSendEmail === 'boolean') setShouldSendEmail(saved.shouldSendEmail)
    if (typeof saved.shouldReport === 'boolean') setShouldReport(saved.shouldReport)
  }, [appId])

  // Note: defaults for shouldSendEmail / shouldReport are derived from
  // useExistingAccount only inside the checkbox's onChange handler below.
  // Doing it in a useEffect would clobber values restored from localStorage
  // on mount.
  function handleToggleExistingAccount(next: boolean) {
    setUseExistingAccount(next)
    setShouldSendEmail(!next)
    setShouldReport(!next)
  }

  async function handleSaveCredentials() {
    if (!nyrUsername || !nyrPassword) {
      showToast('Enter both username and password before saving.', 'warning')
      return
    }
    if (!mandatoryAcctId) {
      showToast('Cannot save: Mandatory Courses account row not found. Open the Processing Accounts tab once to auto-provision it.', 'error')
      return
    }
    setSavingCreds(true)
    try {
      await processingAccountsAPI.patch(mandatoryAcctId, {
        email: nyrUsername,
        password: nyrPassword,
      })
      showToast('Mandatory Courses credentials saved.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Failed to save credentials', 'error')
    } finally {
      setSavingCreds(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          nyrequirements.com — All Courses ($30) → Infection Control + Child Abuse certificates
        </p>
      </div>
      <AgentShell
        kind="mandatory-courses"
        title="Mandatory Courses Agent"
        subtitle="Buys the $30 bundle (or signs in to an existing account), takes both tests, downloads both certificates."
        appId={appId}
        showToast={showToast}
        preInitialize={
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={useExistingAccount}
                onChange={(e) => handleToggleExistingAccount(e.target.checked)}
              />
              <LogIn className="h-3.5 w-3.5" />
              The applicant already has a Mandatory Courses account — sign in and finish the tests instead of creating one
            </label>

            <div className="border-t border-emerald-200/60 dark:border-emerald-900/60 pt-3 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                After each certificate is downloaded
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={shouldSendEmail}
                  onChange={(e) => setShouldSendEmail(e.target.checked)}
                />
                <Mail className="h-3.5 w-3.5" />
                Send the certificate by email (uses nyrequirements.com's "Send to email" flow)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={shouldReport}
                  onChange={(e) => setShouldReport(e.target.checked)}
                />
                <FileCheck2 className="h-3.5 w-3.5" />
                Report the certificate (auto-fills SSN <span className="font-mono">0000</span>, DOB from application, Profession RN)
              </label>
            </div>

            {useExistingAccount && (
              <div className="pl-5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">nyrequirements.com username (email)</label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={nyrUsername}
                      onChange={(e) => setNyrUsername(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={nyrPassword}
                      onChange={(e) => setNyrPassword(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Saved credentials are stored on the application's Mandatory Courses processing account so future runs auto-fill these fields.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    disabled={savingCreds || !mandatoryAcctId}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={mandatoryAcctId ? 'Save these credentials for next time' : 'No Mandatory Courses processing-account row yet — open the Processing Accounts tab to provision it.'}
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
          if (useExistingAccount && (!nyrUsername || !nyrPassword)) {
            showToast('Enter the nyrequirements.com username and password, or uncheck "existing account".', 'warning')
            return null
          }
          // Fire-and-forget persistence so the admin doesn't have to remember
          // the Save button — next time the panel mounts, fields are pre-filled.
          if (useExistingAccount && mandatoryAcctId) {
            processingAccountsAPI
              .patch(mandatoryAcctId, { email: nyrUsername, password: nyrPassword })
              .catch(() => { /* non-fatal — agent still runs */ })
          }
          const base = { sendEmail: shouldSendEmail, reportCertificate: shouldReport }
          // Persist the choices so the next visit pre-fills the same options.
          saveLastInit(appId, 'mandatory-courses', {
            useExistingAccount,
            shouldSendEmail,
            shouldReport,
          })
          return useExistingAccount
            ? { ...base, useExistingAccount: true, nyrUsername, nyrPassword }
            : { ...base, useExistingAccount: false }
        }}
        steps={
          <ol className="space-y-1 list-decimal list-inside">
            {useExistingAccount ? (
              <>
                <li>Open <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">nyrequirements.com</code> and sign in with the provided credentials.</li>
                <li>Go to <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">/courses</code>; resume any unfinished course material.</li>
                <li>Take the test for <b>Infection Control</b> and <b>Child Abuse</b> (answers cached after the first run).</li>
                <li>Download both certificates and save them to this application's Documents.</li>
              </>
            ) : (
              <>
                <li>Open <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">nyrequirements.com/register</code> and select the <b>All Courses ($30)</b> bundle.</li>
                <li>Fill Contact Information using this application (Profession: <b>Registered Nurse</b>; phone &amp; license left blank).</li>
                <li>Submit payment using the CC configured in <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">.env</code> (NYR_CC_*).</li>
                <li>Go to <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">/courses</code>, complete &amp; take the test for <b>Infection Control</b> and <b>Child Abuse</b> (answers cached after the first run).</li>
                <li>Download both certificates and save them to this application's Documents.</li>
              </>
            )}
          </ol>
        }
        describeResult={(raw) => ({
          error: raw?.error,
          rows: [
            ...(raw?.accountEmail ? [{ label: 'Account email', value: raw.accountEmail }] : []),
            ...(raw?.accountPassword ? [{ label: 'Account password', value: raw.accountPassword, secret: true }] : []),
          ],
          documentsSaved: raw?.certificatesUploaded || [],
          documentLabels: DOC_LABELS,
        })}
      />
    </div>
  )
}
