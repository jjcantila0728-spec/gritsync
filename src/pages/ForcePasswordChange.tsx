import { useState } from 'react'
import { db } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { Lock, ShieldAlert, Eye, EyeOff, LogOut } from 'lucide-react'

/**
 * Full-screen gate shown when `user.must_change_password` is true — i.e. an
 * admin issued a temporary password because the client forgot theirs. The
 * client has just logged in with that temp password; here they must set a
 * permanent one before they can reach any other page. Setting the password
 * clears the flag server-side (PUT /api/auth/update), and `refreshUser()`
 * re-reads /auth/me so the gate lifts automatically.
 */
export function ForcePasswordChange() {
  const { refreshUser, signOut } = useAuth()
  const { showToast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      showToast('Password must be at least 8 characters long', 'error')
      return
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      const { error } = await db.auth.updateUser({ password })
      if (error) throw new Error(error.message)
      showToast('Password updated. Welcome to GritSync!', 'success')
      // Re-read /auth/me so must_change_password flips to false and the gate lifts.
      await refreshUser()
    } catch (err: any) {
      showToast(err.message || 'Could not update your password. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch {
      /* ignore — sign-out failures shouldn't trap the user here */
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4 py-12">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Set a New Password
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              You're signed in with a temporary password. For your security,
              please choose a new password before continuing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
                required
                autoFocus
                className="pl-10"
                rightIcon={showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                onRightIconClick={() => setShowPassword(!showPassword)}
              />
              <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                <Lock className="h-5 w-5" />
              </div>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                className="pl-10"
                rightIcon={showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                onRightIconClick={() => setShowConfirm(!showConfirm)}
              />
              <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                <Lock className="h-5 w-5" />
              </div>
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-red-500 dark:text-red-400">Passwords do not match</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save New Password'
              )}
            </Button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
