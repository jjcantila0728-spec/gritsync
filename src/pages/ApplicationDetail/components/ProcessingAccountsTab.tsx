import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { CheckCircle, XCircle, Plus, Edit, Trash2, Copy, Mail, ExternalLink, Lock, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { processingAccountsAPI } from '@/lib/api'
import { copyToClipboard as copyToClipboardUtil } from '../utils/clipboardHelpers'

interface ProcessingAccountsTabProps {
  processingAccounts: any[]
  loadingAccounts: boolean
  isAdmin: boolean
  showAccountModal: boolean
  setShowAccountModal: (show: boolean) => void
  editingAccount: any
  setEditingAccount: (account: any) => void
  accountForm: any
  setAccountForm: (form: any) => void
  isUserForm: boolean
  setIsUserForm: (isUser: boolean) => void
  savingAccount: boolean
  setSavingAccount: (saving: boolean) => void
  setProcessingAccounts: (accounts: any[]) => void
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  application: any
  openAccountModal: (account?: any) => void
  handleDeleteAccount: (id: string) => void
  user: any
  hasApprovedPayment?: boolean
  refreshAccounts?: () => void | Promise<void>
}

function accountTypeLabel(t: string | undefined, fallbackName?: string): string {
  switch (t) {
    case 'gritsync': return 'GritSync Email'
    case 'pearson_vue': return 'Pearson Vue Account'
    case 'mandatory_courses': return 'Mandatory Courses'
    default: return fallbackName || 'Custom Account'
  }
}

function accountTypeLink(account: any): string | null {
  if (account.account_type === 'gritsync') return '/client/emails'
  if (account.account_type === 'pearson_vue') return 'https://wsr.pearsonvue.com/testtaker/signin/SignInPage.htm?clientCode=NCLEXTESTING'
  if (account.account_type === 'mandatory_courses') return account.link || 'https://nyrequirements.com/'
  if (account.account_type === 'custom') return account.link || null
  return null
}

export function ProcessingAccountsTab({
  processingAccounts,
  loadingAccounts,
  isAdmin,
  showAccountModal,
  setShowAccountModal,
  editingAccount,
  accountForm,
  setAccountForm,
  savingAccount,
  setSavingAccount,
  setIsUserForm,
  showToast,
  application,
  openAccountModal,
  handleDeleteAccount,
  user,
  hasApprovedPayment = false,
  refreshAccounts,
}: ProcessingAccountsTabProps) {
  const [pendingChange, setPendingChange] = useState<{
    id: string
    action: 'activate' | 'deactivate'
    label: string
  } | null>(null)
  const [busy, setBusy] = useState(false)

  function requestActivate(account: any) {
    if (!hasApprovedPayment) {
      showToast('Cannot activate — this client has no approved payment on file.', 'warning')
      return
    }
    setPendingChange({
      id: account.id,
      action: 'activate',
      label: accountTypeLabel(account.account_type, account.name),
    })
  }

  function requestDeactivate(account: any) {
    setPendingChange({
      id: account.id,
      action: 'deactivate',
      label: accountTypeLabel(account.account_type, account.name),
    })
  }

  async function confirmStatusChange() {
    if (!pendingChange) return
    setBusy(true)
    try {
      if (pendingChange.action === 'activate') {
        await processingAccountsAPI.activate(pendingChange.id)
        showToast(`${pendingChange.label} activated.`, 'success')
      } else {
        await processingAccountsAPI.deactivate(pendingChange.id)
        showToast(`${pendingChange.label} deactivated.`, 'success')
      }
      if (refreshAccounts) await refreshAccounts()
      setPendingChange(null)
    } catch (err: any) {
      showToast(err?.message || `Failed to ${pendingChange.action} account`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveAccount() {
    if (!application?.id) {
      showToast('Application is not loaded yet — please try again.', 'error')
      return
    }
    if (!accountForm?.email || !accountForm?.password) {
      showToast('Email and password are required.', 'warning')
      return
    }
    setSavingAccount(true)
    try {
      if (editingAccount?.id) {
        // Update existing account
        await processingAccountsAPI.patch(editingAccount.id, {
          name: accountForm.name ?? null,
          link: accountForm.link ?? null,
          email: accountForm.email,
          password: accountForm.password,
          security_question_1: accountForm.security_question_1 ?? null,
          security_question_2: accountForm.security_question_2 ?? null,
          security_question_3: accountForm.security_question_3 ?? null,
          status: accountForm.status ?? 'active',
        })
        showToast('Account updated.', 'success')
      } else {
        // Create new account — admin/advisor only; PV and Mandatory Courses are auto-provisioned.
        const type = accountForm.account_type === 'gmail' ? 'gmail' : 'custom'
        await processingAccountsAPI.createCustom({
          application_id: application.id,
          account_type: type,
          name: accountForm.name || undefined,
          link: accountForm.link || undefined,
          email: accountForm.email,
          password: accountForm.password,
          status: accountForm.status ?? 'active',
        })
        showToast('Account added.', 'success')
      }
      setShowAccountModal(false)
      if (refreshAccounts) await refreshAccounts()
    } catch (err: any) {
      showToast(err?.message || 'Failed to save account', 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  const isEditingSystemAccount =
    editingAccount?.account_type === 'pearson_vue' ||
    editingAccount?.account_type === 'mandatory_courses'

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Processing Accounts</h3>
                        <div className="flex gap-2">
                          {!isAdmin && (
                            <Button onClick={() => {
                              setIsUserForm(true)
                              openAccountModal()
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </Button>
                          )}
                          {isAdmin && (
                            <Button onClick={() => {
                              setIsUserForm(false)
                              openAccountModal()
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                    {loadingAccounts ? (
                      <Card>
                        <Loading />
                      </Card>
                    ) : (() => {
                        // Filter accounts based on user role
                        const filteredAccounts = processingAccounts.filter((account) => {
                          // Hide inactive system accounts (Pearson Vue, Mandatory Courses)
                          // from client users — admin must activate them first.
                          if (
                            !isAdmin &&
                            (account.account_type === 'pearson_vue' || account.account_type === 'mandatory_courses') &&
                            account.status === 'inactive'
                          ) {
                            return false
                          }
                          return true
                        })
                        
                        return filteredAccounts.length > 0 ? (
                          <div className="grid md:grid-cols-2 gap-4">
                            {filteredAccounts.map((account) => {
                              const link = accountTypeLink(account)
                              const isSystem = account.account_type === 'pearson_vue' || account.account_type === 'mandatory_courses'
                              const canActivate = isAdmin && isSystem && account.status !== 'active' && hasApprovedPayment
                              return (
                            <Card key={account.id}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                      account.account_type === 'gritsync'
                                        ? 'bg-blue-100 dark:bg-blue-900/30'
                                        : account.account_type === 'pearson_vue'
                                        ? 'bg-purple-100 dark:bg-purple-900/30'
                                        : account.account_type === 'mandatory_courses'
                                        ? 'bg-amber-100 dark:bg-amber-900/30'
                                        : 'bg-green-100 dark:bg-green-900/30'
                                    }`}>
                                      <Mail className={`h-5 w-5 ${
                                        account.account_type === 'gritsync'
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : account.account_type === 'pearson_vue'
                                          ? 'text-purple-600 dark:text-purple-400'
                                          : account.account_type === 'mandatory_courses'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-green-600 dark:text-green-400'
                                      }`} />
                                    </div>
                                    <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                        {accountTypeLabel(account.account_type, account.name)}
                                      </h4>
                                      {link && (
                                        <a
                                          href={link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                          title={`Open ${accountTypeLabel(account.account_type, account.name)}`}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                        account.status === 'active'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                      }`}>
                                        {account.status === 'active' ? (
                                          <CheckCircle className="h-3 w-3" />
                                        ) : (
                                          <XCircle className="h-3 w-3" />
                                        )}
                                        {account.status === 'active' ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Added {account.created_at ? formatDate(account.created_at) : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-3 mt-4">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.email}</p>
                                      <button
                                        onClick={() => copyToClipboardUtil(account.email, 'email', showToast)}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        title="Copy Email"
                                      >
                                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Password</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.password}</p>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(account.password)
                                            showToast('Password copied to clipboard!', 'success')
                                          } catch (error) {
                                            showToast('Failed to copy password', 'error')
                                          }
                                        }}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        title="Copy Password"
                                      >
                                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  {account.account_type === 'pearson_vue' && (
                                    <>
                                      {account.security_question_1 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 1</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 italic">What was the name of the first school you attended?</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.security_question_1}</p>
                                            <button
                                              onClick={() => copyToClipboardUtil(account.security_question_1, 'security question 1', showToast)}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 1"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {account.security_question_2 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 2</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 italic">Who was your childhood hero?</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.security_question_2}</p>
                                            <button
                                              onClick={() => copyToClipboardUtil(account.security_question_2, 'security question 2', showToast)}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 2"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {account.security_question_3 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 3</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 italic">What is your oldest sibling's middle name?</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.security_question_3}</p>
                                            <button
                                              onClick={() => copyToClipboardUtil(account.security_question_3, 'security question 3', showToast)}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 3"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  {isAdmin && isSystem && account.status !== 'active' && (
                                    <Button
                                      size="sm"
                                      disabled={!canActivate}
                                      onClick={() => requestActivate(account)}
                                      title={hasApprovedPayment
                                        ? 'Activate this account'
                                        : 'Activation requires an approved payment on this client\'s account'}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Activate
                                    </Button>
                                  )}
                                  {isAdmin && isSystem && account.status === 'active' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => requestDeactivate(account)}
                                      title="Deactivate this account"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsUserForm(account.account_type === 'custom')
                                      openAccountModal(account)
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                  {(isAdmin || (account.account_type === 'custom' && account.created_by === user?.id)) && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteAccount(account.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                              )
                            })}
                      </div>
                        ) : (
                          <Card>
                            <div className="py-8 text-center">
                              <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                              <p className="text-gray-600 dark:text-gray-400">No processing accounts available for this application.</p>
                            </div>
                          </Card>
                        )
                      })()}

      <Modal
        isOpen={showAccountModal}
        onClose={() => !savingAccount && setShowAccountModal(false)}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
        size="md"
      >
        <div className="space-y-4">
          {!editingAccount && (
            <Select
              label="Account Type"
              value={accountForm?.account_type ?? 'custom'}
              onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
            >
              <option value="custom">Custom (other site)</option>
              <option value="gmail">Gmail</option>
            </Select>
          )}

          {isEditingSystemAccount && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
              This is a system-managed account ({accountTypeLabel(editingAccount?.account_type)}).
              Credentials follow the standard format and shouldn't be edited unless the underlying
              site rejected them.
            </div>
          )}

          {(accountForm?.account_type === 'custom' || isEditingSystemAccount) && (
            <Input
              label="Display name"
              value={accountForm?.name ?? ''}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              placeholder="e.g. NY State Board Portal"
              disabled={isEditingSystemAccount}
            />
          )}

          {(accountForm?.account_type === 'custom' || isEditingSystemAccount) && (
            <Input
              label="Login URL (optional)"
              type="url"
              value={accountForm?.link ?? ''}
              onChange={(e) => setAccountForm({ ...accountForm, link: e.target.value })}
              placeholder="https://"
            />
          )}

          <Input
            label="Email"
            type="email"
            value={accountForm?.email ?? ''}
            onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
            required
          />

          <Input
            label="Password"
            value={accountForm?.password ?? ''}
            onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
            required
          />

          {editingAccount?.account_type === 'pearson_vue' && (
            <>
              <Input
                label="Security Q1 (first school name)"
                value={accountForm?.security_question_1 ?? ''}
                onChange={(e) => setAccountForm({ ...accountForm, security_question_1: e.target.value })}
              />
              <Input
                label="Security Q2 (childhood hero)"
                value={accountForm?.security_question_2 ?? ''}
                onChange={(e) => setAccountForm({ ...accountForm, security_question_2: e.target.value })}
              />
              <Input
                label="Security Q3 (sibling's middle name)"
                value={accountForm?.security_question_3 ?? ''}
                onChange={(e) => setAccountForm({ ...accountForm, security_question_3: e.target.value })}
              />
            </>
          )}

          <Select
            label="Status"
            value={accountForm?.status ?? 'active'}
            onChange={(e) => setAccountForm({ ...accountForm, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAccountModal(false)}
            disabled={savingAccount}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={saveAccount} disabled={savingAccount}>
            {savingAccount ? 'Saving…' : editingAccount ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!pendingChange}
        onClose={() => !busy && setPendingChange(null)}
        title={pendingChange?.action === 'activate' ? 'Activate account?' : 'Deactivate account?'}
        size="sm"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            pendingChange?.action === 'activate'
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {pendingChange?.action === 'activate' ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {pendingChange?.action === 'activate' ? (
                <>You are about to activate <strong>{pendingChange?.label}</strong> for this client. The client will be able to see and use the credentials immediately.</>
              ) : (
                <>You are about to deactivate <strong>{pendingChange?.label}</strong>. The client will no longer see this account until it is reactivated.</>
              )}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPendingChange(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={pendingChange?.action === 'deactivate' ? 'destructive' : 'default'}
            onClick={confirmStatusChange}
            disabled={busy}
          >
            {busy ? 'Working…' : pendingChange?.action === 'activate' ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
