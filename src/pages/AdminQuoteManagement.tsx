import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/Loading'
import { quotationsAPI, servicesAPI } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import { 
  DollarSign, 
  Search, 
  Plus,
  Save,
  Copy,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Eye,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { subscribeToAllQuotations, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  payLater?: boolean
  taxable?: boolean
}

interface Quotation {
  id: string
  amount: number
  description: string
  created_at: string
  user_id: string | null // NULL for public/guest quotations
  service?: string
  state?: string
  payment_type?: 'full' | 'staggered'
  line_items?: QuoteLineItem[]
  client_first_name?: string
  client_last_name?: string
  client_email?: string
  client_mobile?: string
  validity_date?: string
}

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

export function AdminQuoteManagement() {
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showServices, setShowServices] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceDeleteConfirm, setServiceDeleteConfirm] = useState<string | null>(null)
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Get opened quotes from localStorage
  const getOpenedQuotes = (): Set<string> => {
    try {
      const stored = localStorage.getItem('openedQuotes')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }

  // Save opened quotes to localStorage
  const markQuoteAsOpened = (quoteId: string) => {
    const opened = getOpenedQuotes()
    opened.add(quoteId)
    localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
    // Trigger a re-render by updating a state (we'll use a custom event or force update)
    window.dispatchEvent(new CustomEvent('quotesUpdated'))
  }

  // Count unopened quotes
  const _unopenedQuotesCount = useMemo(() => {
    const opened = getOpenedQuotes()
    return quotations.filter(q => !opened.has(q.id)).length
  }, [quotations])

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard')
      return
    }
    fetchQuotations()
    fetchServices()

    // Listen for quotes updates to refresh unopened count
    const handleQuotesUpdate = () => {
      // Force re-render by updating a dummy state or just trigger a re-render
      setQuotations(prev => [...prev])
    }
    window.addEventListener('quotesUpdated', handleQuotesUpdate)
    return () => window.removeEventListener('quotesUpdated', handleQuotesUpdate)
  }, [isAdmin, navigate])

  // Set up real-time subscription for quotations
  useEffect(() => {
    if (!isAdmin()) return

    // Subscribe to all quotations
    const quotesChannel = subscribeToAllQuotations((payload) => {
      handleQuotationRealtimeUpdate(payload)
    })
    channelRef.current = quotesChannel

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isAdmin])

  // Handle real-time quotation updates
  function handleQuotationRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New quotation added - add to list
        setQuotations((prev) => [newRecord, ...prev])
        showToast('New quotation received', 'info')
        // Trigger counter update in sidebar
        setTimeout(() => window.dispatchEvent(new CustomEvent('quotesUpdated')), 100)
      } else if (eventType === 'UPDATE' && newRecord) {
        // Quotation updated - update in place
        setQuotations((prev) => {
          const index = prev.findIndex((q) => q.id === newRecord.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = { ...updated[index], ...newRecord }
            return updated
          } else {
            // Quotation not in list, might be new - add it
            return [newRecord, ...prev]
          }
        })

        // Show notification for status changes
        if (oldRecord && oldRecord.status !== newRecord.status) {
          const statusMessages: Record<string, string> = {
            'paid': 'Quotation has been paid! ✅',
            'pending': 'Quotation is now pending',
            'approved': 'Quotation has been approved',
            'rejected': 'Quotation has been rejected'
          }
          
          const message = statusMessages[newRecord.status] || `Quotation status changed to ${newRecord.status}`
          showToast(message, newRecord.status === 'paid' ? 'success' : 'info')
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        // Quotation deleted - remove from list
        setQuotations((prev) => prev.filter((q) => q.id !== oldRecord.id))
        showToast('Quotation deleted', 'info')
      }
    } catch (error) {
      console.error('Error handling real-time quotation update:', error)
      // Fallback to full refresh on error
      fetchQuotations()
    }
  }

  async function fetchQuotations() {
    try {
      const data = await quotationsAPI.getAll()
      setQuotations((data || []) as any[])
    } catch (error) {
      console.error('Error fetching quotations:', error)
      showToast('Failed to load quotations', 'error')
    } finally {
      setLoading(false)
    }
  }

  const calculateTaxForService = (service: Service): Service => {
    const TAX_RATE = 0.12
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

  async function fetchServices() {
    try {
      const data = await servicesAPI.getAll()
      // Calculate taxes for services if not already calculated
      const typedServices = (data || []) as any[]
      const servicesWithTax = typedServices.map(calculateTaxForService)
      setServices(servicesWithTax)
      if (!data || data.length === 0) {
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      showToast('Failed to load services', 'error')
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

  const handleDelete = async (id: string) => {
    // Store the quote to restore if deletion fails
    const quoteToDelete = quotations.find(q => q.id === id)
    
    // Optimistically remove from state immediately
    setQuotations(prev => prev.filter(q => q.id !== id))
    setDeleteConfirm(null)
    
    try {
      await quotationsAPI.delete(id)
      showToast('Quotation deleted successfully', 'success')
      // Refresh to ensure consistency (real-time updates might have already handled it)
      fetchQuotations()
    } catch (error: any) {
      // Restore the quote if deletion failed
      if (quoteToDelete) {
        setQuotations(prev => {
          // Check if it's not already in the list (might have been re-added by real-time)
          if (!prev.find(q => q.id === id)) {
            return [...prev, quoteToDelete].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          }
          return prev
        })
      }
      showToast(error.message || 'Failed to delete quotation', 'error')
    }
  }

  const handleUpdate = async () => {
    if (!editingQuote) return

    try {
      await quotationsAPI.update(editingQuote.id, {
        amount: editingQuote.amount,
        description: editingQuote.description,
        service: editingQuote.service,
        state: editingQuote.state,
        payment_type: editingQuote.payment_type,
        line_items: editingQuote.line_items as unknown as any,
        client_first_name: editingQuote.client_first_name,
        client_last_name: editingQuote.client_last_name,
        client_email: editingQuote.client_email,
        client_mobile: editingQuote.client_mobile,
        validity_date: editingQuote.validity_date,
      })
      showToast('Quotation updated successfully', 'success')
      setEditingQuote(null)
      fetchQuotations()
    } catch (error: any) {
      showToast(error.message || 'Failed to update quotation', 'error')
    }
  }

  const filteredQuotations = quotations.filter(quote => {
    const matchesSearch = 
      quote.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${quote.client_first_name} ${quote.client_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          {user && <Sidebar />}
          <main className="flex-1 p-4 md:p-8">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
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
        {user && <Sidebar />}
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Quote Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage all quotations, edit details, and configure quote templates
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowServices(!showServices)}
              >
                {showServices ? 'Hide' : 'Manage'} Services
              </Button>
            </div>
          </div>

          {/* Services Management Section */}
          {showServices && (
            <Card className="mb-6">
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
                    <div className="text-center py-8">
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
            </Card>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by ID, description, email, or client name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Quotes List */}
          <div className="space-y-4">
            {filteredQuotations.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No quotations found
                  </p>
                </div>
              </Card>
            ) : (
              filteredQuotations.map((quote, index) => {
                const isExpanded = expandedQuoteId === quote.id
                const isOpened = getOpenedQuotes().has(quote.id)
                
                return (
                  <Card key={quote.id}>
                    {editingQuote?.id === quote.id ? (
                      <EditQuoteForm
                        quote={editingQuote}
                        setQuote={setEditingQuote}
                        onSave={handleUpdate}
                        onCancel={() => setEditingQuote(null)}
                      />
                    ) : (
                      <>
                        {/* Single line summary - always visible */}
                        <div 
                          className="flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 -m-2 rounded transition-colors"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedQuoteId(null)
                            } else {
                              setExpandedQuoteId(quote.id)
                              markQuoteAsOpened(quote.id)
                            }
                          }}
                        >
                          <div className="flex-1 flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0 w-8 text-center text-gray-500 dark:text-gray-500 text-sm font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 grid grid-cols-5 gap-4 text-sm">
                              <div className="min-w-0">
                                <div className="text-gray-500 dark:text-gray-500 text-xs">Client</div>
                                <div className="text-gray-600 dark:text-gray-400 truncate">
                                  {quote.client_first_name && quote.client_last_name ? `${quote.client_first_name} ${quote.client_last_name}` : 'N/A'}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-gray-500 dark:text-gray-500 text-xs">Service</div>
                                <div className="text-gray-600 dark:text-gray-400 truncate">
                                  {quote.service && quote.state ? `${quote.service} - ${quote.state}` : 'N/A'}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-gray-500 dark:text-gray-500 text-xs">Payment</div>
                                <div className="text-gray-600 dark:text-gray-400 truncate">
                                  {quote.payment_type ? (quote.payment_type === 'full' ? 'Full' : 'Staggered') : 'N/A'}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-gray-500 dark:text-gray-500 text-xs">Amount</div>
                                <div className="text-gray-600 dark:text-gray-400 truncate">
                                  {formatCurrency(quote.amount)}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-gray-500 dark:text-gray-500 text-xs">Date</div>
                                <div className="text-gray-600 dark:text-gray-400 truncate">
                                  {formatDate(quote.created_at)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!isOpened && (
                                <span className="h-2 w-2 bg-blue-500 rounded-full" title="New quote" />
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(quote.id)
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details - shown when expanded */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 border rounded-lg p-4">
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              <p><strong>ID:</strong> {quote.id}</p>
                              {quote.service && quote.state && (
                                <p><strong>Service:</strong> {quote.service} - {quote.state}</p>
                              )}
                              {quote.payment_type && (
                                <p><strong>Payment Type:</strong> {quote.payment_type === 'full' ? 'Full Payment' : 'Staggered Payment'}</p>
                              )}
                              {quote.client_first_name && quote.client_last_name && (
                                <p><strong>Client:</strong> {quote.client_first_name} {quote.client_last_name}</p>
                              )}
                              {quote.client_email && (
                                <p><strong>Email:</strong> {quote.client_email}</p>
                              )}
                              <p><strong>Created:</strong> {formatDate(quote.created_at)}</p>
                              {quote.validity_date && (
                                <p><strong>Validity Date:</strong> {formatDate(quote.validity_date)}</p>
                              )}
                              {(() => {
                                // Handle both array format and object format with metadata
                                let items: any[] = []
                                if (quote.line_items) {
                                  if (Array.isArray(quote.line_items)) {
                                    items = quote.line_items
                                  } else if (typeof quote.line_items === 'object' && (quote.line_items as any).items) {
                                    items = (quote.line_items as any).items || []
                                  }
                                }
                                
                                return items.length > 0 ? (
                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <p className="font-semibold mb-1 text-gray-900 dark:text-gray-100">Line Items:</p>
                                    <div className="space-y-1">
                                      {items.map((item, idx) => {
                                        const TAX_RATE = 0.12
                                        const itemAmount = item.total || item.unitPrice || 0
                                        const itemTax = item.taxable ? itemAmount * TAX_RATE : 0
                                        return (
                                          <div key={item.id || idx} className="space-y-0.5">
                                            <div className="flex justify-between text-xs">
                                              <span className="text-gray-600 dark:text-gray-400">
                                                {item.quantity || 1}x {item.description}
                                                {item.taxable && (
                                                  <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                                )}
                                              </span>
                                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {formatCurrency(itemAmount)}
                                              </span>
                                            </div>
                                            {item.taxable && itemTax > 0 && (
                                              <div className="flex justify-between text-xs pl-3 text-gray-500 dark:text-gray-400">
                                                <span>Tax (12%):</span>
                                                <span>{formatCurrency(itemTax)}</span>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ) : null
                              })()}
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(`/quotations/${quote.id}`, '_blank', 'noopener,noreferrer')
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const quoteLink = `${window.location.origin}/quotations/${quote.id}`
                                  navigator.clipboard.writeText(quoteLink)
                                  showToast('Quote link copied to clipboard!', 'success')
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Normalize line_items for editing (handle both array and object formats)
                                  let normalizedLineItems: QuoteLineItem[] = []
                                  if (quote.line_items) {
                                    if (Array.isArray(quote.line_items)) {
                                      normalizedLineItems = quote.line_items
                                    } else if (typeof quote.line_items === 'object' && (quote.line_items as any).items) {
                                      normalizedLineItems = (quote.line_items as any).items || []
                                    }
                                  }
                                  setEditingQuote({ ...quote, line_items: normalizedLineItems })
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(quote.id)
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )
              })
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <Card className="max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Confirm Delete
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to delete this quotation? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </div>
          )}

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
        </main>
      </div>
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
  )
}

function EditQuoteForm({
  quote,
  setQuote,
  onSave,
  onCancel,
}: {
  quote: Quotation
  setQuote: (quote: Quotation) => void
  onSave: () => void
  onCancel: () => void
}) {
  const [currentService, setCurrentService] = useState<Service[]>([])
  const [showCurrentService, setShowCurrentService] = useState(false)

  useEffect(() => {
    if (quote.service && quote.state) {
      servicesAPI.getByServiceAndState(quote.service, quote.state)
        .then(data => setCurrentService((data || []) as unknown as Service[]))
        .catch(() => setCurrentService([]))
    }
  }, [quote.service, quote.state])

  return (
    <div className="space-y-4">
      {/* Current Service Configuration Display */}
      {quote.service && quote.state && currentService.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Current Service Configuration: {quote.service} - {quote.state}
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCurrentService(!showCurrentService)}
            >
              {showCurrentService ? 'Hide' : 'Show'} Template
            </Button>
          </div>
          {showCurrentService && currentService.length > 0 && (
            <div className="space-y-3 mt-3">
              {currentService.map((service) => {
                const step1Items = service.line_items.filter(item => !item.step || item.step === 1)
                const step2Items = service.line_items.filter(item => item.step === 2)
                
                return (
                  <div key={service.id} className="space-y-2">
                    {step1Items.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-blue-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            Step 1 - Pay Now
                          </span>
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(service.total_step1 || step1Items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                          </span>
                        </div>
                        <div className="space-y-1">
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
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            Step 2 - Pay Later
                          </span>
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            {formatCurrency(service.total_step2 || step2Items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {step2Items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                              <span>{item.description}</span>
                              <span className="font-medium">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {service.payment_type === 'full' && (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-green-200 dark:border-green-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            Full Payment
                          </span>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(service.total_full)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {service.line_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                              <span>{item.description}</span>
                              <span className="font-medium">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Service"
          value={quote.service || ''}
          onChange={(e) => setQuote({ ...quote, service: e.target.value })}
        />
        <Input
          label="State"
          value={quote.state || ''}
          onChange={(e) => setQuote({ ...quote, state: e.target.value })}
        />
        <Input
          label="Amount"
          type="number"
          value={quote.amount}
          onChange={(e) => setQuote({ ...quote, amount: parseFloat(e.target.value) || 0 })}
        />
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Payment Type
          </label>
          <select
            value={quote.payment_type || ''}
            onChange={(e) => setQuote({ ...quote, payment_type: e.target.value as 'full' | 'staggered' })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">Select...</option>
            <option value="full">Full Payment</option>
            <option value="staggered">Staggered Payment</option>
          </select>
        </div>
        <Input
          label="Validity Date"
          type="date"
          value={quote.validity_date ? (() => {
            const date = new Date(quote.validity_date)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          })() : ''}
          onChange={(e) => setQuote({ ...quote, validity_date: e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : undefined })}
        />
        <Input
          label="Client First Name"
          value={quote.client_first_name || ''}
          onChange={(e) => setQuote({ ...quote, client_first_name: e.target.value })}
        />
        <Input
          label="Client Last Name"
          value={quote.client_last_name || ''}
          onChange={(e) => setQuote({ ...quote, client_last_name: e.target.value })}
        />
        <Input
          label="Client Email"
          type="email"
          value={quote.client_email || ''}
          onChange={(e) => setQuote({ ...quote, client_email: e.target.value })}
        />
        <Input
          label="Client Mobile"
          value={quote.client_mobile || ''}
          onChange={(e) => setQuote({ ...quote, client_mobile: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          value={quote.description}
          onChange={(e) => setQuote({ ...quote, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          rows={3}
        />
      </div>

      {/* Line Items Editor */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Line Items
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newItem: QuoteLineItem = {
                id: `item-${Date.now()}`,
                description: '',
                quantity: 1,
                unitPrice: 0,
                total: 0
              }
              setQuote({
                ...quote,
                line_items: [...(quote.line_items || []), newItem]
              })
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {(quote.line_items || []).map((item, index) => (
            <div key={item.id || index} className="flex gap-2 items-center p-3 border border-gray-300 dark:border-gray-700 rounded-lg">
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => {
                  const newItems = [...(quote.line_items || [])]
                  newItems[index] = { ...item, description: e.target.value }
                  setQuote({ ...quote, line_items: newItems })
                }}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => {
                  const qty = parseFloat(e.target.value) || 1
                  const newItems = [...(quote.line_items || [])]
                  newItems[index] = {
                    ...item,
                    quantity: qty,
                    total: qty * item.unitPrice
                  }
                  setQuote({ ...quote, line_items: newItems, amount: newItems.reduce((sum, i) => sum + i.total, 0) })
                }}
                className="w-24"
              />
              <Input
                type="number"
                placeholder="Unit Price"
                value={item.unitPrice}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0
                  const newItems = [...(quote.line_items || [])]
                  newItems[index] = {
                    ...item,
                    unitPrice: price,
                    total: item.quantity * price
                  }
                  setQuote({ ...quote, line_items: newItems, amount: newItems.reduce((sum, i) => sum + i.total, 0) })
                }}
                className="w-32"
              />
              <div className="w-32 text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(item.total)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newItems = (quote.line_items || []).filter((_, i) => i !== index)
                  setQuote({
                    ...quote,
                    line_items: newItems,
                    amount: newItems.reduce((sum, i) => sum + i.total, 0)
                  })
                }}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {quote.line_items && quote.line_items.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Total Amount:</span>
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(quote.amount)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

