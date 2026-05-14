import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { CredentialsModal, type CreatedAccountCredentials } from '@/components/CredentialsModal'
import { generatePassword, getFullName, cn } from '@/lib/utils'
import { UserPlus, RefreshCcw, Eye, EyeOff } from 'lucide-react'

interface CreateForm {
  first_name: string
  last_name: string
  middle_name: string
  personal_email: string
  mobile: string
  password: string
}
const empty: CreateForm = {
  first_name: '', last_name: '', middle_name: '', personal_email: '', mobile: '', password: '',
}

interface CreatedClient {
  id: string
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  personal_email?: string | null
  gritsync_email?: string | null
  grit_id?: string | null
}

/**
 * "New Client" call-to-action for advisors. Wraps the entire create flow:
 * trigger button → form modal (with password generator) → credentials modal.
 * Pass an `onCreated` callback to refresh whatever list is open behind it.
 */
export function NewClientButton({
  onCreated,
  label = 'New Client',
  accent = 'violet',
  className,
  size = 'sm',
}: {
  onCreated?: (client: CreatedClient) => void
  label?: string
  accent?: 'violet' | 'primary'
  className?: string
  size?: 'sm' | 'md'
}) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CreateForm>(empty)
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState<CreatedAccountCredentials | null>(null)

  const accentBtn = accent === 'primary'
    ? 'bg-primary-600 hover:bg-primary-700 text-white'
    : 'bg-violet-600 hover:bg-violet-700 text-white'

  const openModal = () => {
    setForm({ ...empty, password: generatePassword(14) })
    setShowPassword(true)
    setOpen(true)
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const f = form
    if (!f.first_name.trim() || !f.last_name.trim()) { showToast('First and last name are required', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.personal_email.trim())) { showToast('A valid personal email is required', 'error'); return }
    if (!f.mobile.trim()) { showToast('Mobile number is required', 'error'); return }
    if (f.password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }

    setBusy(true)
    try {
      const token = localStorage.getItem('gritsync_token')
      const res = await fetch('/api/auth/advisor/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: f.first_name.trim(),
          last_name: f.last_name.trim(),
          middle_name: f.middle_name.trim() || undefined,
          personal_email: f.personal_email.trim(),
          mobile: f.mobile.trim(),
          password: f.password,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed to create client')
      const u = d.user as CreatedClient

      setCredentials({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        middle_name: u.middle_name,
        personal_email: u.personal_email || f.personal_email.trim(),
        gritsync_email: u.gritsync_email || null,
        grit_id: u.grit_id || null,
        mobile: f.mobile.trim(),
        password: f.password,
        role_label: 'client',
      })
      setOpen(false)
      setForm(empty)
      showToast(`${getFullName(u.first_name, u.last_name)} created and assigned to you`, 'success')
      onCreated?.(u)
    } catch (err: any) {
      showToast(err.message || 'Failed to create client', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size={size} onClick={openModal} className={cn(accentBtn, className)}>
        <UserPlus className="h-4 w-4 mr-2" /> {label}
      </Button>

      <Modal
        isOpen={open}
        onClose={() => { if (!busy) setOpen(false) }}
        title="New client"
        size="md"
      >
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The client is created already verified and is automatically assigned to you. They'll be able to sign in right away with the credentials shown after you save.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Juan" />
            <Input label="Last Name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Dela Cruz" />
          </div>
          <Input label="Middle Name (optional)" value={form.middle_name} onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))} />
          <Input label="Personal Email" type="email" value={form.personal_email} onChange={(e) => setForm((f) => ({ ...f, personal_email: e.target.value }))} placeholder="name@example.com" />
          <Input label="Mobile Number" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="+63..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, password: generatePassword(14) }))} title="Generate a strong password">
                <RefreshCcw className="h-4 w-4 mr-2" /> Generate
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">A strong 14-character password is pre-generated. Hit Generate again to roll a new one, or type your own.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy} className={accentBtn}>
              <UserPlus className={cn('h-4 w-4 mr-2', busy && 'animate-pulse')} />
              {busy ? 'Creating…' : 'Create Client'}
            </Button>
          </div>
        </form>
      </Modal>

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} accent={accent} />
    </>
  )
}
