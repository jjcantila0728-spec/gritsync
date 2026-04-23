import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Loading } from '@/components/ui/Loading'
import { CheckCircle, XCircle, Plus, Edit, Trash2, Copy, Mail, ExternalLink, Lock } from 'lucide-react'
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
}

export function ProcessingAccountsTab({
  processingAccounts,
  loadingAccounts,
  isAdmin,
  showAccountModal,
  setShowAccountModal,
  editingAccount,
  setEditingAccount,
  accountForm,
  setAccountForm,
  isUserForm,
  setIsUserForm,
  savingAccount,
  setSavingAccount,
  setProcessingAccounts,
  showToast,
  application,
  openAccountModal,
  handleDeleteAccount,
  user
}: ProcessingAccountsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Processing Accounts</h3>
                        <div className="flex gap-2">
                          {!isAdmin() && (
                            <Button onClick={() => {
                              setIsUserForm(true)
                              openAccountModal()
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </Button>
                          )}
                          {isAdmin() && (
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
                          // Hide inactive Pearson Vue accounts from client users
                          if (!isAdmin() && account.account_type === 'pearson_vue' && account.status === 'inactive') {
                            return false
                          }
                          return true
                        })
                        
                        return filteredAccounts.length > 0 ? (
                          <div className="grid md:grid-cols-2 gap-4">
                            {filteredAccounts.map((account) => (
                            <Card key={account.id}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                      account.account_type === 'gritsync'
                                        ? 'bg-blue-100 dark:bg-blue-900/30'
                                        : account.account_type === 'pearson_vue'
                                        ? 'bg-purple-100 dark:bg-purple-900/30'
                                        : 'bg-green-100 dark:bg-green-900/30'
                                    }`}>
                                      <Mail className={`h-5 w-5 ${
                                        account.account_type === 'gritsync'
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : account.account_type === 'pearson_vue'
                                          ? 'text-purple-600 dark:text-purple-400'
                                          : 'text-green-600 dark:text-green-400'
                                      }`} />
                                    </div>
                                    <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                        {account.account_type === 'gritsync' 
                                          ? 'GritSync Email' 
                                          : account.account_type === 'pearson_vue' 
                                          ? 'Pearson Vue Account'
                                          : account.name || 'Custom Account'}
                                      </h4>
                                      {(account.account_type === 'gmail' || account.account_type === 'pearson_vue') && (
                                        <a
                                          href={
                                            account.account_type === 'gritsync'
                                              ? 'http://localhost:5000/client/emails'
                                              : 'https://wsr.pearsonvue.com/testtaker/signin/SignInPage.htm?clientCode=NCLEXTESTING'
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                          title={
                                            account.account_type === 'gritsync'
                                              ? 'Open GritSync Email'
                                              : 'Open Pearson Vue'
                                          }
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      {account.account_type === 'custom' && account.link && (
                                        <a
                                          href={account.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                          title="Open Link"
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
                                  {(isAdmin() || (account.account_type === 'custom' && account.created_by === user?.id)) && (
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
                        ))}
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
    </div>
  )
}
