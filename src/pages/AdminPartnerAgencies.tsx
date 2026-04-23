import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { CardSkeleton } from '@/components/ui/Loading'
import { partnerAgenciesAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Building2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface PartnerAgency {
  id: string
  name: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  zipcode: string | null
  contact_person_name: string | null
  contact_person_email: string | null
  contact_person_phone: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export function AdminPartnerAgencies() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [agencies, setAgencies] = useState<PartnerAgency[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingAgency, setEditingAgency] = useState<PartnerAgency | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('USA')
  const [zipcode, setZipcode] = useState('')
  const [contactPersonName, setContactPersonName] = useState('')
  const [contactPersonEmail, setContactPersonEmail] = useState('')
  const [contactPersonPhone, setContactPersonPhone] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isAdmin()) {
      fetchAgencies()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  async function fetchAgencies() {
    try {
      setLoading(true)
      const data = await partnerAgenciesAPI.getAll()
      setAgencies(data as PartnerAgency[])
    } catch (error: any) {
      console.error('Error fetching partner agencies:', error)
      showToast(error?.message || 'Failed to load partner agencies', 'error')
      setAgencies([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAgencies()
  }

  const handleCreate = () => {
    setEditingAgency(null)
    resetForm()
    setShowModal(true)
  }

  const handleEdit = (agency: PartnerAgency) => {
    setEditingAgency(agency)
    setName(agency.name)
    setEmail(agency.email)
    setPhone(agency.phone || '')
    setWebsite(agency.website || '')
    setAddress(agency.address || '')
    setCity(agency.city || '')
    setState(agency.state || '')
    setCountry(agency.country || 'USA')
    setZipcode(agency.zipcode || '')
    setContactPersonName(agency.contact_person_name || '')
    setContactPersonEmail(agency.contact_person_email || '')
    setContactPersonPhone(agency.contact_person_phone || '')
    setIsActive(agency.is_active)
    setNotes(agency.notes || '')
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this partner agency?')) {
      return
    }

    try {
      await partnerAgenciesAPI.delete(id)
      showToast('Partner agency deleted successfully', 'success')
      await fetchAgencies()
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete partner agency', 'error')
    }
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setWebsite('')
    setAddress('')
    setCity('')
    setState('')
    setCountry('USA')
    setZipcode('')
    setContactPersonName('')
    setContactPersonEmail('')
    setContactPersonPhone('')
    setIsActive(true)
    setNotes('')
  }

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required', 'error')
      return
    }

    setSaving(true)
    try {
      const agencyData = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        country: country.trim() || 'USA',
        zipcode: zipcode.trim() || null,
        contact_person_name: contactPersonName.trim() || null,
        contact_person_email: contactPersonEmail.trim() || null,
        contact_person_phone: contactPersonPhone.trim() || null,
        is_active: isActive,
        notes: notes.trim() || null,
      }

      if (editingAgency) {
        await partnerAgenciesAPI.update(editingAgency.id, agencyData)
        showToast('Partner agency updated successfully', 'success')
      } else {
        await partnerAgenciesAPI.create(agencyData)
        showToast('Partner agency created successfully', 'success')
      }

      setShowModal(false)
      resetForm()
      await fetchAgencies()
    } catch (error: any) {
      showToast(error?.message || 'Failed to save partner agency', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingAgency(null)
    resetForm()
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Partner Agencies
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage partner agencies in the USA for career applications
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Agency
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agencies.length}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Agencies</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {agencies.filter(a => a.is_active).length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {agencies.filter(a => !a.is_active).length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Inactive</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Agencies List */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : agencies.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No partner agencies yet
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Agency
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {agencies.map((agency) => (
                <Card key={agency.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {agency.name}
                        </h3>
                        {agency.is_active ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <p>Email: {agency.email}</p>
                        {agency.phone && <p>Phone: {agency.phone}</p>}
                        {agency.contact_person_name && (
                          <p>Contact: {agency.contact_person_name}</p>
                        )}
                        {agency.contact_person_email && (
                          <p>Contact Email: {agency.contact_person_email}</p>
                        )}
                        {agency.city && agency.state && (
                          <p>Location: {agency.city}, {agency.state}</p>
                        )}
                        <p>Created: {formatDate(agency.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleEdit(agency)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDelete(agency.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <Modal
              isOpen={showModal}
              onClose={handleCloseModal}
              title={editingAgency ? 'Edit Partner Agency' : 'Add Partner Agency'}
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Agency Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter agency name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter agency email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Phone
                    </label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Website
                    </label>
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="Enter website URL"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Address
                    </label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      City
                    </label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      State
                    </label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Enter state"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Country
                    </label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter country"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Zipcode
                    </label>
                    <Input
                      value={zipcode}
                      onChange={(e) => setZipcode(e.target.value)}
                      placeholder="Enter zipcode"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                    Contact Person
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Contact Person Name
                      </label>
                      <Input
                        value={contactPersonName}
                        onChange={(e) => setContactPersonName(e.target.value)}
                        placeholder="Enter contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Contact Person Email
                      </label>
                      <Input
                        type="email"
                        value={contactPersonEmail}
                        onChange={(e) => setContactPersonEmail(e.target.value)}
                        placeholder="Enter contact person email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Contact Person Phone
                      </label>
                      <Input
                        value={contactPersonPhone}
                        onChange={(e) => setContactPersonPhone(e.target.value)}
                        placeholder="Enter contact person phone"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Notes
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active (applications can be forwarded to this agency)
                  </label>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleCloseModal}
                    className="flex-1"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : editingAgency ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  )
}



