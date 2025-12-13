import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { servicesAPI, serviceRequiredDocumentsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Plus, Save, Edit, Trash2, X } from 'lucide-react'

interface Service {
  id: string
  service_name: string
  state: string
  payment_type: 'full' | 'staggered'
  line_items: Array<{ description: string; amount: number; step?: 1 | 2; taxable?: boolean }>
  total_full: number
  total_step1?: number
  total_step2?: number
  tax_amount?: number
  tax_step1?: number
  tax_step2?: number
}

interface DocumentRequirementEntry {
  id: string
  service_type: string
  document_type: string
  name: string
  accepted_formats: string[]
  required: boolean
  sort_order: number
}

interface DocumentRequirementForm {
  id?: string
  service_type: string
  document_type: string
  name: string
  accepted_formats: string
  required: boolean
  sort_order: number
}

const SERVICE_TYPE_OPTIONS = [
  { value: 'NCLEX', label: 'NCLEX Processing' },
  { value: 'EAD', label: 'EAD (I-765)' },
]

const DEFAULT_DOC_FORM: DocumentRequirementForm = {
  service_type: 'NCLEX',
  document_type: '',
  name: '',
  accepted_formats: '.pdf, .jpg, .jpeg, .png',
  required: true,
  sort_order: 0,
}

export function ServiceSettings() {
  const { showToast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceDeleteConfirm, setServiceDeleteConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const TAX_RATE = 0.12

  const calculateTaxForService = (service: Service): Service => {
    // Ensure taxable field exists on all items
    const itemsWithTaxable = service.line_items.map(item => ({
      ...item,
      taxable: item.taxable ?? false
    }))
    
    const step1Items = itemsWithTaxable.filter(item => !item.step || item.step === 1)
    const step2Items = itemsWithTaxable.filter(item => item.step === 2)
    
    const taxStep1 = step1Items.reduce((sum, item) => {
      const tax = item.taxable ? (item.amount || 0) * TAX_RATE : 0
      return sum + tax
    }, 0)
    const taxStep2 = step2Items.reduce((sum, item) => {
      const tax = item.taxable ? (item.amount || 0) * TAX_RATE : 0
      return sum + tax
    }, 0)
    
    // Recalculate totals including tax
    const subtotalStep1 = step1Items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const subtotalStep2 = step2Items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const totalStep1 = subtotalStep1 + taxStep1
    const totalStep2 = subtotalStep2 + taxStep2
    const totalFull = totalStep1 + totalStep2
    
    return {
      ...service,
      line_items: itemsWithTaxable,
      tax_amount: taxStep1 + taxStep2,
      tax_step1: service.payment_type === 'staggered' ? taxStep1 : undefined,
      tax_step2: service.payment_type === 'staggered' ? taxStep2 : undefined,
      total_step1: service.payment_type === 'staggered' ? totalStep1 : undefined,
      total_step2: service.payment_type === 'staggered' ? totalStep2 : undefined,
      total_full: totalFull
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  async function fetchServices() {
    try {
      setLoading(true)
      const data = await servicesAPI.getAll()
      // Calculate taxes for services if not already calculated
      const typedServices = (data || []) as any[]
      const servicesWithTax = typedServices.map(calculateTaxForService)
      setServices(servicesWithTax)
    } catch (error) {
      console.error('Error fetching services:', error)
      showToast('Failed to load services', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleServiceSave = async () => {
    if (!editingService) return

    try {
      await servicesAPI.createOrUpdate(editingService)
      showToast('Service saved successfully', 'success')
      setEditingService(null)
      fetchServices()
    } catch (error: any) {
      showToast(error.message || 'Failed to save service', 'error')
    }
  }

  const handleServiceDelete = async (id: string) => {
    try {
      await servicesAPI.delete(id)
      showToast('Service deleted successfully', 'success')
      setServiceDeleteConfirm(null)
      fetchServices()
    } catch (error: any) {
      showToast(error.message || 'Failed to delete service', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Loading services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Service Configuration
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage service pricing and line items. Changes will automatically reflect in new quotes.
        </p>
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Staggered Payment:</strong> Step 1 items are paid immediately, Step 2 items are paid later. 
            For full payment, both steps are paid upfront.
          </p>
        </div>
      </div>

      {editingService ? (
        <EditServiceForm
          service={editingService}
          setService={setEditingService}
          onSave={handleServiceSave}
          onCancel={() => setEditingService(null)}
        />
      ) : (
        <div className="space-y-6">
          {services.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No services configured. Add a service to get started.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      // Create default NCLEX services (both staggered and full payment)
                      const staggeredService: Service = {
                        id: 'svc_nclex_ny_staggered',
                        service_name: 'NCLEX Processing',
                        state: 'New York',
                        payment_type: 'staggered',
                        line_items: [
                          { description: 'NCLEX NY BON Application Fee', amount: 143, step: 1 },
                          { description: 'NCLEX NY Mandatory Courses', amount: 54.99, step: 1 },
                          { description: 'NCLEX NY Bond Fee', amount: 70, step: 1 },
                          { description: 'NCLEX PV Application Fee', amount: 200, step: 2 },
                          { description: 'NCLEX PV NCSBN Exam Fee', amount: 150, step: 2 },
                          { description: 'NCLEX GritSync Service Fee', amount: 150, step: 2 },
                          { description: 'NCLEX NY Quick Results', amount: 8, step: 2 },
                        ],
                        total_full: 775.99,
                        total_step1: 267.99,
                        total_step2: 508.00
                      }
                      
                      const fullService: Service = {
                        id: 'svc_nclex_ny_full',
                        service_name: 'NCLEX Processing',
                        state: 'New York',
                        payment_type: 'full',
                        line_items: [
                          { description: 'NCLEX NY BON Application Fee', amount: 143 },
                          { description: 'NCLEX NY Mandatory Courses', amount: 54.99 },
                          { description: 'NCLEX NY Bond Fee', amount: 70 },
                          { description: 'NCLEX PV Application Fee', amount: 200 },
                          { description: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
                          { description: 'NCLEX GritSync Service Fee', amount: 150 },
                          { description: 'NCLEX NY Quick Results', amount: 8 },
                        ],
                        total_full: 775.99
                      }
                      
                      await servicesAPI.createOrUpdate(staggeredService)
                      await servicesAPI.createOrUpdate(fullService)
                      showToast('Default services (Staggered & Full Payment) created successfully', 'success')
                      fetchServices()
                    } catch (error: any) {
                      showToast(error.message || 'Failed to create default services', 'error')
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Default NCLEX Services
                </Button>
              </div>
            </Card>
          ) : (
            [...services]
              .sort((a, b) => {
                // Sort by service name, then state, then payment type (staggered first, then full)
                if (a.service_name !== b.service_name) {
                  return a.service_name.localeCompare(b.service_name)
                }
                if (a.state !== b.state) {
                  return a.state.localeCompare(b.state)
                }
                // Put staggered before full
                if (a.payment_type === 'staggered' && b.payment_type === 'full') return -1
                if (a.payment_type === 'full' && b.payment_type === 'staggered') return 1
                return 0
              })
              .map((service) => {
                const step1Items = service.line_items.filter(item => !item.step || item.step === 1)
                const step2Items = service.line_items.filter(item => item.step === 2)
              
              return (
                <Card key={service.id} className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {service.service_name} - {service.state}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          service.payment_type === 'staggered'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {service.payment_type === 'staggered' ? 'Staggered Payment' : 'Full Payment'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Ensure taxable field is initialized for all items
                          const serviceWithTaxable = {
                            ...service,
                            line_items: service.line_items.map(item => ({
                              ...item,
                              taxable: item.taxable ?? false
                            }))
                          }
                          // Recalculate taxes when opening for edit
                          const step1Items = serviceWithTaxable.line_items.filter(item => !item.step || item.step === 1)
                          const step2Items = serviceWithTaxable.line_items.filter(item => item.step === 2)
                          const TAX_RATE = 0.12
                          const taxStep1 = step1Items.reduce((sum, item) => {
                            return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
                          }, 0)
                          const taxStep2 = step2Items.reduce((sum, item) => {
                            return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
                          }, 0)
                          const subtotalStep1 = step1Items.reduce((sum, item) => sum + (item.amount || 0), 0)
                          const subtotalStep2 = step2Items.reduce((sum, item) => sum + (item.amount || 0), 0)
                          const totalStep1 = subtotalStep1 + taxStep1
                          const totalStep2 = subtotalStep2 + taxStep2
                          
                          setEditingService({
                            ...serviceWithTaxable,
                            tax_amount: taxStep1 + taxStep2,
                            tax_step1: service.payment_type === 'staggered' ? taxStep1 : undefined,
                            tax_step2: service.payment_type === 'staggered' ? taxStep2 : undefined,
                            total_step1: service.payment_type === 'staggered' ? totalStep1 : undefined,
                            total_step2: service.payment_type === 'staggered' ? totalStep2 : undefined,
                            total_full: totalStep1 + totalStep2
                          })
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setServiceDeleteConfirm(service.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {service.payment_type === 'full' ? (
                      <>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="text-gray-900 dark:text-gray-100">
                            {formatCurrency(service.total_full - (service.tax_amount || 0))}
                          </span>
                        </div>
                        {service.tax_amount && service.tax_amount > 0 && (
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                            <span className="text-gray-900 dark:text-gray-100">
                              {formatCurrency(service.tax_amount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">Total (Full Payment):</span>
                          <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                            {formatCurrency(service.total_full)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {service.total_step1 && service.total_step2 && (
                          <>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                              <div>
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Step 1 (Pay Now)</div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                                  <span className="text-gray-900 dark:text-gray-100">
                                    {formatCurrency(service.total_step1 - (service.tax_step1 || 0))}
                                  </span>
                                </div>
                                {service.tax_step1 && service.tax_step1 > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                      {formatCurrency(service.tax_step1)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(service.total_step1)}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Step 2 (Pay Later)</div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                                  <span className="text-gray-900 dark:text-gray-100">
                                    {formatCurrency(service.total_step2 - (service.tax_step2 || 0))}
                                  </span>
                                </div>
                                {service.tax_step2 && service.tax_step2 > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                      {formatCurrency(service.tax_step2)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(service.total_step2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-gray-600">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">Grand Total:</span>
                              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                {formatCurrency(service.total_full)}
                              </span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Line Items */}
                  {service.payment_type === 'staggered' ? (
                    <div className="space-y-3">
                      {step1Items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-semibold">
                              STEP 1 - Pay Now
                            </span>
                          </div>
                          <div className="space-y-1 ml-4">
                            {step1Items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                                <span>{item.description}</span>
                                <span className="font-medium">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {step2Items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">
                              STEP 2 - Pay Later
                            </span>
                          </div>
                          <div className="space-y-1 ml-4">
                            {step2Items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                                <span>
                                  {item.description}
                                  {item.taxable && (
                                    <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">(Taxable)</span>
                                  )}
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(item.amount)}
                                  {item.taxable && (
                                    <span className="ml-1 text-xs text-gray-500">
                                      + {formatCurrency(item.amount * 0.12)} tax
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {service.line_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>
                            {item.description}
                            {item.taxable && (
                              <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">(Taxable)</span>
                            )}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(item.amount)}
                            {item.taxable && (
                              <span className="ml-1 text-xs text-gray-500">
                                + {formatCurrency(item.amount * 0.12)} tax
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })
          )}
          <Button
            onClick={() => {
              setEditingService({
                id: '',
                service_name: 'NCLEX Processing',
                state: 'New York',
                payment_type: 'staggered',
                line_items: [{ description: '', amount: 0, step: 1 }],
                total_full: 0,
                total_step1: 0,
                total_step2: 0
              })
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Service
          </Button>
        </div>
      )}

      <div className="mt-10">
        <DocumentRequirementsManager />
      </div>

      {/* Service Delete Confirmation Modal */}
      {serviceDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Confirm Delete Service
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this service configuration? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setServiceDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleServiceDelete(serviceDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Current required documents for both services
const CURRENT_REQUIRED_DOCUMENTS: Omit<DocumentRequirementEntry, 'id'>[] = [
  // NCLEX Documents
  {
    service_type: 'NCLEX',
    document_type: 'picture',
    name: '2x2 Picture',
    accepted_formats: ['image/*'],
    required: true,
    sort_order: 0,
  },
  {
    service_type: 'NCLEX',
    document_type: 'diploma',
    name: 'Nursing Diploma',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 1,
  },
  {
    service_type: 'NCLEX',
    document_type: 'passport',
    name: 'Passport',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 2,
  },
  // EAD Documents
  {
    service_type: 'EAD',
    document_type: 'ead_photos',
    name: 'Two passport-sized photographs (2x2 inches) meeting USCIS requirements (attached in a small envelope and labeled with your name)',
    accepted_formats: ['image/*'],
    required: true,
    sort_order: 0,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_passport',
    name: 'Clear Copy of your passport biographical page',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 1,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_h4_visa',
    name: 'Copy of your H-4 visa stamp',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 2,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_i94',
    name: 'Copy of your most recent I-94 Arrival/Departure Record',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 3,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_marriage_certificate',
    name: 'Copy of your marriage certificate to establish your relationship with the H-1B principal beneficiary',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 4,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_spouse_i797',
    name: "Copy of your spouse's H-1B approval notice (Form I-797)",
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 5,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_spouse_i140',
    name: "Copy of your spouse's approved Form I-140, Immigrant Petition for Alien Worker",
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 6,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_employer_letter',
    name: "Copy of your spouse's employer verification letter",
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 7,
  },
  {
    service_type: 'EAD',
    document_type: 'ead_paystub',
    name: 'Recent paystub',
    accepted_formats: ['.pdf', '.jpg', '.jpeg', '.png'],
    required: true,
    sort_order: 8,
  },
]

function DocumentRequirementsManager() {
  const { showToast } = useToast()
  const [docRequirements, setDocRequirements] = useState<DocumentRequirementEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<DocumentRequirementForm>(DEFAULT_DOC_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const groupedRequirements = useMemo(() => {
    return docRequirements.reduce<Record<string, DocumentRequirementEntry[]>>((acc, requirement) => {
      const serviceList = acc[requirement.service_type] || []
      serviceList.push(requirement)
      acc[requirement.service_type] = serviceList
      return acc
    }, {})
  }, [docRequirements])

  const loadDocumentRequirements = async () => {
    setLoading(true)
    try {
      const data = await serviceRequiredDocumentsAPI.getAll()
      setDocRequirements(data || [])
    } catch (error: any) {
      showToast(error.message || 'Failed to load document requirements', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocumentRequirements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setForm(DEFAULT_DOC_FORM)
    setEditingId(null)
  }

  const handleEdit = (requirement: DocumentRequirementEntry) => {
    setEditingId(requirement.id)
    setForm({
      id: requirement.id,
      service_type: requirement.service_type,
      document_type: requirement.document_type,
      name: requirement.name,
      accepted_formats: requirement.accepted_formats.join(', '),
      required: requirement.required,
      sort_order: requirement.sort_order ?? 0,
    })
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.document_type.trim()) {
      showToast('Document name and type are required', 'error')
      return
    }

    const payload = {
      service_type: form.service_type,
      document_type: form.document_type.trim(),
      name: form.name.trim(),
      accepted_formats: form.accepted_formats
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      required: form.required,
      sort_order: Number(form.sort_order) || 0,
    }

    setSaving(true)
    try {
      if (editingId) {
        await serviceRequiredDocumentsAPI.update(editingId, payload)
        showToast('Document requirement updated', 'success')
      } else {
        await serviceRequiredDocumentsAPI.create(payload)
        showToast('Document requirement created', 'success')
      }
      resetForm()
      loadDocumentRequirements()
      
      // Dispatch event to notify other pages (like Documents page) to refresh
      window.dispatchEvent(new CustomEvent('documentRequirementsUpdated'))
    } catch (error: any) {
      showToast(error.message || 'Failed to save document requirement', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document requirement?')) {
      return
    }
    setDeletingId(id)
    try {
      await serviceRequiredDocumentsAPI.delete(id)
      showToast('Document requirement deleted', 'success')
      loadDocumentRequirements()
      
      // Dispatch event to notify other pages (like Documents page) to refresh
      window.dispatchEvent(new CustomEvent('documentRequirementsUpdated'))
    } catch (error: any) {
      showToast(error.message || 'Failed to delete document requirement', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSyncCurrentRequirements = async () => {
    if (!confirm('This will update all document requirements to match the current required documents for both services. Existing requirements will be updated if they match by service_type and document_type, or created if they don\'t exist. Continue?')) {
      return
    }
    
    setSyncing(true)
    try {
      // Get existing requirements to check what needs updating vs creating
      const existing = await serviceRequiredDocumentsAPI.getAll()
      const existingMap = new Map<string, DocumentRequirementEntry>()
      existing.forEach((doc: DocumentRequirementEntry) => {
        const key = `${doc.service_type}:${doc.document_type}`
        existingMap.set(key, doc)
      })

      // Process each current required document
      let created = 0
      let updated = 0
      
      for (const doc of CURRENT_REQUIRED_DOCUMENTS) {
        const key = `${doc.service_type}:${doc.document_type}`
        const existingDoc = existingMap.get(key)
        
        if (existingDoc) {
          // Update existing document
          await serviceRequiredDocumentsAPI.update(existingDoc.id, {
            name: doc.name,
            accepted_formats: doc.accepted_formats,
            required: doc.required,
            sort_order: doc.sort_order,
          })
          updated++
        } else {
          // Create new document
          await serviceRequiredDocumentsAPI.create({
            service_type: doc.service_type,
            document_type: doc.document_type,
            name: doc.name,
            accepted_formats: doc.accepted_formats,
            required: doc.required,
            sort_order: doc.sort_order,
          })
          created++
        }
      }

      showToast(
        `Document requirements synced successfully. ${created} created, ${updated} updated.`,
        'success'
      )
      loadDocumentRequirements()
      
      // Dispatch event to notify other pages (like Documents page) to refresh
      window.dispatchEvent(new CustomEvent('documentRequirementsUpdated'))
    } catch (error: any) {
      showToast(error.message || 'Failed to sync document requirements', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Document Requirements
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Define required documents per service. Changes are reflected in the client document center.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCurrentRequirements}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Current Requirements'}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                Cancel Edit
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Service Type"
            options={SERVICE_TYPE_OPTIONS}
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
          />
          <Input
            label="Document Type (slug)"
            value={form.document_type}
            onChange={(e) => setForm({ ...form, document_type: e.target.value })}
            placeholder="e.g., passport, ead_i94"
          />
          <Input
            label="Display Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="md:col-span-2"
          />
          <Input
            label="Accepted Formats"
            value={form.accepted_formats}
            onChange={(e) => setForm({ ...form, accepted_formats: e.target.value })}
            placeholder=".pdf, .jpg, .jpeg"
          />
          <Input
            label="Sort Order"
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 mt-2 md:mt-0">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Required</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={resetForm} disabled={saving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Document Requirement'}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Loading document requirements...
        </Card>
      ) : (
        <div className="space-y-4">
          {SERVICE_TYPE_OPTIONS.map((service) => {
            const entries = groupedRequirements[service.value] || []
            return (
              <Card key={service.value} className="p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {service.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Service type identifier: {service.value}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm({ ...DEFAULT_DOC_FORM, service_type: service.value })
                      setEditingId(null)
                    }}
                  >
                    Add Requirement
                  </Button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No requirements defined for this service yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {entries.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col gap-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Type: {doc.document_type}
                            </p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                            doc.required
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}>
                            {doc.required ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Accepted: {doc.accepted_formats.join(', ')}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>Sort order: {doc.sort_order}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(doc)}
                              className="border-gray-300 dark:border-gray-600"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {deletingId === doc.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditServiceForm({
  service,
  setService,
  onSave,
  onCancel,
}: {
  service: Service
  setService: (service: Service) => void
  onSave: () => void
  onCancel: () => void
}) {
  const TAX_RATE = 0.12 // 12% tax

  const calculateTotals = (items: typeof service.line_items) => {
    const step1Items = items.filter(item => !item.step || item.step === 1)
    const step2Items = items.filter(item => item.step === 2)
    
    // Calculate subtotals (before tax)
    const subtotalStep1 = step1Items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const subtotalStep2 = step2Items.reduce((sum, item) => sum + (item.amount || 0), 0)
    
    // Calculate tax for taxable items
    const taxStep1 = step1Items.reduce((sum, item) => {
      return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
    }, 0)
    const taxStep2 = step2Items.reduce((sum, item) => {
      return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
    }, 0)
    
    // Calculate totals (subtotal + tax)
    const totalStep1 = subtotalStep1 + taxStep1
    const totalStep2 = subtotalStep2 + taxStep2
    const totalFull = totalStep1 + totalStep2
    const taxAmount = taxStep1 + taxStep2
    
    return {
      totalStep1,
      totalStep2,
      totalFull,
      taxStep1,
      taxStep2,
      taxAmount
    }
  }

  const updateLineItem = (index: number, field: 'description' | 'amount' | 'step' | 'taxable', value: string | number | boolean) => {
    const newItems = [...service.line_items]
    const updatedItem = {
      ...newItems[index],
      [field]: field === 'amount' ? Number(value) : (field === 'step' ? Number(value) : (field === 'taxable' ? Boolean(value) : value))
    }
    newItems[index] = updatedItem
    
    // Recalculate totals with tax
    const totals = calculateTotals(newItems)
    
    setService({ 
      ...service, 
      line_items: newItems, 
      total_full: totals.totalFull,
      total_step1: service.payment_type === 'staggered' ? totals.totalStep1 : undefined,
      total_step2: service.payment_type === 'staggered' ? totals.totalStep2 : undefined,
      tax_amount: totals.taxAmount,
      tax_step1: service.payment_type === 'staggered' ? totals.taxStep1 : undefined,
      tax_step2: service.payment_type === 'staggered' ? totals.taxStep2 : undefined
    })
  }

  const addLineItem = () => {
    const defaultStep = service.payment_type === 'staggered' ? 1 : undefined
    setService({
      ...service,
      line_items: [...service.line_items, { description: '', amount: 0, step: defaultStep }]
    })
  }

  const removeLineItem = (index: number) => {
    const newItems = service.line_items.filter((_, i) => i !== index)
    
    // Recalculate totals with tax
    const totals = calculateTotals(newItems)
    
    setService({ 
      ...service, 
      line_items: newItems, 
      total_full: totals.totalFull,
      total_step1: service.payment_type === 'staggered' ? totals.totalStep1 : undefined,
      total_step2: service.payment_type === 'staggered' ? totals.totalStep2 : undefined,
      tax_amount: totals.taxAmount,
      tax_step1: service.payment_type === 'staggered' ? totals.taxStep1 : undefined,
      tax_step2: service.payment_type === 'staggered' ? totals.taxStep2 : undefined
    })
  }

  const handlePaymentTypeChange = (paymentType: 'full' | 'staggered') => {
    // When switching to full payment, remove step info from items
    // When switching to staggered, assign step 1 to items without step
    const updatedItems = paymentType === 'full'
      ? service.line_items.map(item => {
          const { step, ...rest } = item
          return rest
        })
      : service.line_items.map(item => ({
          ...item,
          step: item.step || 1
        }))
    
    // Recalculate totals with tax
    const totals = calculateTotals(updatedItems)
    
    setService({
      ...service,
      payment_type: paymentType,
      line_items: updatedItems,
      total_full: totals.totalFull,
      total_step1: paymentType === 'staggered' ? totals.totalStep1 : undefined,
      total_step2: paymentType === 'staggered' ? totals.totalStep2 : undefined,
      tax_amount: totals.taxAmount,
      tax_step1: paymentType === 'staggered' ? totals.taxStep1 : undefined,
      tax_step2: paymentType === 'staggered' ? totals.taxStep2 : undefined
    })
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Service Name"
            value={service.service_name}
            onChange={(e) => setService({ ...service, service_name: e.target.value })}
          />
          <Input
            label="State"
            value={service.state}
            onChange={(e) => setService({ ...service, state: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Payment Type
            </label>
            <select
              value={service.payment_type}
              onChange={(e) => handlePaymentTypeChange(e.target.value as 'full' | 'staggered')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="full">Full Payment</option>
              <option value="staggered">Staggered Payment</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {service.payment_type === 'full'
                ? 'All items are paid upfront in a single payment.'
                : 'Items can be assigned to Step 1 (pay now) or Step 2 (pay later).'}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Line Items
            </label>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {service.line_items.map((item, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={item.amount}
                  onChange={(e) => updateLineItem(index, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                {service.payment_type === 'staggered' && (
                  <select
                    value={item.step || 1}
                    onChange={(e) => updateLineItem(index, 'step', Number(e.target.value))}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value={1}>Step 1</option>
                    <option value={2}>Step 2</option>
                  </select>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.taxable || false}
                    onChange={(e) => updateLineItem(index, 'taxable', e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Taxable (12%)</span>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeLineItem(index)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
            {service.payment_type === 'full' ? (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatCurrency(service.total_full - (service.tax_amount || 0))}
                  </span>
                </div>
                {service.tax_amount && service.tax_amount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {formatCurrency(service.tax_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Total (Full Payment):</span>
                  <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {formatCurrency(service.total_full)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {service.total_step1 !== undefined && service.total_step2 !== undefined && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Step 1 (Pay Now)</div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="text-gray-900 dark:text-gray-100">
                            {formatCurrency(service.total_step1 - (service.tax_step1 || 0))}
                          </span>
                        </div>
                        {(service.tax_step1 && service.tax_step1 > 0) || service.line_items.some(item => (item.step === 1 || !item.step) && item.taxable) ? (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                            <span className="text-gray-900 dark:text-gray-100">
                              {formatCurrency(service.tax_step1 || 0)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(service.total_step1)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Step 2 (Pay Later)</div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="text-gray-900 dark:text-gray-100">
                            {formatCurrency(service.total_step2 - (service.tax_step2 || 0))}
                          </span>
                        </div>
                        {(service.tax_step2 && service.tax_step2 > 0) || service.line_items.some(item => item.step === 2 && item.taxable) ? (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Tax (12%):</span>
                            <span className="text-gray-900 dark:text-gray-100">
                              {formatCurrency(service.tax_step2 || 0)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(service.total_step2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-gray-600">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Grand Total:</span>
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {formatCurrency(service.total_full)}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Service
          </Button>
        </div>
      </div>
    </Card>
  )
}

