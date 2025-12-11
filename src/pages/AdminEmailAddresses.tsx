/**
 * Admin Email Addresses Management
 * Manage all email addresses in the system
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Mail, Plus, Edit2, Trash2, Check, X, Shield } from 'lucide-react'
import { emailAddressesAPI, EmailAddress } from '@/lib/email-addresses-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'

export function AdminEmailAddresses() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [emailAddresses, setEmailAddresses] = useState<EmailAddress[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<EmailAddress | null>(null)
  
  const [formData, setFormData] = useState({
    email_address: '',
    display_name: '',
    address_type: 'admin' as EmailAddress['address_type'],
    department: '',
    can_send: true,
    can_receive: true,
  })

  useEffect(() => {
    if (isAdmin()) {
      loadAddresses()
    }
  }, [])

  const loadAddresses = async () => {
    setLoading(true)
    try {
      const addresses = await emailAddressesAPI.getAll()
      setEmailAddresses(addresses)
    } catch (error) {
      console.error('Error loading email addresses:', error)
      alert('Failed to load email addresses')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      await emailAddressesAPI.create({
        ...formData,
        is_system_address: formData.address_type === 'admin',
        is_active: true,
        is_verified: true,
      })
      
      alert('Email address added successfully!')
      setShowAddModal(false)
      setFormData({
        email_address: '',
        display_name: '',
        address_type: 'admin',
        department: '',
        can_send: true,
        can_receive: true,
      })
      loadAddresses()
    } catch (error) {
      console.error('Error adding email address:', error)
      alert('Failed to add email address')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email address?')) {
      return
    }

    try {
      await emailAddressesAPI.delete(id)
      alert('Email address deleted successfully!')
      loadAddresses()
    } catch (error) {
      console.error('Error deleting email address:', error)
      alert('Failed to delete email address')
    }
  }

  const handleToggleActive = async (address: EmailAddress) => {
    try {
      await emailAddressesAPI.toggleActive(address.id)
      loadAddresses()
    } catch (error) {
      console.error('Error toggling status:', error)
      alert('Failed to update status')
    }
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Access denied. Admin privileges required.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <Mail className="h-8 w-8 text-primary-600" />
                  Email Addresses
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage email addresses for admins and system
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Address
              </button>
            </div>
          </div>

          {/* Email Addresses List */}
          {loading ? (
            <div className="py-12">
              <Loading text="Loading email addresses..." />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Email Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Display Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Capabilities
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {emailAddresses.map((address) => (
                      <tr key={address.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {address.email_address}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {address.display_name || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            {
                              'bg-purple-100 text-purple-800': address.address_type === 'admin',
                              'bg-blue-100 text-blue-800': address.address_type === 'client',
                              'bg-green-100 text-green-800': address.address_type === 'support',
                              'bg-gray-100 text-gray-800': address.address_type === 'noreply',
                            }
                          )}>
                            {address.address_type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {address.department || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex gap-2">
                            {address.can_send && (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                Send
                              </span>
                            )}
                            {address.can_receive && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                Receive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleToggleActive(address)}
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              address.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            )}
                          >
                            {address.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right space-x-2">
                          {!address.is_system_address && (
                            <button
                              onClick={() => handleDelete(address.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add Address Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Add Email Address
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address *</label>
                    <input
                      type="email"
                      value={formData.email_address}
                      onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                      placeholder="address@gritsync.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Display Name *</label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="Display Name"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Type *</label>
                    <select
                      value={formData.address_type}
                      onChange={(e) => setFormData({ ...formData, address_type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    >
                      <option value="admin">Admin</option>
                      <option value="support">Support</option>
                      <option value="department">Department</option>
                      <option value="noreply">No Reply</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g., office, info, sales"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.can_send}
                        onChange={(e) => setFormData({ ...formData, can_send: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can Send</span>
                    </label>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.can_receive}
                        onChange={(e) => setFormData({ ...formData, can_receive: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can Receive</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Add Address
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

