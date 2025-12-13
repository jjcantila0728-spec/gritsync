import { useEffect, useState, useRef } from 'react'
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
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set())
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

  // Calculate opened and unopened counts
  const getQuoteCounts = () => {
    const opened = getOpenedQuotes()
    const unopened = quotations.filter(q => !opened.has(q.id)).length
    const openedCount = quotations.filter(q => opened.has(q.id)).length
    return { unopened, opened: openedCount, total: quotations.length }
  }

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard')
      return
    }
    fetchQuotations()

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
        
        // Remove from selected quotes if it was selected
        setSelectedQuotes(prev => {
          const newSet = new Set(prev)
          newSet.delete(oldRecord.id)
          return newSet
        })
        
        // Remove from opened quotes in localStorage
        const opened = getOpenedQuotes()
        opened.delete(oldRecord.id)
        localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
        
        showToast('Quotation deleted', 'info')
        window.dispatchEvent(new CustomEvent('quotesUpdated'))
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

  const handleDelete = async (id: string) => {
    // Store the quote to restore if deletion fails
    const quoteToDelete = quotations.find(q => q.id === id)
    
    setDeleteConfirm(null)
    
    // Verify admin status before attempting deletion
    if (!isAdmin()) {
      showToast('You do not have permission to delete quotations', 'error')
      return
    }
    
    try {
      // Actually delete from database first (don't do optimistic update)
      const deletedData = await quotationsAPI.delete(id)
      
      if (!deletedData || deletedData.length === 0) {
        throw new Error('Deletion failed: No data returned from server')
      }
      
      // Only remove from state after successful deletion
      setQuotations(prev => prev.filter(q => q.id !== id))
      
      // Remove from selected quotes if it was selected
      setSelectedQuotes(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      
      // Remove from opened quotes in localStorage
      const opened = getOpenedQuotes()
      opened.delete(id)
      localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
      
      showToast('Quotation deleted successfully', 'success')
      window.dispatchEvent(new CustomEvent('quotesUpdated'))
      
      // Verify deletion by fetching again after a short delay
      setTimeout(async () => {
        try {
          const { data: verify } = await quotationsAPI.getById(id)
          if (verify) {
            console.error('WARNING: Quotation still exists after deletion!', id)
            showToast('Warning: Quotation may not have been fully deleted. Please refresh the page.', 'warning')
            // Re-add to list if it still exists
            setQuotations(prev => {
              if (!prev.find(q => q.id === id) && quoteToDelete) {
                return [...prev, quoteToDelete].sort((a, b) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
              }
              return prev
            })
          }
        } catch (verifyError: any) {
          // Good - quotation doesn't exist (404 is expected)
          if (verifyError.message && !verifyError.message.includes('not found')) {
            console.error('Error verifying deletion:', verifyError)
          }
        }
      }, 1000)
      
    } catch (error: any) {
      console.error('Delete error:', error)
      showToast(error.message || 'Failed to delete quotation. Please check your permissions.', 'error')
      // Don't restore optimistically - the quote is still in the list
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedQuotes.size === 0) return
    
    // Verify admin status before attempting deletion
    if (!isAdmin()) {
      showToast('You do not have permission to delete quotations', 'error')
      return
    }
    
    const idsToDelete = Array.from(selectedQuotes)
    const quotesToDelete = quotations.filter(q => idsToDelete.includes(q.id))
    
    // Don't optimistically remove - wait for actual deletion
    const originalQuotations = [...quotations]
    
    try {
      // Delete all selected quotations
      const deleteResults = await Promise.allSettled(
        idsToDelete.map(id => quotationsAPI.delete(id))
      )
      
      // Check which deletions succeeded
      const successfulDeletions: string[] = []
      const failedDeletions: string[] = []
      
      deleteResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
          successfulDeletions.push(idsToDelete[index])
        } else {
          failedDeletions.push(idsToDelete[index])
        }
      })
      
      // Remove only successfully deleted quotes from state
      if (successfulDeletions.length > 0) {
        setQuotations(prev => prev.filter(q => !successfulDeletions.includes(q.id)))
        
        // Remove from opened quotes in localStorage
        const opened = getOpenedQuotes()
        successfulDeletions.forEach(id => opened.delete(id))
        localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
      }
      
      // Clear selection
      setSelectedQuotes(new Set())
      
      if (failedDeletions.length > 0) {
        showToast(
          `Deleted ${successfulDeletions.length} quotation(s), but ${failedDeletions.length} failed. Please check your permissions.`,
          'warning'
        )
      } else {
        showToast(`Successfully deleted ${successfulDeletions.length} quotation(s)`, 'success')
      }
      
      window.dispatchEvent(new CustomEvent('quotesUpdated'))
      
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      showToast(error.message || 'Failed to delete quotations. Please check your permissions.', 'error')
      // Don't restore - quotes are still in the list
    }
  }

  const handleClearAll = () => {
    const opened = getOpenedQuotes()
    quotations.forEach(q => opened.add(q.id))
    localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
    window.dispatchEvent(new CustomEvent('quotesUpdated'))
    showToast('All quotations marked as opened', 'success')
    // Force re-render
    setQuotations(prev => [...prev])
  }

  const handleSelectAll = () => {
    if (selectedQuotes.size === filteredQuotations.length) {
      setSelectedQuotes(new Set())
    } else {
      setSelectedQuotes(new Set(filteredQuotations.map(q => q.id)))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedQuotes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
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
            </div>
          </div>

          {/* Filters and Actions */}
          <Card className="mb-6">
            <div className="flex flex-col gap-4">
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
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Total:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{getQuoteCounts().total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Opened:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{getQuoteCounts().opened}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Unopened:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{getQuoteCounts().unopened}</span>
                  </div>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  {selectedQuotes.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedQuotes.size})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                  >
                    Clear All (Mark as Opened)
                  </Button>
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
              <>
                {filteredQuotations.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <input
                      type="checkbox"
                      checked={selectedQuotes.size === filteredQuotations.length && filteredQuotations.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Select All ({filteredQuotations.length} quotations)
                    </span>
                  </div>
                )}
                {filteredQuotations.map((quote, index) => {
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
                          onClick={(e) => {
                            // Don't expand/collapse if clicking on checkbox or delete button
                            if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                                (e.target as HTMLElement).closest('button')) {
                              return
                            }
                            if (isExpanded) {
                              setExpandedQuoteId(null)
                            } else {
                              setExpandedQuoteId(quote.id)
                              markQuoteAsOpened(quote.id)
                            }
                          }}
                        >
                          <div className="flex-1 flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={selectedQuotes.has(quote.id)}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleSelect(quote.id)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                              />
                            </div>
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
                                  markQuoteAsOpened(quote.id)
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
                })}
              </>
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

        </main>
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

