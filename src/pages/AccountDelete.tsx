import { Mail, ShieldCheck, AlertTriangle, Clock, Trash2 } from 'lucide-react'

/**
 * Public account-deletion request page — required by Google Play Console's
 * Data safety form (Delete account URL).
 *
 * Google's documentation requires this page to:
 *   - reference the app / developer name
 *   - prominently feature the steps users take to request deletion
 *   - specify what data gets deleted vs retained, and for how long
 *
 * The page is intentionally unauthenticated so Play Console crawlers + a
 * user who has lost access to their account can both reach it. The
 * actual deletion is processed manually by GritSync staff once they
 * receive the email, which keeps us inside our existing operational
 * controls without needing a self-service delete endpoint.
 */
export function AccountDelete() {
  const supportEmail = 'support@gritsync.com'
  const subject = encodeURIComponent('Account deletion request — GritSync')
  const body = encodeURIComponent(
    [
      'Hi GritSync team,',
      '',
      'I would like to request deletion of my GritSync account and the personal data associated with it.',
      '',
      'Account details:',
      '  Full name:',
      '  Email used for sign-in:',
      '  GRIT ID (if known):',
      '',
      'Please confirm receipt and let me know when the deletion is complete.',
      '',
      'Thank you.',
    ].join('\n'),
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="mx-auto max-w-3xl">
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
          <div className="flex items-start gap-4 mb-6">
            <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
              <Trash2 className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                Delete your GritSync account
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Permanently remove your account and personal data from GritSync's systems.
              </p>
            </div>
          </div>

          <Section title="How to request deletion" icon={<Mail className="h-5 w-5 text-primary-600" />}>
            <p className="mb-4">
              Send an email to <a href={`mailto:${supportEmail}`} className="text-primary-600 font-semibold">{supportEmail}</a>{' '}
              with the subject <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Account deletion request — GritSync</span> and include:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 dark:text-gray-300">
              <li>The full name on your account</li>
              <li>The email address you use to sign in</li>
              <li>Your GRIT ID (if you know it — found in the mobile app's Settings tab)</li>
            </ul>
            <p className="mt-4">
              <a
                href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg transition"
              >
                <Mail className="h-4 w-4" /> Open pre-filled email
              </a>
            </p>
          </Section>

          <Section title="What gets deleted" icon={<Trash2 className="h-5 w-5 text-primary-600" />}>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li>Account credentials (email, password hash, mobile number, GRIT ID)</li>
              <li>Personal profile data (full name, date of birth, address, civil status)</li>
              <li>Uploaded documents (passport, diploma, photos, supporting files)</li>
              <li>NCLEX exam history (sessions, answers, results, study notes)</li>
              <li>Messages exchanged with GritSync advisors</li>
              <li>Notifications and email preferences</li>
              <li>Mobile push tokens and biometric sign-in records</li>
            </ul>
          </Section>

          <Section title="What we retain (and why)" icon={<ShieldCheck className="h-5 w-5 text-primary-600" />}>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>Payment records</strong> — Stripe transactions, GCash / BDO receipts, and tax invoices.
                Retained for <strong>seven years</strong> to satisfy BIR (Philippine tax) and US IRS record-keeping
                requirements. Anonymized after one year — the account is unlinked, but the transaction stays
                in the books.
              </li>
              <li>
                <strong>Audit logs</strong> — Anonymized records of sign-in events and security-relevant
                actions. Retained for <strong>12 months</strong> for fraud and abuse investigation.
              </li>
              <li>
                <strong>Application status records</strong> — If your NCLEX application has been submitted to
                a state board of nursing, the submission record is retained for <strong>three years</strong>{' '}
                because the board may request audit information. Personally identifying fields are stripped
                after your deletion request.
              </li>
            </ul>
          </Section>

          <Section title="Processing timeline" icon={<Clock className="h-5 w-5 text-primary-600" />}>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 dark:text-gray-300">
              <li>We acknowledge your request within <strong>2 business days</strong></li>
              <li>Active account data is deleted within <strong>30 days</strong></li>
              <li>Backups and replicas are purged within <strong>90 days</strong></li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
              We send a confirmation email when each step completes.
            </p>
          </Section>

          <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <strong>This action cannot be undone.</strong> If you only want to pause notifications,{' '}
              cancel a subscription, or update your email, sign in to{' '}
              <a href="https://app.gritsync.com/client/account-settings" className="underline font-semibold">
                account settings
              </a>{' '}
              first — you don't need to delete your account.
            </div>
          </div>

          <hr className="my-8 border-gray-200 dark:border-gray-800" />

          <p className="text-xs text-gray-500 dark:text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            Questions about this process? Contact{' '}
            <a href={`mailto:${supportEmail}`} className="text-primary-600">{supportEmail}</a>.
            See also our{' '}
            <a href="https://gritsync.com/privacy" className="text-primary-600">privacy policy</a> and{' '}
            <a href="https://gritsync.com/terms" className="text-primary-600">terms of service</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
        {icon} {title}
      </h2>
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{children}</div>
    </section>
  )
}

export default AccountDelete
