import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
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
  Info, Bell, Globe, Smartphone, Clock, QrCode, Copy, 
  Check, X, ToggleLeft, ToggleRight, Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

  async function fetchPreferences() {
    try {
      const preferences = await userPreferencesAPI.get()
      setEmailPreferences({
        email_notifications_enabled: preferences.email_notifications_enabled ?? true,
        email_timeline_updates: preferences.email_timeline_updates ?? true,
        email_status_changes: preferences.email_status_changes ?? true,
        email_payment_updates: preferences.email_payment_updates ?? true,
        email_general_notifications: preferences.email_general_notifications ?? true,
      })
      setTwoFactorEnabled(preferences.two_factor_enabled ?? false)
      if (preferences.two_factor_backup_codes) {
        setTwoFactorBackupCodes(preferences.two_factor_backup_codes)
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
    : user?.full_name || 'User'

  const nameForAvatar = userDetails
    ? getFullNameWithMiddle(userDetails.first_name, userDetails.middle_name, userDetails.last_name, user?.email || '')
    : user?.first_name && user?.last_name
    ? getFullNameWithMiddle(user.first_name, undefined, user.last_name, user?.email || '')
    : user?.email || 'User'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Account Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your account security, preferences, and personal information
            </p>
          </div>

          <div className="space-y-6">
            {/* Profile Header */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0",
                  getAvatarColor(nameForAvatar),
                  getAvatarColorDark(nameForAvatar),
                  getAvatarTextColor(nameForAvatar),
                  getAvatarTextColorDark(nameForAvatar)
                )}>
                  {getInitials(nameForAvatar)}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {fullName}
                  </h2>
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    {user?.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                        <Shield className="h-3 w-3" />
                        Administrator
                      </span>
                    )}
                    {user?.role === 'client' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <User className="h-3 w-3" />
                        Client
                      </span>
                    )}
                    {user?.grit_id && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <Key className="h-3 w-3" />
                        ID: {user.grit_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Account Information */}
            <Card className="border-0 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Account Information
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your account details and membership information
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email Address</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.email}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User ID</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{user?.id?.substring(0, 8)}...</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Member Since</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Active</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Password Section */}
            <Card className="border-0 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <Lock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Password Management
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Change your password to keep your account secure
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Current Password Display */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Current Password
                  </label>
                  <div className="relative">
                    {showPasswordPlaceholder ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                          ••••••••••••
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPasswordPlaceholder(false)}
                          className="text-xs"
                        >
                          Change Password
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* New Password */}
                {!showPasswordPlaceholder && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        New Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min. 6 characters)"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {passwordStrength && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300",
                                  passwordStrength.strength === 'weak' && "bg-red-500 w-1/4",
                                  passwordStrength.strength === 'medium' && "bg-yellow-500 w-2/4",
                                  passwordStrength.strength === 'strong' && "bg-blue-500 w-3/4",
                                  passwordStrength.strength === 'very-strong' && "bg-green-500 w-full"
                                )}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-medium",
                              passwordStrength.strength === 'weak' && "text-red-600 dark:text-red-400",
                              passwordStrength.strength === 'medium' && "text-yellow-600 dark:text-yellow-400",
                              passwordStrength.strength === 'strong' && "text-blue-600 dark:text-blue-400",
                              passwordStrength.strength === 'very-strong' && "text-green-600 dark:text-green-400"
                            )}>
                              {passwordStrength.strength === 'weak' && 'Weak'}
                              {passwordStrength.strength === 'medium' && 'Medium'}
                              {passwordStrength.strength === 'strong' && 'Strong'}
                              {passwordStrength.strength === 'very-strong' && 'Very Strong'}
                            </span>
                          </div>
                          {passwordStrength.feedback.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {passwordStrength.feedback.map((tip, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <Info className="h-3 w-3" />
                                  {tip}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className={cn(
                            "pr-10",
                            passwordsMatch === false && "border-red-500 focus:border-red-500",
                            passwordsMatch === true && "border-green-500 focus:border-green-500"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {passwordsMatch !== null && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {passwordsMatch ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">Passwords match</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span className="text-red-600 dark:text-red-400">Passwords do not match</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleChangePassword}
                        disabled={saving || !passwordsMatch || (passwordStrength && passwordStrength.strength === 'weak')}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Changing...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Change Password
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPasswordPlaceholder(true)
                          setCurrentPassword('')
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                        disabled={saving}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Email Notifications */}
            <Card className="border-0 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Email Notifications
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose which email notifications you want to receive
                  </p>
                </div>
                <Button
                  onClick={handleSaveEmailPreferences}
                  disabled={savingPreferences}
                  size="sm"
                >
                  {savingPreferences ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-4">
                {/* Master Toggle */}
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Enable Email Notifications
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Master switch for all email notifications
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleEmailNotifications('email_notifications_enabled')}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        emailPreferences.email_notifications_enabled
                          ? "bg-primary-600 dark:bg-primary-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          emailPreferences.email_notifications_enabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Individual Notification Types */}
                {emailPreferences.email_notifications_enabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Timeline Updates
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Get notified when your application timeline changes
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleEmailNotifications('email_timeline_updates')}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          emailPreferences.email_timeline_updates
                            ? "bg-primary-600 dark:bg-primary-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            emailPreferences.email_timeline_updates ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Status Changes
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Receive updates when your application status changes
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleEmailNotifications('email_status_changes')}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          emailPreferences.email_status_changes
                            ? "bg-primary-600 dark:bg-primary-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            emailPreferences.email_status_changes ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Payment Updates
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Get notified about payment status and receipts
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleEmailNotifications('email_payment_updates')}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          emailPreferences.email_payment_updates
                            ? "bg-primary-600 dark:bg-primary-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            emailPreferences.email_payment_updates ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Info className="h-4 w-4 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            General Notifications
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Receive general account updates and announcements
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleEmailNotifications('email_general_notifications')}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          emailPreferences.email_general_notifications
                            ? "bg-primary-600 dark:bg-primary-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            emailPreferences.email_general_notifications ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Two-Factor Authentication */}
            <Card className="border-0 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Two-Factor Authentication
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add an extra layer of security to your account
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {!twoFactorEnabled && !twoFactorSetupMode && (
                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Lock className="h-4 w-4 text-gray-400" />
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Two-Factor Authentication is Disabled
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Enable 2FA to protect your account with an additional security layer. You'll need an authenticator app like Google Authenticator or Authy.
                        </p>
                        <Button onClick={handleEnable2FA} size="sm">
                          <Shield className="h-4 w-4 mr-2" />
                          Enable Two-Factor Authentication
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {twoFactorSetupMode && (
                  <div className="space-y-4 p-4 rounded-lg border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20">
                    <div className="flex items-center gap-2 mb-2">
                      <QrCode className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Setup Two-Factor Authentication
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
                        </p>
                        {twoFactorQRCode && (
                          <div className="flex justify-center mb-4">
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <img src={twoFactorQRCode} alt="2FA QR Code" className="w-48 h-48" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Or enter this secret key manually:
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={twoFactorSecret || ''}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopySecret}
                          >
                            {copiedSecret ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Enter the 6-digit code from your authenticator app:
                        </label>
                        <Input
                          type="text"
                          value={twoFactorVerificationCode}
                          onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="font-mono text-center text-lg tracking-widest"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleVerify2FA}
                          disabled={twoFactorVerificationCode.length !== 6}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify & Enable
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTwoFactorSetupMode(false)
                            setTwoFactorSecret(null)
                            setTwoFactorVerificationCode('')
                            setTwoFactorQRCode(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {twoFactorEnabled && !twoFactorSetupMode && (
                  <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Two-Factor Authentication is Enabled
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when signing in.
                        </p>
                        {showBackupCodes && twoFactorBackupCodes.length > 0 && (
                          <div className="mb-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                                Backup Codes (Save these in a safe place!)
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDownloadBackupCodes}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                              {twoFactorBackupCodes.map((code, index) => (
                                <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-center">
                                  {code}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                              Each code can only be used once. Store them securely.
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBackupCodes(!showBackupCodes)}
                          >
                            {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDisable2FA}
                            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Disable 2FA
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Account Actions */}
            <Card className="border-0 shadow-md border-red-200 dark:border-red-900/50">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Account Actions
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage your account session and access
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LogOut className="h-5 w-5 text-gray-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Sign Out
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Sign out of your account on this device
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                      className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
