import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/Loading'
import { quotationsAPI, servicesAPI } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { DollarSign, Plus, CheckCircle, Loader2, Download, FileText, Building2, User, Mail, Phone, Calendar, X, Info, ChevronRight, Copy, Check, ArrowLeft } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'

interface Quotation {
  id: string
  amount: number
  description: string
  status: string
  created_at: string
  user_id: string | null // NULL for public/guest quotations
  service?: string
  state?: string
  payment_type?: string
  line_items?: QuoteLineItem[]
  client_first_name?: string
  client_last_name?: string
  client_email?: string
  client_mobile?: string
  validity_date?: string // Quote expiration date
}

interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  payLater?: boolean // Flag to indicate items that will be paid later (for staggered payments)
  taxable?: boolean // Flag to indicate if item is taxable
}

interface QuoteFormData {
  service: string
  state: string
  takerType: 'first-time' | 'retaker' | null
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  paymentType: 'full' | 'staggered' | null
  lineItems: QuoteLineItem[]
  total: number
  subtotal: number // Subtotal before tax
  tax: number // Tax amount
}

// Service configuration type
interface ServiceConfig {
  step1: {
    total: number
    items: Array<{ description: string; amount: number; taxable?: boolean }>
  }
  step2: {
    total: number
    items: Array<{ description: string; amount: number; taxable?: boolean }>
  }
}

// Tax rate constant
const TAX_RATE = 0.12 // 12% tax

// Default fallback service configuration
const DEFAULT_NCLEX_SERVICES: ServiceConfig = {
  step1: {
    total: 267.99,
    items: [
      { description: 'NCLEX NY BON Application Fee', amount: 143 },
      { description: 'NCLEX NY Mandatory Courses', amount: 54.99 },
      { description: 'NCLEX NY Bond Fee', amount: 70 },
    ],
  },
  step2: {
    total: 508,
    items: [
      { description: 'NCLEX PV Application Fee', amount: 200 },
      { description: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
      { description: 'NCLEX GritSync Service Fee', amount: 150 },
      { description: 'NCLEX NY Quick Results', amount: 8 },
    ],
  },
}

export function Quote() {
  const { id: quoteId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  
  // Format quote ID for display (always returns GQ format)
  // Uses the API's generateGQId function for consistency
  const formatQuoteId = (id: string | undefined): string => {
    if (!id) return 'N/A'
    return quotationsAPI.generateGQId(id)
  }
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [_loadingQuote, setLoadingQuote] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1, 2, 3, or 4 (result)
  const [generating, setGenerating] = useState(false)
  const [generatedQuote, setGeneratedQuote] = useState<Quotation | null>(null)
  const [viewingQuote, setViewingQuote] = useState<Quotation | null>(null)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [showPreloader, setShowPreloader] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [expirationDate, setExpirationDate] = useState<Date | null>(null)
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>(DEFAULT_NCLEX_SERVICES)
  
  // Fetch service configuration from database
  // Fetches both staggered and full payment services to get complete configuration
  useEffect(() => {
    async function loadServices() {
      try {
        // Fetch all services for NCLEX Processing - New York (both staggered and full)
        const services = await servicesAPI.getAllByServiceAndState('NCLEX Processing', 'New York')
        
        if (services && services.length > 0) {
          // Prefer staggered service for step structure (it has step1 and step2 clearly defined)
          const staggeredService = services.find((s: any) => s.payment_type === 'staggered')
          const fullService = services.find((s: any) => s.payment_type === 'full')
          
          // Use staggered service if available (it has step information)
          const serviceToUse = staggeredService || fullService || services[0]
          const typedService = serviceToUse as { line_items?: any } | null
          
          if (typedService && typedService.line_items) {
            const lineItems = typedService.line_items as Array<{ step?: number }>
            const step1Items = lineItems.filter((item: any) => !item.step || item.step === 1)
            const step2Items = lineItems.filter((item: any) => item.step === 2)
            
            // Calculate subtotals (before tax) from line items
            // Line item amounts are the base prices (subtotals)
            const step1Subtotal = step1Items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
            const step2Subtotal = step2Items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
            
            // Calculate tax for each step (12% on taxable items only)
            const step1Tax = step1Items.reduce((sum: number, item: any) => {
              return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
            }, 0)
            const step2Tax = step2Items.reduce((sum: number, item: any) => {
              return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
            }, 0)
            
            // Calculate totals (subtotal + tax)
            // Database totals should match this, but we calculate from line items for accuracy
            const step1Total = step1Subtotal + step1Tax
            const step2Total = step2Subtotal + step2Tax
            
            
            setServiceConfig({
              step1: {
                total: step1Total,
                items: step1Items.map((item: any) => ({ 
                  description: item.description, 
                  amount: item.amount,
                  taxable: item.taxable || false
                }))
              },
              step2: {
                total: step2Total,
                items: step2Items.map((item: any) => ({ 
                  description: item.description, 
                  amount: item.amount,
                  taxable: item.taxable || false
                }))
              }
            })
          }
        }
      } catch (error) {
        // Use default configuration if API fails
      }
    }
    loadServices()
  }, [])
  
  // Check if quote is expired (30 days from creation or validity_date)
  // Quotes are saved in database until expiration - no automatic deletion
  const checkExpiration = (quote: Quotation) => {
    // Use validity_date if available, otherwise calculate from created_at
    let expiryDate: Date
    if ((quote as any).validity_date) {
      expiryDate = new Date((quote as any).validity_date)
    } else if (quote.created_at) {
      const createdDate = new Date(quote.created_at)
      expiryDate = new Date(createdDate)
      expiryDate.setDate(expiryDate.getDate() + 30)
    } else {
      return false
    }
    setExpirationDate(expiryDate)
    return new Date() > expiryDate
  }
  
  // Initialize form data
  const getInitialFormData = (): QuoteFormData => {
    return {
      service: 'NCLEX Processing',
      state: 'New York',
      takerType: null,
      firstName: '',
      lastName: '',
      email: '',
      mobileNumber: '',
      paymentType: null,
      lineItems: [],
      total: 0,
      subtotal: 0,
      tax: 0
    }
  }

  const [formData, setFormData] = useState<QuoteFormData>(getInitialFormData())

  useEffect(() => {
    if (quoteId) {
      // If we already have this quote loaded, don't refetch
      if ((generatedQuote?.id === quoteId || viewingQuote?.id === quoteId) && currentStep === 4) {
        // Quote already loaded, just ensure we're showing it
        return
      }
      // If there's a quote ID in the URL, fetch and display that quote
      fetchQuoteById(quoteId)
    } else if (user) {
      fetchQuotations()
    } else {
      setLoading(false)
      // Automatically show the quote generator for non-logged-in users
      setShowGenerator(true)
      setCurrentStep(1)
    }
  }, [user, quoteId])

  // Mark quote as opened in localStorage
  const markQuoteAsOpened = (quoteId: string) => {
    try {
      const stored = localStorage.getItem('openedQuotes')
      const opened = stored ? new Set(JSON.parse(stored)) : new Set()
      opened.add(quoteId)
      localStorage.setItem('openedQuotes', JSON.stringify(Array.from(opened)))
      window.dispatchEvent(new CustomEvent('quotesUpdated'))
    } catch {
      // Ignore errors
    }
  }

  async function fetchQuoteById(id: string) {
    setLoadingQuote(true)
    setLoading(true)
    setShowPreloader(true)
    try {
      // Use public endpoint if user is not logged in, otherwise use authenticated endpoint
      const quote = user 
        ? await quotationsAPI.getById(id)
        : await quotationsAPI.getByIdPublic(id)
      const typedQuote = quote as {
        id?: string
        payment_type?: string
        description?: string
        line_items?: any
        service?: string
        state?: string
        client_first_name?: string
        client_last_name?: string
        client_email?: string
        user_id?: string
        client_mobile?: string
        amount?: number
        created_at?: string
      } | null
      if (typedQuote) {
        // Check if quote has expired
        const expired = checkExpiration(typedQuote as any)
        setIsExpired(expired)
        
        if (expired) {
          showToast('This quotation has expired. It is shown for reference only.', 'warning')
        }
        
        setViewingQuote(typedQuote as any)
        setCurrentStep(4) // Show result view
        
        // Mark quote as opened when viewing
        if (typedQuote.id) {
          markQuoteAsOpened(typedQuote.id)
        }
        
        // Determine payment type from quote data or description
        const paymentType = typedQuote.payment_type || (() => {
          const description = typedQuote.description || ''
          const isFullPayment = description.includes('NCLEX PV Application Fee') && description.includes('NCLEX NY BON Application Fee')
          return isFullPayment ? 'full' : 'staggered'
        })()
        
        // Load line items from quote if available, otherwise reconstruct from description
        let items: QuoteLineItem[] = []
        // Check if line_items is an object with items array (new format with metadata)
        let lineItemsData: any = typedQuote.line_items
        let takerTypeFromMetadata: 'first-time' | 'retaker' | null = null
        
        if (lineItemsData && typeof lineItemsData === 'object' && !Array.isArray(lineItemsData) && lineItemsData.items) {
          // Extract taker_type from metadata if available
          if (lineItemsData.metadata && lineItemsData.metadata.taker_type) {
            takerTypeFromMetadata = lineItemsData.metadata.taker_type
          }
          lineItemsData = lineItemsData.items
        }
        
        if (lineItemsData && Array.isArray(lineItemsData) && lineItemsData.length > 0) {
          // Use saved line items from quote
          items = lineItemsData.map((item: any, idx: number) => ({
            id: item.id || `item-${idx}`,
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.total || 0,
            total: item.total || item.unitPrice || 0,
            payLater: item.payLater || false,
            taxable: item.taxable || false
          }))
        } else {
          // Reconstruct line items from description (fallback)
          // Check if takerType is available from metadata
          let takerTypeFromQuote: 'first-time' | 'retaker' | null = null
          if (typedQuote.line_items && typeof typedQuote.line_items === 'object' && !Array.isArray(typedQuote.line_items)) {
            const metadata = (typedQuote.line_items as any).metadata
            if (metadata && metadata.taker_type) {
              takerTypeFromQuote = metadata.taker_type
            }
          }
          
          if (takerTypeFromQuote === 'retaker') {
            // Retaker: Only Step 2 items
            items.push(...serviceConfig.step2.items.map((item, idx) => ({
              id: `item-step2-${idx}`,
              description: item.description,
              quantity: 1,
              unitPrice: item.amount,
              total: item.amount,
              payLater: false,
              taxable: item.taxable || false
            })))
          } else if (paymentType === 'full') {
            // First Time Taker - Full Payment: Step 1 + Step 2
            const allItems = [...serviceConfig.step1.items, ...serviceConfig.step2.items]
            items.push(...allItems.map((item, idx) => ({
              id: `item-${idx}`,
              description: item.description,
              quantity: 1,
              unitPrice: item.amount,
              total: item.amount,
              payLater: false,
              taxable: item.taxable || false
            })))
          } else {
            // First Time Taker - Staggered: Include both Step 1 and Step 2, but mark Step 2 as payLater
            const step1Items: QuoteLineItem[] = serviceConfig.step1.items.map((item, idx) => ({
              id: `item-${idx}`,
              description: item.description,
              quantity: 1,
              unitPrice: item.amount,
              total: item.amount,
              payLater: false,
              taxable: item.taxable || false
            }))
            const step2Items: QuoteLineItem[] = serviceConfig.step2.items.map((item, idx) => ({
              id: `item-step2-${idx}`,
              description: item.description,
              quantity: 1,
              unitPrice: item.amount,
              total: item.amount,
              payLater: true,
              taxable: item.taxable || false
            }))
            items.push(...step1Items, ...step2Items)
          }
        }
        
        // Calculate subtotal and tax from loaded items
        const subtotal = items.reduce((sum, item) => sum + item.total, 0)
        const tax = items.reduce((sum, item) => {
          return sum + (item.taxable ? item.total * TAX_RATE : 0)
        }, 0)
        const total = subtotal + tax
        
        // Load client details from quote (these should be saved when quote is created)
        setFormData({
          service: typedQuote.service || 'NCLEX Processing',
          state: typedQuote.state || 'New York',
          takerType: takerTypeFromMetadata,
          firstName: typedQuote.client_first_name || '',
          lastName: typedQuote.client_last_name || '',
          email: typedQuote.client_email || typedQuote.user_id || '',
          mobileNumber: typedQuote.client_mobile || '',
          paymentType: paymentType as 'full' | 'staggered',
          lineItems: items,
          subtotal,
          tax,
          total: typedQuote.amount || total // Use quote amount if available, otherwise calculated total
        })
        setGeneratedQuote(typedQuote as any)
        
        // Show preloader for 3 seconds before displaying quote
        setTimeout(() => {
          setShowPreloader(false)
        }, 3000)
      } else {
        setShowPreloader(false)
        showToast('Quotation not found', 'error')
        navigate('/quote')
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
      setShowPreloader(false)
      showToast('Failed to load quotation', 'error')
      navigate('/quote')
    } finally {
      setLoadingQuote(false)
      setLoading(false)
    }
  }

  // Calculate totals when payment type or taker type changes
  // This handles both Full Payment and Staggered Payment based on service configuration:
  // - First Time Taker: Full Payment includes Step 1 + Step 2, Staggered includes both steps
  // - Retaker: Only Step 2, Full Payment only
  // Tax is calculated on taxable items only (12% rate)
  useEffect(() => {
    // Helper function to calculate tax and totals
    const calculateTaxAndTotal = (items: QuoteLineItem[]) => {
      const subtotal = items.reduce((sum, item) => sum + item.total, 0)
      const tax = items.reduce((sum, item) => {
        return sum + (item.taxable ? item.total * TAX_RATE : 0)
      }, 0)
      const total = subtotal + tax
      return { subtotal, tax, total }
    }

    // Retaker: Only Step 2, Full Payment only
    if (formData.takerType === 'retaker') {
      if (formData.paymentType === 'full') {
        // Retaker full payment: Step 2 only
        const step2Items: QuoteLineItem[] = serviceConfig.step2.items.map((item, idx) => ({
          id: `item-step2-${idx}`,
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
          total: item.amount,
          payLater: false,
          taxable: item.taxable || false
        }))
        const { subtotal, tax, total } = calculateTaxAndTotal(step2Items)
        setFormData(prev => ({ ...prev, lineItems: step2Items, subtotal, tax, total }))
      } else {
        // Retaker must use full payment, reset if staggered is selected
        setFormData(prev => ({ ...prev, lineItems: [], subtotal: 0, tax: 0, total: 0, paymentType: null }))
      }
    } 
    // First Time Taker: Both steps available
    else if (formData.takerType === 'first-time') {
      if (formData.paymentType === 'full') {
        // Full payment: Step 1 + Step 2 (all items paid upfront)
        const allItems = [...serviceConfig.step1.items, ...serviceConfig.step2.items]
        const lineItems: QuoteLineItem[] = allItems.map((item, idx) => ({
          id: `item-${idx}`,
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
          total: item.amount,
          payLater: false, // All items paid upfront for full payment
          taxable: item.taxable || false
        }))
        const { subtotal, tax, total } = calculateTaxAndTotal(lineItems)
        setFormData(prev => ({ ...prev, lineItems, subtotal, tax, total }))
      } else if (formData.paymentType === 'staggered') {
        // Staggered payment: Step 1 (pay now) + Step 2 (pay later - for reference)
        // Step 1 items from service configuration
        const step1Items: QuoteLineItem[] = serviceConfig.step1.items.map((item, idx) => ({
          id: `item-${idx}`,
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
          total: item.amount,
          payLater: false, // Step 1: Pay Now
          taxable: item.taxable || false
        }))
        // Step 2 items from service configuration
        const step2Items: QuoteLineItem[] = serviceConfig.step2.items.map((item, idx) => ({
          id: `item-step2-${idx}`,
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
          total: item.amount,
          payLater: true, // Step 2: Pay Later
          taxable: item.taxable || false
        }))
        // Include both Step 1 and Step 2 items, but only charge for Step 1
        const allItems = [...step1Items, ...step2Items]
        // Calculate tax and total for Step 1 only (what's being paid now)
        const { subtotal, tax, total } = calculateTaxAndTotal(step1Items)
        setFormData(prev => ({ ...prev, lineItems: allItems, subtotal, tax, total }))
      } else {
        setFormData(prev => ({ ...prev, lineItems: [], subtotal: 0, tax: 0, total: 0 }))
      }
    } else {
      // No taker type selected yet
      setFormData(prev => ({ ...prev, lineItems: [], subtotal: 0, tax: 0, total: 0 }))
    }
  }, [formData.paymentType, formData.takerType, serviceConfig])

  async function fetchQuotations() {
    try {
      if (user) {
        // Fetch all quotations (user's own + public quotations)
        // For admins, this will show all quotations
        // For regular users, this will show their own + public quotations
        const data = await quotationsAPI.getAll()
        const typedData = (data || []).map((q: any) => ({
          ...q,
          service: q.service ?? undefined
        }))
        setQuotations(typedData)
      } else {
        // For non-logged-in users, try to fetch public quotations only
        try {
          const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .is('user_id', null)
            .order('created_at', { ascending: false })
          
          if (!error && data) {
            setQuotations((data || []) as any[])
          }
        } catch (err) {
          // If fetching fails, just set empty array
          setQuotations([])
        }
      }
    } catch (error) {
      console.error('Error fetching quotations:', error)
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }

  const updateFormField = (field: keyof QuoteFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleGeneratePDF = async () => {
    try {
      // Validation
      if (!formData.firstName || !formData.lastName || !formData.email) {
        showToast('Please fill in all client details', 'error')
        return
      }
      if (!formData.paymentType) {
        showToast('Please select a payment type', 'error')
        return
      }
      if (formData.lineItems.length === 0) {
        showToast('Please select a payment type', 'error')
        return
      }

      // Create PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        format: 'letter'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      let yPos = margin

      // Quote data - use formatted quote ID
      const quoteNumber = formatQuoteId((generatedQuote || viewingQuote)?.id) || `QT-${Date.now().toString().slice(-6)}`
      const quoteDate = (generatedQuote || viewingQuote)?.created_at 
        ? new Date((generatedQuote || viewingQuote)!.created_at)
        : new Date()
      const expiryDate = expirationDate || (() => {
        const exp = new Date(quoteDate)
        exp.setDate(exp.getDate() + 30)
        return exp
      })()

      // Load and add logo (inlined with text)
      let logoAdded = false
      let logoImg: HTMLImageElement | null = null
      try {
        logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.src = window.location.origin + '/gritsync_logo.png'
        
        await new Promise((resolve, reject) => {
          if (logoImg!.complete) {
            resolve(logoImg)
          } else {
            logoImg!.onload = () => resolve(logoImg)
            logoImg!.onerror = () => reject(new Error('Logo failed to load'))
            // Timeout after 1 second
            setTimeout(() => reject(new Error('Logo load timeout')), 1000)
          }
        })
        logoAdded = true
      } catch {
        // Continue without logo
      }

      // Header (compact) - Logo inlined with GRIT and SYNC together (no space)
      const logoSize = 10 // Smaller logo for inline
      let currentX = margin
      
      if (logoAdded && logoImg) {
        // Draw rounded rectangle background for soft edges effect
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(240, 240, 240)
        doc.setLineWidth(0.3)
        doc.roundedRect(currentX, yPos - 4, logoSize, logoSize, 1.5, 1.5, 'FD')
        
        // Add logo image
        doc.addImage(logoImg, 'PNG', currentX + 0.3, yPos - 3.7, logoSize - 0.6, logoSize - 0.6)
        currentX += logoSize + 3 // Space after logo
      }
      
      // GRIT and SYNC text (inlined with logo)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('GRIT', currentX, yPos)
      doc.setTextColor(220, 38, 38)
      const gritWidth = doc.getTextWidth('GRIT')
      doc.text('SYNC', currentX + gritWidth, yPos)
      doc.setTextColor(0, 0, 0)
      
      // NCLEX Application Processing Services (below GRITSYNC)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('NCLEX Application Processing Services', currentX, yPos + 5)
      
      // Quote number and date (compact)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Quotation #${quoteNumber}`, pageWidth - margin, yPos, { align: 'right' })
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${formatDate(quoteDate.toISOString())}`, pageWidth - margin, yPos + 4, { align: 'right' })
      doc.text(`Valid: ${formatDate(expiryDate.toISOString())}`, pageWidth - margin, yPos + 8, { align: 'right' })

      yPos += 18

      // Separator line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      // Client Details Section (compact)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Client Details', margin, yPos)
      yPos += 5
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Name: ${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'N/A', margin, yPos)
      doc.text(`Email: ${formData.email || 'N/A'}`, margin + 80, yPos)
      // Service on right side below email
      doc.text(`Service: ${formData.service} - ${formData.state}`, margin + 80, yPos + 4)
      yPos += 4
      if (formData.mobileNumber) {
        doc.text(`Mobile: ${formData.mobileNumber}`, margin, yPos)
        yPos += 4
      } else {
        yPos += 2
      }
      yPos += 3

      // Separator line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      // Payment Summary (compact)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Payment Summary', margin, yPos)
      yPos += 5
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const indent = 5 // Indent for payment details
      doc.text(`Type: ${formData.paymentType === 'full' ? 'Full Payment' : 'Staggered Payment'}`, margin + indent, yPos)
      yPos += 4

      if (formData.paymentType === 'staggered') {
        const step1Subtotal = formData.lineItems.filter(item => !item.payLater).reduce((sum, item) => sum + item.total, 0)
        const step1Tax = formData.lineItems.filter(item => !item.payLater && item.taxable).reduce((sum, item) => sum + item.total * TAX_RATE, 0)
        const step1Total = step1Subtotal + step1Tax
        
        const step2Subtotal = formData.lineItems.filter(item => item.payLater).reduce((sum, item) => sum + item.total, 0)
        const step2Tax = formData.lineItems.filter(item => item.payLater && item.taxable).reduce((sum, item) => sum + item.total * TAX_RATE, 0)
        const step2Total = step2Subtotal + step2Tax
        
        doc.text(`Step 1 Subtotal: ${formatCurrency(step1Subtotal)}`, margin + indent, yPos)
        yPos += 4
        if (step1Tax > 0) {
          doc.text(`Step 1 Tax (12%): ${formatCurrency(step1Tax)}`, margin + indent, yPos)
          yPos += 4
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`Step 1 Total: ${formatCurrency(step1Total)}`, margin + indent, yPos)
        yPos += 4
        
        doc.setFont('helvetica', 'normal')
        doc.text(`Step 2 Subtotal: ${formatCurrency(step2Subtotal)}`, margin + indent, yPos)
        yPos += 4
        if (step2Tax > 0) {
          doc.text(`Step 2 Tax (12%): ${formatCurrency(step2Tax)}`, margin + indent, yPos)
          yPos += 4
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`Step 2 Total: ${formatCurrency(step2Total)}`, margin + indent, yPos)
        yPos += 4
        
        doc.setFont('helvetica', 'normal')
        doc.text(`Subtotal: ${formatCurrency(step1Subtotal + step2Subtotal)}`, margin + indent, yPos)
        yPos += 4
        const totalTax = step1Tax + step2Tax
        if (totalTax > 0) {
          doc.text(`Tax (12%): ${formatCurrency(totalTax)}`, margin + indent, yPos)
          yPos += 4
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`Total: ${formatCurrency(step1Total + step2Total)}`, margin + indent, yPos)
      } else {
        const subtotal = formData.subtotal || formData.lineItems.reduce((sum, item) => sum + item.total, 0)
        const tax = formData.tax || formData.lineItems.reduce((sum, item) => sum + (item.taxable ? item.total * TAX_RATE : 0), 0)
        const total = subtotal + tax
        
        doc.text(`Subtotal: ${formatCurrency(subtotal)}`, margin + indent, yPos)
        yPos += 4
        if (tax > 0) {
          doc.text(`Tax (12%): ${formatCurrency(tax)}`, margin + indent, yPos)
          yPos += 4
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`Total: ${formatCurrency(total)}`, margin + indent, yPos)
      }
      yPos += 6

      // Separator line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      // Line Items (compact)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Line Items', margin, yPos)
      yPos += 5

      if (formData.paymentType === 'staggered') {
        // Step 1 items
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('Step 1:', margin, yPos)
        yPos += 4
        doc.setFont('helvetica', 'normal')
        formData.lineItems.filter(item => !item.payLater).forEach((item, index) => {
          // Draw box around item
          const itemY = yPos - 3
          const itemHeight = item.taxable ? 8 : 6
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.3)
          doc.rect(margin, itemY, pageWidth - (margin * 2), itemHeight)
          
          // Center text vertically in box (middle of top and bottom)
          const textY = itemY + (itemHeight / 2) + 1.5
          const descriptionText = `${index + 1}. ${item.description}${item.taxable ? ' (Taxable)' : ''}`
          doc.text(descriptionText, margin + 3, textY)
          const itemTotal = item.total + (item.taxable ? item.total * TAX_RATE : 0)
          doc.text(`${formatCurrency(itemTotal)}`, pageWidth - margin - 3, textY, { align: 'right' })
          if (item.taxable) {
            doc.setFontSize(7)
            doc.text(`Subtotal: ${formatCurrency(item.total)} + Tax: ${formatCurrency(item.total * TAX_RATE)}`, margin + 3, textY + 3)
            doc.setFontSize(8)
          }
          yPos += item.taxable ? 9 : 7
        })

        yPos += 2
        // Step 2 items
        doc.setFont('helvetica', 'bold')
        doc.text('Step 2:', margin, yPos)
        yPos += 4
        doc.setFont('helvetica', 'normal')
        formData.lineItems.filter(item => item.payLater).forEach((item, index) => {
          // Draw box around item
          const itemY = yPos - 3
          const itemHeight = item.taxable ? 8 : 6
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.3)
          doc.rect(margin, itemY, pageWidth - (margin * 2), itemHeight)
          
          // Center text vertically in box (middle of top and bottom)
          const textY = itemY + (itemHeight / 2) + 1.5
          const descriptionText = `${index + 1}. ${item.description}${item.taxable ? ' (Taxable)' : ''}`
          doc.text(descriptionText, margin + 3, textY)
          const itemTotal = item.total + (item.taxable ? item.total * TAX_RATE : 0)
          doc.text(`${formatCurrency(itemTotal)}`, pageWidth - margin - 3, textY, { align: 'right' })
          if (item.taxable) {
            doc.setFontSize(7)
            doc.text(`Subtotal: ${formatCurrency(item.total)} + Tax: ${formatCurrency(item.total * TAX_RATE)}`, margin + 3, textY + 3)
            doc.setFontSize(8)
          }
          yPos += item.taxable ? 9 : 7
        })
      } else {
        // Full payment items
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        formData.lineItems.forEach((item, index) => {
          // Draw box around item
          const itemY = yPos - 3
          const itemHeight = item.taxable ? 8 : 6
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.3)
          doc.rect(margin, itemY, pageWidth - (margin * 2), itemHeight)
          
          // Center text vertically in box (middle of top and bottom)
          const textY = itemY + (itemHeight / 2) + 1.5
          const descriptionText = `${index + 1}. ${item.description}${item.taxable ? ' (Taxable)' : ''}`
          doc.text(descriptionText, margin + 3, textY)
          const itemTotal = item.total + (item.taxable ? item.total * TAX_RATE : 0)
          doc.text(`${formatCurrency(itemTotal)}`, pageWidth - margin - 3, textY, { align: 'right' })
          if (item.taxable) {
            doc.setFontSize(7)
            doc.text(`Subtotal: ${formatCurrency(item.total)} + Tax: ${formatCurrency(item.total * TAX_RATE)}`, margin + 3, textY + 3)
            doc.setFontSize(8)
          }
          yPos += item.taxable ? 9 : 7
        })
      }

      yPos += 3

      // Important Notes (compact)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Notes: ID #${quoteNumber} | Valid 30 days | Prices in USD`, margin, yPos)

      // Footer (compact)
      const footerY = pageHeight - 10
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`© ${new Date().getFullYear()} GritSync | info@gritsync.com`, margin, footerY)
      doc.text(`Quote #${quoteNumber}`, pageWidth - margin, footerY, { align: 'right' })

      // Save PDF
      doc.save(`quotation-${quoteNumber}.pdf`)
      showToast('Quotation PDF downloaded successfully!', 'success')
    } catch (error) {
      console.error('Error generating PDF:', error)
      showToast('Failed to generate PDF quotation', 'error')
    }
  }

  const handleNextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      // Section 1: Validate taker type is selected
      if (!formData.takerType) {
        showToast('Please select First Time Taker or Retaker', 'error')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate client details
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobileNumber) {
        showToast('Please fill in all client details', 'error')
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Validate payment type
      if (!formData.paymentType) {
        showToast('Please select a payment type', 'error')
        return
      }
      // Submit the form
      handleSubmitQuote()
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmitQuote = async () => {
    setGenerating(true)
    setError('')

    try {
      const description = formData.lineItems.map(item => 
        `${item.description} (Qty: ${item.quantity})`
      ).join('; ')
      
      const clientName = `${formData.firstName} ${formData.lastName}`
      
      const quote = await quotationsAPI.createPublic(
        formData.total,
        description,
        formData.email,
        clientName,
        formData.service,
        formData.state,
        formData.paymentType || undefined,
        formData.lineItems,
        formData.firstName,
        formData.lastName,
        formData.email,
        formData.mobileNumber,
        formData.takerType || undefined
      )
      // Check expiration for new quote (should be false for new quotes)
      const typedNewQuote = quote as { id?: string; created_at?: string } | null
      if (!typedNewQuote) return
      const expired = checkExpiration(typedNewQuote as any)
      setIsExpired(expired)
      
      setGeneratedQuote(typedNewQuote as any)
      setViewingQuote(typedNewQuote as any)
      setCurrentStep(4) // Show result
      setShowPreloader(true)
      // Navigate to the quote view with the formatted GQ quote ID
      const formattedId = formatQuoteId(typedNewQuote.id || '')
      navigate(`/quote/${formattedId}`, { replace: false })
      // Show preloader for 3 seconds before displaying quote and showing toast
      setTimeout(() => {
        setShowPreloader(false)
        showToast('Quotation generated successfully!', 'success')
      }, 3000)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate quotation'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          {user && <Sidebar />}
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
            </div>
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

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: quoteId ? `Quote #${formatQuoteId(quoteId)}` : 'Quotations', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SEO
        title={quoteId ? `Quote #${formatQuoteId(quoteId)} - GritSync | NCLEX Processing Agency` : 'Get a Quote - NCLEX Processing Services | GritSync'}
        description={quoteId ? `View your NCLEX processing quotation #${formatQuoteId(quoteId)}. Get transparent pricing for NCLEX application processing services.` : 'Get instant, transparent quotes for NCLEX application processing. No hidden fees, clear pricing upfront. Calculate your NCLEX processing costs with GritSync.'}
        keywords="NCLEX quote, NCLEX pricing, NCLEX cost, NCLEX processing fee, quotation, NCLEX service cost, nursing application pricing"
        canonicalUrl={currentUrl}
        ogTitle={quoteId ? `Quote #${formatQuoteId(quoteId)} - GritSync` : 'Get a Quote - NCLEX Processing Services | GritSync'}
        ogDescription={quoteId ? `View your NCLEX processing quotation #${formatQuoteId(quoteId)}` : 'Get instant, transparent quotes for NCLEX application processing. No hidden fees.'}
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('NCLEX Processing Quotation', 'Get instant quotes for NCLEX application processing services with transparent pricing'),
        ]}
      />
      <Header />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1">
          {/* Banner Section */}
          <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
            <div className="container mx-auto px-4 py-12 md:py-16">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                  <DollarSign className="h-4 w-4" />
                  <span>Get Instant Quotes</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  NCLEX Processing Quotation
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                  Get transparent, instant quotes for your NCLEX application processing. No hidden fees, clear pricing upfront.
                </p>
                {user && !isAdmin() && (
                  <Link to="/quotations/new">
                    <Button size="lg" className="text-lg px-8 py-6">
                      <Plus className="h-5 w-5 mr-2" />
                      Create New Quotation
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* Content Section */}
          <div className="p-4 md:p-8">

          {/* Show quote result if quote exists (for both logged-in and non-logged-in users) */}
          {(generatedQuote || viewingQuote) ? (
            <>
              {/* Preloader Animation - Fast Cycling */}
              {showPreloader && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
                  <div className="flex flex-col items-center gap-8">
                    {/* Fast Cycling Multi-Ring Animation */}
                    <div className="relative w-24 h-24">
                      {/* Outer ring - fastest */}
                      <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin" style={{ animationDuration: '0.3s' }}></div>
                      {/* Middle ring - medium speed */}
                      <div className="absolute inset-2 border-4 border-transparent border-r-primary-500 dark:border-r-primary-500 rounded-full animate-spin" style={{ animationDuration: '0.4s', animationDirection: 'reverse' }}></div>
                      {/* Inner ring - slower */}
                      <div className="absolute inset-4 border-4 border-transparent border-b-primary-400 dark:border-b-primary-600 rounded-full animate-spin" style={{ animationDuration: '0.5s' }}></div>
                      {/* Center dot */}
                      <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary-600 dark:bg-primary-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 animate-pulse">
                        Preparing Your Quotation...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                        Please wait a moment
                      </p>
                      {/* Loading dots animation */}
                      <div className="flex items-center justify-center gap-1 mt-4">
                        <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.6s' }}></div>
                        <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></div>
                        <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '0.6s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quote Content - Hidden during preloader */}
              <div className={`flex flex-col items-center py-8 px-4 transition-opacity duration-500 ${showPreloader ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                minHeight: '100vh'
              }}>
                {/* Expiration Banner */}
                {isExpired && expirationDate && (
                  <div className="w-full max-w-[8.5in] mx-auto mb-4 px-2 sm:px-4">
                    <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
                      <div className="p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                            Quotation Expired
                          </h3>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            This quotation expired on {formatDate(expirationDate.toISOString())}. 
                            It is displayed for reference only and is no longer valid for payment.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
                
                {/* Icon Buttons - Top Outside Paper */}
                <div className="w-full max-w-[8.5in] mx-auto mb-4 flex justify-between items-center gap-2 px-2 sm:px-4">
                  <button
                    onClick={() => {
                      setGeneratedQuote(null)
                      setViewingQuote(null)
                      setShowGenerator(true)
                      setCurrentStep(1)
                      setFormData(getInitialFormData())
                      navigate('/quote')
                    }}
                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    title="Back to Create New Quote"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGeneratePDF}
                      className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      title="Download PDF Quote"
                    >
                      <Download className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <button
                      onClick={async () => {
                        const quoteId = generatedQuote?.id || viewingQuote?.id
                        if (!quoteId) return
                        const formattedId = formatQuoteId(quoteId)
                        const quoteLink = `${window.location.origin}/quote/${formattedId}`
                        try {
                          await navigator.clipboard.writeText(quoteLink)
                          setLinkCopied(true)
                          showToast('Quote link copied to clipboard!', 'success')
                          setTimeout(() => setLinkCopied(false), 2000)
                        } catch (err) {
                          showToast('Failed to copy link', 'error')
                        }
                      }}
                      className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      title="Copy Link"
                    >
                      {linkCopied ? (
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Letter-Sized Paper Container */}
                <div className="w-full max-w-[8.5in] mx-auto px-2 sm:px-4" style={{
                  width: '100%',
                  maxWidth: '8.5in'
                }}>
                  {/* Letter-Style Header - Bond Paper Look */}
                  <Card 
                    id="quote-paper-container"
                    className="bg-[#fefefe] dark:bg-gray-900 shadow-2xl overflow-hidden" 
                    style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,0.03) 24px, rgba(0,0,0,0.03) 25px)',
                    backgroundSize: '100% 25px',
                    backgroundPosition: '0 0',
                    width: '100%',
                    height: 'auto',
                    minHeight: '11in',
                    maxHeight: 'none',
                    maxWidth: '8.5in',
                    margin: '0 auto',
                    border: '4px solid #374151',
                    borderRadius: '0',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.05)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                {/* Professional Letter Header */}
                <div className="border-b border-gray-300 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 px-4 pt-2 pb-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="logo-container">
                        <img 
                          src="/gritsync_logo.png" 
                          alt="GritSync Logo" 
                          className="rounded-lg w-8 h-8"
                        />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          <span className="text-gray-900 dark:text-white">GRIT</span>
                          <span className="text-red-600 dark:text-red-400">SYNC</span>
                        </h2>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          NCLEX Application Processing Services
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        Quotation #{formatQuoteId((generatedQuote || viewingQuote)?.id)}
                      </div>
                      {(() => {
                        const quoteDate = (generatedQuote || viewingQuote)?.created_at 
                          ? new Date((generatedQuote || viewingQuote)!.created_at)
                          : new Date()
                        const expiryDate = expirationDate || (() => {
                          const exp = new Date(quoteDate)
                          exp.setDate(exp.getDate() + 30)
                          return exp
                        })()
                        return (
                          <div className={`text-xs ${isExpired ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                            {isExpired ? (
                              <span className="flex items-center justify-end gap-1">
                                <X className="h-3 w-3" />
                                Expired: {formatDate(expiryDate.toISOString())}
                              </span>
                            ) : (
                              `Valid until: ${formatDate(expiryDate.toISOString())}`
                            )}
                          </div>
                        )
                      })()}
                      <div className="flex items-center justify-end gap-1">
                        <Mail className="h-2.5 w-2.5" />
                        <span>info@gritsync.com</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-2 flex-1" style={{ minHeight: 0 }}>
                  {/* Letter Header */}
                  <div className="mb-1.5 pb-1 border-b border-gray-300 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 mb-1.5">
                      <div className="flex-1">
                        <h1 className="text-base font-serif font-bold text-gray-900 dark:text-gray-100 mb-0.5" style={{ letterSpacing: '0.3px' }}>
                          Your Personalized Quotation
                        </h1>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-0.5">
                            <Calendar className="h-2 w-2" />
                            <span>{formatDate((generatedQuote || viewingQuote)?.created_at || '')}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Building2 className="h-2 w-2" />
                            <span>{formData.service} - {formData.state}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quote Content Summary */}
                  <div className="pt-0.5 mb-1">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-serif leading-relaxed">
                        Dear <span className="font-semibold">{formData.firstName || 'Valued Client'}</span>,
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-serif leading-relaxed">
                        Thank you for your interest in our services. We are delighted to present your personalized quotation for <span className="font-semibold">{formData.service} - {formData.state}</span>. 
                        Please find the detailed breakdown below.
                      </p>
                      {formData.paymentType === 'staggered' && (
                        <p className="text-xs text-primary-700 dark:text-primary-300 font-serif leading-relaxed font-semibold">
                          To initiate the process, you only need to pay the Step 1 fee amounting to{' '}
                          <span className="font-bold">
                            {formatCurrency(
                              formData.lineItems
                                .filter(item => !item.payLater)
                                .reduce((sum, item) => sum + item.total + (item.taxable ? item.total * TAX_RATE : 0), 0)
                            )}
                          </span>.
                        </p>
                      )}
                      {formData.paymentType === 'full' && formData.takerType === 'first-time' && (
                        <p className="text-xs text-primary-700 dark:text-primary-300 font-serif leading-relaxed font-semibold">
                          To initiate the process, you need to pay the full amount of{' '}
                          <span className="font-bold">
                            {formatCurrency(formData.total || (formData.subtotal + formData.tax))}
                          </span>.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Quote Details Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
                    {/* Main Quote Info */}
                    <div className="lg:col-span-2 space-y-1.5">
                      {/* Payment Summary Card */}
                      <Card>
                        <div className="p-1.5">
                          <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1.5 flex items-center gap-1">
                            <DollarSign className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400" />
                            Payment Summary
                          </h3>
                          
                          {formData.paymentType === 'staggered' ? (
                            <div className="space-y-1.5">
                              <div className="p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded border border-primary-200 dark:border-primary-800">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Step 1</span>
                                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                    {formatCurrency(
                                      formData.lineItems
                                        .filter(item => !item.payLater)
                                        .reduce((sum, item) => sum + item.total + (item.taxable ? item.total * TAX_RATE : 0), 0)
                                    )}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Step 2</span>
                                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(
                                      formData.lineItems
                                        .filter(item => item.payLater)
                                        .reduce((sum, item) => sum + item.total + (item.taxable ? item.total * TAX_RATE : 0), 0)
                                    )}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="pt-1 border-t-2 border-gray-300 dark:border-gray-700">
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Total Amount</span>
                                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(
                                      formData.lineItems.reduce((sum, item) => 
                                        sum + item.total + (item.taxable ? item.total * TAX_RATE : 0), 0
                                      )
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded border border-primary-200 dark:border-primary-800">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">Total Amount</span>
                                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                  {formatCurrency(formData.total || (generatedQuote || viewingQuote)?.amount || 0)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Services Breakdown */}
                      {formData.lineItems.length > 0 && (
                        <Card>
                          <div className="p-1.5">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1.5 flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400" />
                              Services & Line Items
                            </h3>
                            
                            {/* Step 1 Items */}
                            {formData.paymentType === 'staggered' && (
                              <div className="mb-1.5">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <div className="h-px flex-1 bg-primary-200 dark:bg-primary-800"></div>
                                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase px-1">
                                    Step 1
                                  </span>
                                  <div className="h-px flex-1 bg-primary-200 dark:bg-primary-800"></div>
                                </div>
                                <div className="space-y-1">
                                  {formData.lineItems.filter(item => !item.payLater).map((item, index) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        <div className="w-6 h-6 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {item.description}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">(Taxable)</span>
                                            )}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.quantity} × {formatCurrency(item.unitPrice)}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-gray-400">+ {formatCurrency(item.unitPrice * TAX_RATE)} tax</span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100 ml-2">
                                        {formatCurrency(item.total)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Step 2 Items (for staggered) */}
                            {formData.paymentType === 'staggered' && formData.lineItems.some(item => item.payLater) && (
                              <div className="mb-1.5">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase px-1">
                                    Step 2
                                  </span>
                                  <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
                                </div>
                                <div className="space-y-1">
                                  {formData.lineItems.filter(item => item.payLater).map((item, index) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-gray-100">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                                            {item.description}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">(Taxable)</span>
                                            )}
                                          </p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {item.quantity} × {formatCurrency(item.unitPrice)}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-gray-400">+ {formatCurrency(item.unitPrice * TAX_RATE)} tax</span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                          {formatCurrency(item.total)}
                                        </span>
                                        {item.taxable && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            + {formatCurrency(item.total * TAX_RATE)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Full Payment Items */}
                            {formData.paymentType === 'full' && (
                              <div className="space-y-1">
                                {formData.lineItems.map((item, index) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="w-6 h-6 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                                        {index + 1}
                                      </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {item.description}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">(Taxable)</span>
                                            )}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.quantity} × {formatCurrency(item.unitPrice)}
                                            {item.taxable && (
                                              <span className="ml-1 text-xs text-gray-400">+ {formatCurrency(item.unitPrice * TAX_RATE)} tax</span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                          {formatCurrency(item.total)}
                                        </span>
                                        {item.taxable && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            + {formatCurrency(item.total * TAX_RATE)}
                                          </div>
                                        )}
                                      </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* Client Info Sidebar */}
                    <div className="space-y-1.5">
                      <Card>
                        <div className="p-1.5">
                          <div className="flex items-center gap-1 mb-1.5">
                            <div className="p-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                              <User className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                              Client Details
                            </h3>
                          </div>
                          <div className="space-y-1">
                            <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wide">Name</p>
                              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {(formData.firstName || formData.lastName) 
                                  ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim()
                                  : 'N/A'}
                              </p>
                            </div>
                            <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wide">Email</p>
                              <div className="flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5 text-gray-400" />
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 break-all">
                                  {formData.email || 'N/A'}
                                </p>
                              </div>
                            </div>
                            {formData.mobileNumber && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wide">Mobile</p>
                                <div className="flex items-center gap-1">
                                  <Phone className="h-2.5 w-2.5 text-gray-400" />
                                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                    {formData.mobileNumber}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* Payment Type Info */}
                      <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <div className="p-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <div className="p-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                              <DollarSign className="h-2 w-2 text-gray-600 dark:text-gray-400" />
                            </div>
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              Payment Type
                            </h3>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {formData.paymentType === 'full' ? 'Full Payment' : 'Staggered Payment'}
                          </p>
                        </div>
                      </Card>

                      {/* Important Info */}
                      <Card className="bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
                        <div className="p-1.5">
                          <div className="flex items-start gap-0.5 mb-1">
                            <Info className="h-2 w-2 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                            <h4 className="text-xs font-bold text-primary-900 dark:text-primary-100">
                              Important Notes
                            </h4>
                          </div>
                          <ul className="text-xs text-primary-800 dark:text-primary-300 space-y-0.5 leading-tight">
                            <li className="flex items-start gap-1">
                              <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                              <span>Quotation ID: #{formatQuoteId(generatedQuote?.id || viewingQuote?.id)}</span>
                            </li>
                            <li className="flex items-start gap-1">
                              <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                              <span>Valid for 30 days</span>
                            </li>
                            <li className="flex items-start gap-1">
                              <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                              <span>All prices in USD</span>
                            </li>
                            <li className="flex items-start gap-1">
                              <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                              <span>Quote may change without prior notice</span>
                            </li>
                          </ul>
                        </div>
                      </Card>

                      {/* Apply Now Card */}
                      <Card className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 border-primary-300 dark:border-primary-700">
                        <div className="p-1.5">
                          <div className="text-center space-y-2">
                            <h4 className="text-xs font-bold text-primary-900 dark:text-primary-100 mb-2">
                              Ready to Get Started?
                            </h4>
                            <p className="text-xs text-primary-800 dark:text-primary-200 mb-3">
                              If you agree with this quotation, click below to apply now.
                            </p>
                            <Link to="/register">
                              <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs py-2">
                                Apply Now
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                 {/* Professional Letter Footer */}
                 <div className="border-t border-gray-300 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 px-2 pt-1.5 pb-1.5 mt-auto">
                   <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                     <div className="flex-1">
                       <div className="flex items-center gap-1 mb-0.5">
                         <div className="logo-container">
                           <img 
                             src="/gritsync_logo.png" 
                             alt="GritSync Logo" 
                             className="rounded-lg w-4 h-4"
                           />
                         </div>
                         <div>
                           <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                             <span className="text-gray-900 dark:text-white">GRIT</span>
                             <span className="text-red-600 dark:text-red-400">SYNC</span>
                           </h3>
                         </div>
                       </div>
                       <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-tight">
                         Thank you for choosing GritSync.
                       </p>
                     </div>
                     <div className="md:text-right">
                       <div className="text-xs text-gray-600 dark:text-gray-400">
                         <div className="flex items-center md:justify-end gap-0.5">
                           <Mail className="h-2 w-2" />
                           <span>info@gritsync.com</span>
                         </div>
                       </div>
                     </div>
                   </div>
                   <div className="mt-0.5 pt-0.5 border-t border-gray-200 dark:border-gray-700">
                     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 text-xs text-gray-500 dark:text-gray-400">
                       <p>© {new Date().getFullYear()} GritSync</p>
                       <div className="flex flex-wrap gap-0.5">
                         <span>ID: #{formatQuoteId(generatedQuote?.id || viewingQuote?.id)}</span>
                         <span>•</span>
                         <span>Valid 30 days</span>
                       </div>
                     </div>
                   </div>
                 </div>
              </Card>
                </div>
                
              </div>
            </>
          ) : !user ? (
            // Non-logged-in user: Show generator or empty state
            <div className="max-w-7xl mx-auto space-y-6">
              {!showGenerator ? (
                <Card>
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-primary-600 dark:text-primary-400 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                      Professional Quotation Generator
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                      Create professional, downloadable quotations with detailed line items, pricing, and terms. 
                      Generate PDF quotes instantly for your clients.
                    </p>
                    <Button size="lg" onClick={() => {
                      setShowGenerator(true)
                      setCurrentStep(1)
                    }}>
                      <Plus className="h-5 w-5 mr-2" />
                      Create New Quotation
                    </Button>
                  </div>
                </Card>
              ) : (
                // Show generator steps for non-logged-in users
                <div className="max-w-3xl mx-auto">
                  {/* Progress Indicator */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                              currentStep > step
                                ? 'bg-primary-600 text-white'
                                : currentStep === step
                                ? 'bg-primary-600 text-white ring-4 ring-primary-200 dark:ring-primary-800'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {currentStep > step ? (
                                <CheckCircle className="h-6 w-6" />
                              ) : (
                                step
                              )}
                            </div>
                            <div className={`mt-2 text-xs font-medium ${
                              currentStep >= step
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {step === 1 ? 'Service' : step === 2 ? 'Client Details' : 'Payment'}
                            </div>
                          </div>
                          {step < 3 && (
                            <div className={`flex-1 h-1 mx-2 ${
                              currentStep > step
                                ? 'bg-primary-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 1: Select Service */}
                  {currentStep === 1 && (
                    <Card>
                      <div className="py-6">
                        <div className="flex items-center gap-2 mb-6">
                          <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Section 1: Select Service
                          </h2>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Service
                            </label>
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100">
                              {formData.service}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              State
                            </label>
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100">
                              {formData.state}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Taker Type *
                            </label>
                            <div className="space-y-3">
                              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                formData.takerType === 'first-time'
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    name="takerType"
                                    value="first-time"
                                    checked={formData.takerType === 'first-time'}
                                    onChange={(e) => {
                                      updateFormField('takerType', e.target.value)
                                      // Reset payment type when taker type changes
                                      updateFormField('paymentType', null)
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                                      First Time Taker
                                    </div>
                                  </div>
                                </div>
                              </label>
                              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                formData.takerType === 'retaker'
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    name="takerType"
                                    value="retaker"
                                    checked={formData.takerType === 'retaker'}
                                    onChange={(e) => {
                                      updateFormField('takerType', e.target.value)
                                      // Reset payment type when taker type changes
                                      updateFormField('paymentType', null)
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                                      Retaker
                                    </div>
                                  </div>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end mt-6">
                          <Button onClick={handleNextStep}>
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Section 2: Client Details */}
                  {currentStep === 2 && (
                    <Card>
                      <div className="py-6">
                        <div className="flex items-center gap-2 mb-6">
                          <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Section 2: Enter Client Details
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label="First Name *"
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => updateFormField('firstName', e.target.value)}
                            placeholder="John"
                            required
                          />
                          <Input
                            label="Last Name *"
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => updateFormField('lastName', e.target.value)}
                            placeholder="Doe"
                            required
                          />
                          <Input
                            label="Email *"
                            type="email"
                            value={formData.email}
                            onChange={(e) => updateFormField('email', e.target.value)}
                            placeholder="client@example.com"
                            required
                          />
                          <Input
                            label="Mobile Number *"
                            type="tel"
                            value={formData.mobileNumber}
                            onChange={(e) => updateFormField('mobileNumber', e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            required
                          />
                        </div>
                        <div className="flex justify-between mt-6">
                          <Button variant="outline" onClick={handlePreviousStep}>
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            Previous
                          </Button>
                          <Button onClick={handleNextStep}>
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Section 3: Payment Type */}
                  {currentStep === 3 && (
                    <Card>
                      <div className="py-6">
                        <div className="flex items-center gap-2 mb-6">
                          <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Section 3: Select Payment Type
                          </h2>
                        </div>
                        <div className="space-y-4">
                          {/* First Time Taker: Show both Full and Staggered Payment */}
                          {formData.takerType === 'first-time' && (
                            <>
                              {/* Full Payment Option */}
                              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                formData.paymentType === 'full'
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    name="paymentType"
                                    value="full"
                                    checked={formData.paymentType === 'full'}
                                    onChange={(e) => updateFormField('paymentType', e.target.value)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                      Full Payment
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                      Pay for both steps upfront:
                                    </div>
                                    <div className="text-sm space-y-1 ml-6">
                                      <div><strong>Step 1:</strong> {formatCurrency(serviceConfig.step1.total)}</div>
                                      <div><strong>Step 2:</strong> {formatCurrency(serviceConfig.step2.total)}</div>
                                      <div className="font-semibold text-primary-600 dark:text-primary-400 mt-2">
                                        Total: {formatCurrency(serviceConfig.step1.total + serviceConfig.step2.total)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </label>

                              {/* Staggered Payment Option */}
                              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                formData.paymentType === 'staggered'
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    name="paymentType"
                                    value="staggered"
                                    checked={formData.paymentType === 'staggered'}
                                    onChange={(e) => updateFormField('paymentType', e.target.value)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                      Staggered Payment
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                      Pay Step 1 now, Step 2 later:
                                    </div>
                                    <div className="text-sm space-y-1 ml-6">
                                      <div><strong>Step 1:</strong> {formatCurrency(serviceConfig.step1.total)} (Pay Now)</div>
                                      <div><strong>Step 2:</strong> {formatCurrency(serviceConfig.step2.total)} (Pay later)</div>
                                      <div className="mt-2 space-y-1">
                                        <div className="font-semibold text-primary-600 dark:text-primary-400">
                                          Pay Now: {formatCurrency(serviceConfig.step1.total)}
                                        </div>
                                        <div className="text-gray-900 dark:text-gray-100">
                                          Pay Later: {formatCurrency(serviceConfig.step2.total)}
                                        </div>
                                        <div className="font-semibold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-300 dark:border-gray-600">
                                          Total: {formatCurrency(serviceConfig.step1.total + serviceConfig.step2.total)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </label>
                            </>
                          )}

                          {/* Retaker: Only Full Payment, Step 2 only */}
                          {formData.takerType === 'retaker' && (
                            <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              formData.paymentType === 'full'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                            }`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  name="paymentType"
                                  value="full"
                                  checked={formData.paymentType === 'full'}
                                  onChange={(e) => updateFormField('paymentType', e.target.value)}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    Full Payment
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Pay Step 2 only (Retaker):
                                  </div>
                                  <div className="text-sm space-y-1 ml-6">
                                    <div><strong>Step 2:</strong> {formatCurrency(serviceConfig.step2.total)}</div>
                                    <div className="font-semibold text-primary-600 dark:text-primary-400 mt-2">
                                      Total: {formatCurrency(serviceConfig.step2.total)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </label>
                          )}
                        </div>

                        {/* Show selected items */}
                        {formData.lineItems.length > 0 && (
                          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Selected Services:</h3>
                            <div className="space-y-3">
                              {/* Step 1 Items (Pay Now) */}
                              {formData.paymentType === 'staggered' && (
                                <div>
                                  <h4 className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2 uppercase">Step 1 - Pay Now:</h4>
                                  <div className="space-y-2 ml-4">
                                    {formData.lineItems.filter(item => !item.payLater).map((item) => (
                                      <div key={item.id} className="flex justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                                        <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Step 2 Items (Pay Later) - Only for staggered payment */}
                              {formData.paymentType === 'staggered' && formData.lineItems.some(item => item.payLater) && (
                                <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                                  <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase">Step 2 - Pay Later (For Reference):</h4>
                                  <div className="space-y-2 ml-4">
                                    {formData.lineItems.filter(item => item.payLater).map((item) => (
                                      <div key={item.id} className="flex justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                                        <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 ml-4 text-xs text-gray-900 dark:text-gray-100 font-medium">
                                    Step 2 Total: {formatCurrency(
                                      formData.lineItems
                                        .filter(item => item.payLater)
                                        .reduce((sum, item) => sum + item.total, 0)
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Full Payment - Show all items normally */}
                              {formData.paymentType === 'full' && (
                                <div className="space-y-2">
                                  {formData.lineItems.map((item) => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                      <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                                      <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {formData.paymentType === 'staggered' ? (
                              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Pay Now:
                                  </span>
                                  <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                    {formatCurrency(
                                      formData.lineItems
                                        .filter(item => !item.payLater)
                                        .reduce((sum, item) => sum + item.total, 0)
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-900 dark:text-gray-100">Pay Later:</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {formatCurrency(
                                      formData.lineItems
                                        .filter(item => item.payLater)
                                        .reduce((sum, item) => sum + item.total, 0)
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t-2 border-primary-200 dark:border-primary-800">
                                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Total:
                                  </span>
                                  <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                    {formatCurrency(
                                      formData.lineItems.reduce((sum, item) => sum + item.total, 0)
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                  Total:
                                </span>
                                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                  {formatCurrency(formData.total)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {error && (
                          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
                            {error}
                          </div>
                        )}

                        <div className="flex justify-between mt-6">
                          <Button variant="outline" onClick={handlePreviousStep} disabled={generating}>
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            Previous
                          </Button>
                          <Button onClick={handleNextStep} disabled={generating || !formData.paymentType}>
                            {generating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 mr-2" />
                                Submit
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Result Section (Step 4) */}
                  {currentStep === 4 && (generatedQuote || viewingQuote) && (
                    <div className="space-y-6">
                      {/* Copy Link Button for Letter View */}
                      <Card className="bg-gray-50 dark:bg-gray-800">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                Share this quotation
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Copy the link to share or view later
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const quoteId = ((generatedQuote || viewingQuote) as { id?: string } | null)?.id
                              if (!quoteId) return
                              const formattedId = formatQuoteId(quoteId)
                              const quoteLink = `${window.location.origin}/quote/${formattedId}`
                              try {
                                await navigator.clipboard.writeText(quoteLink)
                                setLinkCopied(true)
                                showToast('Quote link copied to clipboard!', 'success')
                                setTimeout(() => setLinkCopied(false), 2000)
                              } catch (err) {
                                showToast('Failed to copy link', 'error')
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                            title="Copy quote link"
                          >
                            {linkCopied ? (
                              <>
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </Card>
                      
                      {/* Letter-Sized Paper View - This is handled in the main quote result section above */}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : user ? (
            // Logged-in user: Show quotations list
            quotations.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No quotations found
                  </p>
                  {!isAdmin() && (
                    <Link to="/quotations/new">
                      <Button>Generate Quotation</Button>
                    </Link>
                  )}
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {quotations.map((quote) => (
                <Card key={quote.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(quote.amount)}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            quote.status === 'paid'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          }`}
                        >
                          {quote.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {quote.description}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Created: {formatDate(quote.created_at)}
                      </p>
                    </div>
                    {quote.status === 'pending' && !isAdmin() && (
                      <Link to={`/quotations/${quote.id}/pay`}>
                        <Button size="sm">Pay Now</Button>
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
              </div>
            )
          ) : null}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
