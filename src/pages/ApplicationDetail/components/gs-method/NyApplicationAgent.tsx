import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { AgentShell } from './AgentShell'
import { saveLastInit, loadLastInit } from './lastInit'
import type { ApplicationData } from '../../types'

interface Props {
  application: ApplicationData
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const DOC_LABELS: Record<string, string> = {
  ny_application_confirmation: 'NY Application Confirmation',
  ny_application_receipt: 'NY Application Payment Receipt',
}

function formatSSN(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function NyApplicationAgent({ application, showToast }: Props) {
  const appId = application.grit_app_id || application.id
  // SSN defaults to null/blank — admins can leave it empty and the agent skips
  // that field on the NYSED form. License type is fixed to RN for now.
  const [ssn, setSsn] = useState('')
  const licenseType = 'RN' as const
  const ssnRef = useRef<HTMLInputElement | null>(null)

  // Restore the last-used pre-init choices for this application.
  useEffect(() => {
    const saved = loadLastInit<{ ssn: string }>(appId, 'ny-application')
    if (saved && typeof saved.ssn === 'string') setSsn(formatSSN(saved.ssn))
  }, [appId])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          eservices.nysed.gov/professions/professions/022 — full RN / CNS licensure application
        </p>
      </div>

      <AgentShell
        kind="ny-application"
        title="NY Application Agent"
        subtitle="Completes the 5-step NYSED application (Personal Info → Education → Sign → Pay) and saves the confirmation."
        appId={appId}
        showToast={showToast}
        preInitialize={
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4">
            <div className="max-w-sm">
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Applicant SSN <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
              </label>
              <input
                ref={ssnRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="XXX-XX-XXXX"
                value={ssn}
                onChange={(e) => setSsn(formatSSN(e.target.value))}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        }
        buildStartPayload={() => {
          // SSN is nullable — leave it blank to skip. Anything entered must be
          // a complete 9-digit number, otherwise it's likely a typo.
          const digits = ssn.replace(/[^0-9]/g, '')
          if (digits.length > 0 && digits.length !== 9) {
            showToast('Applicant SSN must be 9 digits — clear it to skip, or enter all 9.', 'warning')
            ssnRef.current?.focus()
            return null
          }
          // Persist the SSN so the next visit pre-fills the field.
          saveLastInit(appId, 'ny-application', { ssn: digits || '' })
          return { ssn: digits || null, licenseType }
        }}
        steps={
          <ol className="space-y-1 list-decimal list-inside">
            <li>Open <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">eservices.nysed.gov</code> → profession 022 → click <b>Start</b>.</li>
            <li>Acknowledge prerequisites and continue.</li>
            <li>Fill Personal Information (name, DOB, SSN, contact, address) from this application.</li>
            <li>Fill the education/history sections (nursing school, degree, history questions default to <b>No</b>).</li>
            <li>Sign electronically and submit for review.</li>
            <li>Pay the <b>$143</b> RN licensure fee with the CC from <code className="px-1 rounded bg-gray-200/60 dark:bg-gray-700/60">.env</code>.</li>
            <li>Capture the NYSED Application ID and save the confirmation PDF to Documents.</li>
          </ol>
        }
        describeResult={(raw) => ({
          error: raw?.error,
          rows: [
            ...(raw?.applicationId ? [{ label: 'NYSED Application ID', value: raw.applicationId }] : []),
            ...(raw?.receiptNumber ? [{ label: 'Receipt #', value: raw.receiptNumber }] : []),
            ...(raw?.paid ? [{ label: 'Paid', value: 'Yes' }] : []),
          ],
          documentsSaved: raw?.documentsSaved || [],
          documentLabels: DOC_LABELS,
        })}
      />
    </div>
  )
}
