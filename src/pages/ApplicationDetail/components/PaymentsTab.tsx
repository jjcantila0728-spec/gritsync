import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { formatDate, formatCurrency } from '@/lib/utils'
import { 
  DollarSign, 
  CreditCard, 
  CheckCircle, 
  Clock,
  Download,
  Eye,
  History
} from 'lucide-react'

interface PaymentsTabProps {
  payments: any[]
  loadingPayments: boolean
  showPaymentModal: boolean
  setShowPaymentModal: (show: boolean) => void
  selectedPayment: any
  setSelectedPayment: (payment: any) => void
  clientSecret: string | null
  paymentIntentId: string | null
  showReceiptModal: boolean
  setShowReceiptModal: (show: boolean) => void
  viewingReceipt: any
  setViewingReceipt: (receipt: any) => void
  isAdmin: boolean
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  application: any
  handleViewReceipt: (payment: any) => void
  handleDownloadReceipt: (payment: any) => void
  handleProcessPayment: (payment: any) => void
  receipts: { [paymentId: string]: any }
  staggeredService: any
  loadingServices: boolean
  processingPayments: boolean
  handleCreatePayment: (type: 'step1' | 'step2') => void
  calculateItemTax: (item: any) => number
  calculateItemTotal: (item: any) => number
}

export function PaymentsTab({
  payments,
  loadingPayments,
  handleViewReceipt,
  handleDownloadReceipt,
  handleProcessPayment,
  receipts,
  staggeredService,
  loadingServices,
  processingPayments,
  handleCreatePayment,
  calculateItemTax,
  calculateItemTotal
}: PaymentsTabProps) {
  // Compute pending and paid payments
  const pendingPayments = payments.filter((p: any) => p.status === 'pending')
  const paidPayments = payments.filter((p: any) => p.status === 'paid')
  const completedPaymentTypes = paidPayments.map((p: any) => p.payment_type)

  return (
    <div className="space-y-6">
      {loadingPayments ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <>
          {/* Pending Payments Section */}
          {pendingPayments.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Payments Needed
                </h2>
              </div>

              {pendingPayments.length > 0 ? (
                <div className="space-y-4">
                  {pendingPayments.map((payment: any) => (
                    <Card key={payment.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                               payment.payment_type === 'step2' ? 'Step 2 Payment' : 
                               'Full Payment'}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Payment ID: {payment.id}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Created: {formatDate(payment.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {formatCurrency(payment.amount)}
                          </p>
                          <Button
                            onClick={() => handleProcessPayment(payment)}
                            disabled={processingPayments}
                            className="flex items-center gap-2"
                          >
                            <CreditCard className="h-4 w-4" />
                            Complete Payment
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6">
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No pending payments. All payments are up to date.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Available Payments to Create */}
          {pendingPayments.length === 0 && (
            <Card className="mt-6 p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Create New Payment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Complete your payments in steps. Step 1 must be completed before Step 2.
              </p>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">STEP 1</h4>
                    {completedPaymentTypes.includes('step1') && (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  {loadingServices ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                    </div>
                  ) : staggeredService ? (
                    <>
                      <div className="space-y-2 mb-4">
                        {staggeredService.line_items
                          ?.filter((item: any) => item.step === 1 || !item.step)
                          .map((item: any, idx: number) => {
                            const itemTax = calculateItemTax(item)
                            const itemTotal = calculateItemTotal(item)
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {item.description}
                                    {item.taxable && (
                                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                    )}
                                  </span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {formatCurrency(item.amount)}
                                  </span>
                                </div>
                                {item.taxable && itemTax > 0 && (
                                  <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                    <span>Tax (12%):</span>
                                    <span>{formatCurrency(itemTax)}</span>
                                  </div>
                                )}
                                {item.taxable && (
                                  <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(itemTotal)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                      <div className="space-y-2 mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {formatCurrency((staggeredService.total_step1 || 0) - (staggeredService.tax_step1 || 0))}
                          </span>
                        </div>
                        {staggeredService.tax_step1 && staggeredService.tax_step1 > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {formatCurrency(staggeredService.tax_step1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mb-4">
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(staggeredService.total_step1 || 0)}
                        </span>
                      </div>
                      {!completedPaymentTypes.includes('step1') && (
                        <Button
                          className="w-full"
                          onClick={() => handleCreatePayment('step1')}
                          disabled={processingPayments}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Create Payment for {formatCurrency(staggeredService.total_step1 || 0)}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                      <p>Service pricing not available. Please contact support.</p>
                    </div>
                  )}
                </div>

                {/* Step 2 */}
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">STEP 2</h4>
                    {completedPaymentTypes.includes('step2') && (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  {loadingServices ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                    </div>
                  ) : staggeredService ? (
                    <>
                      <div className="space-y-2 mb-4">
                        {staggeredService.line_items
                          ?.filter((item: any) => item.step === 2)
                          .map((item: any, idx: number) => {
                            const itemTax = calculateItemTax(item)
                            const itemTotal = calculateItemTotal(item)
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {item.description}
                                    {item.taxable && (
                                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                    )}
                                  </span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {formatCurrency(item.amount)}
                                  </span>
                                </div>
                                {item.taxable && itemTax > 0 && (
                                  <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                    <span>Tax (12%):</span>
                                    <span>{formatCurrency(itemTax)}</span>
                                  </div>
                                )}
                                {item.taxable && (
                                  <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(itemTotal)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                      <div className="space-y-2 mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {formatCurrency((staggeredService.total_step2 || 0) - (staggeredService.tax_step2 || 0))}
                          </span>
                        </div>
                        {staggeredService.tax_step2 && staggeredService.tax_step2 > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {formatCurrency(staggeredService.tax_step2)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mb-4">
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(staggeredService.total_step2 || 0)}
                        </span>
                      </div>
                      {!completedPaymentTypes.includes('step2') && (
                        <Button
                          className="w-full"
                          onClick={() => handleCreatePayment('step2')}
                          disabled={processingPayments || !completedPaymentTypes.includes('step1')}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Create Payment for {formatCurrency(staggeredService.total_step2 || 0)}
                        </Button>
                      )}
                      {!completedPaymentTypes.includes('step1') && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                          Complete Step 1 first
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                      <p>Service pricing not available. Please contact support.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Paid Payments Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Paid Payments
              </h2>
            </div>

            {paidPayments.length > 0 ? (
              <div className="space-y-4">
                {paidPayments.map((payment: any) => (
                  <Card key={payment.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                             payment.payment_type === 'step2' ? 'Step 2 Payment' : 
                             'Full Payment'}
                          </h3>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p>Payment ID: {payment.id}</p>
                          {payment.transaction_id && (
                            <p>Transaction ID: <span className="font-mono">{payment.transaction_id}</span></p>
                          )}
                          <p>Paid: {formatDate(payment.updated_at || payment.created_at)}</p>
                          {payment.payment_method && (
                            <p>Method: {payment.payment_method}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                          {formatCurrency(payment.amount)}
                        </p>
                        {receipts[payment.id] && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReceipt(payment.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Receipt
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadReceipt(receipts[payment.id])}
                              className="flex items-center gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6">
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No paid payments yet.
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Payment History Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Payment History
              </h2>
            </div>

            {(() => {
              // Filter out only 'pending' status (payment requests) - show paid, pending_approval, failed, cancelled
              const historyPayments = payments.filter((p: any) => p.status !== 'pending')
              return historyPayments.length > 0 ? (
              <Card className="p-3 sm:p-6">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPayments.map((payment: any) => (
                        <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(payment.created_at)}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                            {payment.payment_type === 'step1' ? 'Step 1' : 
                             payment.payment_type === 'step2' ? 'Step 2' : 
                             'Full'}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              payment.status === 'paid' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                : payment.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {payment.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                              {payment.status === 'pending' && <Clock className="h-3 w-3" />}
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {payment.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleProcessPayment(payment)}
                                  disabled={processingPayments}
                                  className="text-xs"
                                >
                                  Complete
                                </Button>
                              )}
                              {payment.status === 'paid' && receipts[payment.id] && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewReceipt(payment.id)}
                                    className="text-xs flex items-center gap-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Receipt
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadReceipt(receipts[payment.id])}
                                    className="text-xs flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No payment history available.
                  </p>
                </div>
              </Card>
            )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
