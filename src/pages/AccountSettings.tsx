import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { getInitials, getAvatarColor, getAvatarColorDark, getAvatarTextColor, getAvatarTextColorDark } from '@/lib/avatar'
import { userDetailsAPI, userPreferencesAPI } from '@/lib/api'
import { getFullNameWithMiddle } from '@/lib/utils'
import { 
  Lock, Eye, EyeOff, Save, Shield, User, Mail, Calendar, 
  Key, LogOut, AlertTriangle, CheckCircle2, XCircle, 
  Info, Bell, Clock, QrCode, Copy, 
  Check, X, Download, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SettingsTab = 'security' | 'notifications' | 'sessions'

// Password strength checker
function getPasswordStrength(password: string): { strength: 'weak' | 'medium' | 'strong' | 'very-strong', score: number, feedback: string[] } {
  let score = 0
  const feedback: string[] = []

  if (password.length >= 8) score += 1
  else feedback.push('Use at least 8 characters')

  if (password.length >= 12) score += 1

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  else feedback.push('Mix uppercase and lowercase letters')

  if (/\d/.test(password)) score += 1
  else feedback.push('Add numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score += 1
  else feedback.push('Include special characters (!@#$%^&*)')

  if (score <= 1) return { strength: 'weak', score, feedback }
  if (score <= 2) return { strength: 'medium', score, feedback }
  if (score <= 3) return { strength: 'strong', score, feedback }
  return { strength: 'very-strong', score, feedback: [] }
}

export function AccountSettings() {
  const { user, changePassword, signOut } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [userDetails, setUserDetails] = useState<{ first_name?: string; middle_name?: string; last_name?: string } | null>(null)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('security')
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordPlaceholder, setShowPasswordPlaceholder] = useState(true)

  // Email Notifications state
  const [emailPreferences, setEmailPreferences] = useState({
    email_notifications_enabled: true,
    email_timeline_updates: true,
    email_status_changes: true,
    email_payment_updates: true,
    email_general_notifications: true,
  })

  // Two-Factor Authentication state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null)
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([])
  const [twoFactorSetupMode, setTwoFactorSetupMode] = useState(false)
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState('')
  const [twoFactorQRCode, setTwoFactorQRCode] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUserDetails()
      fetchPreferences()
      fetchClientEmail()
    } else {
      setLoading(false)
    }
  }, [user])

  async function fetchUserDetails() {
    try {
      const details = await userDetailsAPI.get()
      if (details) {
        setUserDetails({
          first_name: details.first_name,
          middle_name: details.middle_name,
          last_name: details.last_name,
        })
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchClientEmail() {
    if (!user?.id) return
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      const addresses = await emailAddressesAPI.getUserAddresses(user.id)
      const primaryAddress = addresses.find(addr => addr.is_primary && addr.address_type === 'client')
      if (primaryAddress) {
        setClientEmail(primaryAddress.email_address)
      }
    } catch (error) {
      console.error('Error fetching client email:', error)
    }
  }

  async function fetchPreferences() {
    try {
      const preferences = await userPreferencesAPI.get()
      const typedPreferences = preferences as {
        email_notifications_enabled?: boolean
        email_timeline_updates?: boolean
        email_status_changes?: boolean
        email_payment_updates?: boolean
        email_general_notifications?: boolean
        two_factor_enabled?: boolean
        two_factor_backup_codes?: string[]
      } | null
      if (typedPreferences) {
        setEmailPreferences({
          email_notifications_enabled: typedPreferences.email_notifications_enabled ?? true,
          email_timeline_updates: typedPreferences.email_timeline_updates ?? true,
          email_status_changes: typedPreferences.email_status_changes ?? true,
          email_payment_updates: typedPreferences.email_payment_updates ?? true,
          email_general_notifications: typedPreferences.email_general_notifications ?? true,
        })
        setTwoFactorEnabled(typedPreferences.two_factor_enabled ?? false)
        if (typedPreferences.two_factor_backup_codes) {
          setTwoFactorBackupCodes(typedPreferences.two_factor_backup_codes)
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
    }
  }

  const passwordStrength = newPassword ? getPasswordStrength(newPassword) : null
  const passwordsMatch = newPassword && confirmPassword ? newPassword === confirmPassword : null

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      showToast('Please enter your current password', 'error')
      return
    }

    if (!newPassword) {
      showToast('Please enter a new password', 'error')
      return
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }

    if (currentPassword === newPassword) {
      showToast('New password must be different from current password', 'error')
      return
    }

    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('Password changed successfully!', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordPlaceholder(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to change password', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      showToast('Signed out successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to sign out', 'error')
    }
  }

  const handleSaveEmailPreferences = async () => {
    setSavingPreferences(true)
    try {
      await userPreferencesAPI.save({
        ...emailPreferences,
        two_factor_enabled: twoFactorEnabled,
        two_factor_secret: twoFactorSecret,
        two_factor_backup_codes: twoFactorBackupCodes,
      })
      showToast('Email preferences saved successfully!', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to save preferences', 'error')
    } finally {
      setSavingPreferences(false)
    }
  }

  const handleToggleEmailNotifications = (key: keyof typeof emailPreferences) => {
    setEmailPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleEnable2FA = async () => {
    try {
      // Generate secret and backup codes
      const secret = await userPreferencesAPI.generate2FASecret()
      const backupCodes = userPreferencesAPI.generateBackupCodes()
      
      setTwoFactorSecret(secret)
      setTwoFactorBackupCodes(backupCodes)
      setTwoFactorSetupMode(true)
      
      // Generate QR code URL (using otpauth URL format)
      const issuer = 'GritSync'
      const accountName = user?.email || 'User'
      const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`
      
      // Use a QR code API service (or generate client-side)
      // For now, we'll use a simple QR code generator service
      setTwoFactorQRCode(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`)
      
      showToast('Scan the QR code with your authenticator app', 'info')
    } catch (error: any) {
      showToast(error.message || 'Failed to enable 2FA', 'error')
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorSecret || !twoFactorVerificationCode) {
      showToast('Please enter the verification code', 'error')
      return
    }

    try {
      const isValid = await userPreferencesAPI.verify2FACode(twoFactorSecret, twoFactorVerificationCode)
      
      if (isValid) {
        // Save 2FA settings
        await userPreferencesAPI.save({
          ...emailPreferences,
          two_factor_enabled: true,
          two_factor_secret: twoFactorSecret,
          two_factor_backup_codes: twoFactorBackupCodes,
          two_factor_verified_at: new Date().toISOString(),
        })
        
        setTwoFactorEnabled(true)
        setTwoFactorSetupMode(false)
        setTwoFactorVerificationCode('')
        setShowBackupCodes(true)
        showToast('Two-Factor Authentication enabled successfully!', 'success')
      } else {
        showToast('Invalid verification code. Please try again.', 'error')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to verify 2FA code', 'error')
    }
  }

  const handleDisable2FA = async () => {
    try {
      await userPreferencesAPI.save({
        ...emailPreferences,
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        two_factor_verified_at: null,
      })
      
      setTwoFactorEnabled(false)
      setTwoFactorSecret(null)
      setTwoFactorBackupCodes([])
      setTwoFactorSetupMode(false)
      setShowBackupCodes(false)
      showToast('Two-Factor Authentication disabled', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to disable 2FA', 'error')
    }
  }

  const handleCopySecret = () => {
    if (twoFactorSecret) {
      navigator.clipboard.writeText(twoFactorSecret)
      setCopiedSecret(true)
      showToast('Secret key copied to clipboard', 'success')
      setTimeout(() => setCopiedSecret(false), 2000)
    }
  }

  const handleDownloadBackupCodes = () => {
    const codesText = twoFactorBackupCodes.join('\n')
    const blob = new Blob([`GritSync Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${codesText}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gritsync-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Backup codes downloaded', 'success')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <Loading text="Loading..." />
          </main>
        </div>
      </div>
    )
  }

  const fullName = userDetails
    ? getFullNameWithMiddle(userDetails.first_name, userDetails.middle_name, userDetails.last_name, '')
    : user?.first_name && user?.last_name
    ? getFullNameWithMiddle(user.first_name, undefined, user.last_name, '')
    : 'User'

  const nameForAvatar = userDetails
    ? getFullNameWithMiddle(userDetails.first_name, userDetails.middle_name, userDetails.last_name, user?.email || '')
    : user?.first_name && user?.last_name
    ? getFullNameWithMiddle(user.first_name, undefined, user.last_name, user?.email || '')
    : user?.email || 'User'

  const TABS: { id: SettingsTab; label: string; icon: typeof Shield }[] = [
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'sessions', label: 'Sessions', icon: LogOut },
  ]

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-[#17c3b2]" : "bg-gray-200 dark:bg-gray-600"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  )

  const PasswordStrengthBar = ({ strength }: { strength: string }) => {
    const bars = ['weak', 'medium', 'strong', 'very-strong']
    const colors: Record<string, string> = {
      weak: 'bg-red-500', medium: 'bg-amber-500', strong: 'bg-blue-500', 'very-strong': 'bg-green-500'
    }
    const fill = bars.indexOf(strength) + 1
    return (
      <div className="flex gap-1 mt-2">
        {bars.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < fill ? colors[strength] : 'bg-gray-200 dark:bg-gray-700')} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-12">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-[#0d2137] via-[#163352] to-[#0d2137] px-4 sm:px-8 py-8">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-end gap-5">
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 ring-4 ring-white/20 shadow-xl",
                getAvatarColor(nameForAvatar),
                getAvatarColorDark(nameForAvatar),
                getAvatarTextColor(nameForAvatar),
                getAvatarTextColorDark(nameForAvatar)
              )}>
                {getInitials(nameForAvatar)}
              </div>
              <div className="text-center sm:text-left pb-1">
                <h1 className="text-2xl font-bold text-white leading-tight">{fullName}</h1>
                <p className="text-white/60 text-sm mt-0.5">{clientEmail || user?.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                  {user?.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  )}
                  {user?.role === 'client' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#17c3b2]/20 text-[#17c3b2] border border-[#17c3b2]/30">
                      <User className="h-3 w-3" /> Client
                    </span>
                  )}
                  {user?.grit_id && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/70 border border-white/20">
                      <Key className="h-3 w-3" /> {user.grit_id}
                    </span>
                  )}
                  {user?.created_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60 border border-white/20">
                      <Calendar className="h-3 w-3" /> Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-16 z-10">
            <div className="max-w-4xl mx-auto px-4 sm:px-8">
              <nav className="flex gap-0 overflow-x-auto scrollbar-none">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === id
                        ? "border-[#17c3b2] text-[#17c3b2]"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-5">

            {/* ── SECURITY TAB ── */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                {/* Account Info */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account Information</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Your GritSync account details</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">{user?.email}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Key className="h-3.5 w-3.5" /> GritSync ID</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{user?.grit_id || user?.id?.substring(0, 12) + '...'}</p>
                    </div>
                    <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Member Since</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </p>
                    </div>
                    <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Status</p>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#17c3b2]/10 dark:bg-[#17c3b2]/20">
                      <Lock className="h-4 w-4 text-[#17c3b2]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Password</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Update your login password</p>
                    </div>
                  </div>
                  <div className="px-5 py-5 space-y-4">
                    {showPasswordPlaceholder ? (
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</p>
                            <p className="text-xs text-gray-400">••••••••••••</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowPasswordPlaceholder(false)}>
                          Change
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Current Password</label>
                          <div className="relative">
                            <Input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="pr-10" />
                            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">New Password</label>
                          <div className="relative">
                            <Input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" className="pr-10" />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {passwordStrength && (
                            <div className="mt-2">
                              <PasswordStrengthBar strength={passwordStrength.strength} />
                              <p className={cn("text-xs mt-1 font-medium capitalize", {
                                'text-red-500': passwordStrength.strength === 'weak',
                                'text-amber-500': passwordStrength.strength === 'medium',
                                'text-blue-500': passwordStrength.strength === 'strong',
                                'text-green-500': passwordStrength.strength === 'very-strong',
                              })}>
                                {passwordStrength.strength.replace('-', ' ')}
                              </p>
                              {passwordStrength.feedback.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {passwordStrength.feedback.map((f, i) => (
                                    <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                      <Info className="h-3 w-3 flex-shrink-0" />{f}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Confirm New Password</label>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className={cn("pr-10", passwordsMatch === false && "border-red-500", passwordsMatch === true && "border-green-500")}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {passwordsMatch !== null && (
                            <p className={cn("text-xs mt-1 flex items-center gap-1", passwordsMatch ? 'text-green-600' : 'text-red-500')}>
                              {passwordsMatch ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button onClick={handleChangePassword} disabled={saving || passwordsMatch === false || passwordStrength?.strength === 'weak'} className="flex-1">
                            {saving ? 'Saving...' : <><Save className="h-4 w-4 mr-1.5" /> Change Password</>}
                          </Button>
                          <Button variant="outline" onClick={() => { setShowPasswordPlaceholder(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }} disabled={saving}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                      <Shield className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Two-Factor Authentication</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    {!twoFactorEnabled && !twoFactorSetupMode && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Two-Factor Authentication is Disabled</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable 2FA to protect your account with an additional verification step. You'll need an authenticator app like Google Authenticator or Authy.</p>
                        </div>
                        <Button onClick={handleEnable2FA} size="sm" className="flex-shrink-0">
                          <Shield className="h-4 w-4 mr-1.5" /> Enable 2FA
                        </Button>
                      </div>
                    )}

                    {twoFactorSetupMode && (
                      <div className="space-y-4 p-4 rounded-lg border-2 border-[#17c3b2]/30 bg-[#17c3b2]/5 dark:bg-[#17c3b2]/10">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Scan this QR code with your authenticator app, or enter the secret key manually.</p>
                        {twoFactorQRCode && (
                          <div className="flex justify-center">
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 inline-block">
                              <img src={twoFactorQRCode} alt="2FA QR Code" className="w-40 h-40" />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Secret Key</label>
                          <div className="flex items-center gap-2">
                            <Input value={twoFactorSecret || ''} readOnly className="font-mono text-xs" />
                            <Button variant="outline" size="sm" onClick={handleCopySecret}>{copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Verification Code</label>
                          <Input type="text" value={twoFactorVerificationCode} onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="font-mono text-center text-lg tracking-widest" />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleVerify2FA} disabled={twoFactorVerificationCode.length !== 6} className="flex-1">
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Verify &amp; Enable
                          </Button>
                          <Button variant="outline" onClick={() => { setTwoFactorSetupMode(false); setTwoFactorSecret(null); setTwoFactorVerificationCode(''); setTwoFactorQRCode(null) }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {twoFactorEnabled && !twoFactorSetupMode && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">2FA is Active</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Your account has an extra layer of protection.</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={handleDisable2FA} className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                            <X className="h-4 w-4 mr-1" /> Disable
                          </Button>
                        </div>
                        {twoFactorBackupCodes.length > 0 && (
                          <div>
                            <button onClick={() => setShowBackupCodes(!showBackupCodes)} className="text-xs text-[#17c3b2] hover:underline font-medium flex items-center gap-1">
                              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showBackupCodes && "rotate-90")} />
                              {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
                            </button>
                            {showBackupCodes && (
                              <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Backup Codes — save these somewhere safe</p>
                                  <Button variant="ghost" size="sm" onClick={handleDownloadBackupCodes}><Download className="h-3 w-3 mr-1" /> Download</Button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                                  {twoFactorBackupCodes.map((code, i) => (
                                    <div key={i} className="px-2 py-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-center">{code}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS TAB ── */}
            {activeTab === 'notifications' && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Email Notifications</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Choose which emails you want to receive</p>
                    </div>
                  </div>
                  <Button onClick={handleSaveEmailPreferences} disabled={savingPreferences} size="sm">
                    {savingPreferences ? 'Saving...' : <><Save className="h-4 w-4 mr-1.5" /> Save</>}
                  </Button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    { key: 'email_notifications_enabled' as const, label: 'Enable Email Notifications', desc: 'Master switch for all email notifications', icon: Mail, isMain: true },
                    ...(emailPreferences.email_notifications_enabled ? [
                      { key: 'email_timeline_updates' as const, label: 'Timeline Updates', desc: 'Get notified when your application timeline changes', icon: Clock },
                      { key: 'email_status_changes' as const, label: 'Status Changes', desc: 'Receive updates when your application status changes', icon: CheckCircle2 },
                      { key: 'email_payment_updates' as const, label: 'Payment Updates', desc: 'Get notified about payment status and receipts', icon: Key },
                      { key: 'email_general_notifications' as const, label: 'General Notifications', desc: 'Receive general account updates and announcements', icon: Info },
                    ] : []),
                  ].map(({ key, label, desc, icon: Icon, isMain }) => (
                    <div key={key} className={cn("flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors", isMain && 'bg-gray-50 dark:bg-gray-800/50', !isMain && 'pl-10')}>
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-4 w-4 flex-shrink-0", isMain ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400')} />
                        <div>
                          <p className={cn("text-sm text-gray-900 dark:text-gray-100", isMain ? 'font-semibold' : 'font-medium')}>{label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                        </div>
                      </div>
                      <Toggle checked={emailPreferences[key]} onChange={() => handleToggleEmailNotifications(key)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SESSIONS TAB ── */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
                      <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sessions &amp; Access</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Manage your active sessions</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          <LogOut className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Current Session</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Signed in on this device · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                      >
                        <LogOut className="h-4 w-4 mr-2" /> Sign Out
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
