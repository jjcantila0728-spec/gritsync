import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Copy, Check, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CreatedAccountCredentials {
  id?: string
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  personal_email: string
  gritsync_email?: string | null
  grit_id?: string | null
  mobile?: string | null
  /** plaintext temporary password — only available client-side at create time. */
  password: string
  /** Optional role label for the heading ("client", "affiliate", etc). */
  role_label?: string
}

const ACCENTS = {
  primary: { btn: 'bg-primary-600 hover:bg-primary-700', chip: 'text-primary-700 dark:text-primary-300', icon: 'text-primary-600 dark:text-primary-400' },
  violet:  { btn: 'bg-violet-600 hover:bg-violet-700',   chip: 'text-violet-700 dark:text-violet-300',   icon: 'text-violet-600 dark:text-violet-400' },
  amber:   { btn: 'bg-amber-600 hover:bg-amber-700',     chip: 'text-amber-700 dark:text-amber-300',     icon: 'text-amber-600 dark:text-amber-400' },
} as const

function formatCredentialsBlock(c: CreatedAccountCredentials): string {
  const fullName = `${c.first_name || ''}${c.middle_name ? ` ${c.middle_name}` : ''}${c.last_name ? ` ${c.last_name}` : ''}`.trim() || c.personal_email
  const lines = [
    `Your GritSync account is ready, ${fullName}.`,
    '',
    `Sign in at: ${typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://gritsync.com/login'}`,
    `Email:    ${c.personal_email}`,
    `Password: ${c.password}`,
    '',
    c.grit_id ? `GRIT ID:        ${c.grit_id}` : '',
    c.gritsync_email ? `GritSync email: ${c.gritsync_email}` : '',
    c.mobile ? `Mobile:         ${c.mobile}` : '',
    '',
    'Please change your password after your first sign-in.',
  ]
  return lines.filter(Boolean).join('\n')
}

interface CredentialRow {
  label: string
  value: string | null | undefined
  monospace?: boolean
  secret?: boolean
}

export function CredentialsModal({
  credentials,
  onClose,
  accent = 'primary',
}: {
  credentials: CreatedAccountCredentials | null
  onClose: () => void
  accent?: keyof typeof ACCENTS
}) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  if (!credentials) return null
  const a = ACCENTS[accent]

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
      showToast('Could not copy — please select and copy manually', 'error')
    }
  }

  const fullName = `${credentials.first_name || ''}${credentials.middle_name ? ` ${credentials.middle_name}` : ''}${credentials.last_name ? ` ${credentials.last_name}` : ''}`.trim() || credentials.personal_email

  const rows: CredentialRow[] = [
    { label: 'Full name', value: fullName },
    { label: 'Login email', value: credentials.personal_email },
    { label: 'Temporary password', value: credentials.password, monospace: true, secret: true },
    { label: 'GRIT ID', value: credentials.grit_id, monospace: true },
    { label: 'GritSync email', value: credentials.gritsync_email },
    { label: 'Mobile', value: credentials.mobile },
  ].filter((r) => !!r.value)

  return (
    <Modal isOpen={true} onClose={onClose} title="Account created" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium">The {credentials.role_label || 'account'} is ready to sign in.</p>
            <p className="text-xs mt-0.5 opacity-90">
              Send these credentials to the {credentials.role_label || 'user'} via a secure channel. The temporary password is shown <strong>once</strong> — you won't be able to retrieve it later.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
          {rows.map((row) => {
            const isPassword = row.secret
            const display = isPassword && !showPassword ? '•'.repeat(Math.max(8, (row.value || '').length)) : (row.value || '')
            const key = row.label
            const just = copied === key
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900">
                <div className="w-32 flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{row.label}</div>
                <div className={cn('flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 truncate', row.monospace && 'font-mono')}>{display}</div>
                {isPassword && (
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyValue(key, row.value || '')}
                  className={cn('p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200', just && a.icon)}
                  title={`Copy ${row.label.toLowerCase()}`}
                >
                  {just ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyValue('all', formatCredentialsBlock(credentials))}
          >
            {copied === 'all' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy all (formatted)
          </Button>
          <Button type="button" size="sm" onClick={onClose} className={cn(a.btn, 'text-white')}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
