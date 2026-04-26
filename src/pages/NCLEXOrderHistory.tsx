import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useState } from 'react'
import { ShoppingBag, Crown, Zap, CheckCircle, Clock, AlertCircle } from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

export function NCLEXOrderHistory() {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/questions/subscription/me', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
      fetch('/api/questions/payment-info').then(r => r.json()),
    ]).then(([sub, pay]) => {
      if (sub.status === 'fulfilled') setSubscription(sub.value)
      if (pay.status === 'fulfilled') setPaymentInfo(pay.value)
      setLoading(false)
    })
  }, [])

  const plan = subscription?.plan || 'free'
  const expiresAt = subscription?.expires_at
  const isActive = subscription?.status === 'active' || plan === 'free'

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#17c3b2]" /> Order History
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your NCLEX subscription history and billing details</p>
        </div>

        {/* Current plan */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${
          plan === 'vip' ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' :
          plan === 'premium' ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10' :
          'border-gray-200 bg-white dark:bg-gray-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                plan === 'vip' ? 'bg-amber-100 dark:bg-amber-800' :
                plan === 'premium' ? 'bg-blue-100 dark:bg-blue-800' :
                'bg-gray-100 dark:bg-gray-800'
              }`}>
                {plan === 'vip' ? <Crown className="h-6 w-6 text-amber-500" /> :
                 plan === 'premium' ? <Zap className="h-6 w-6 text-blue-500" /> :
                 <ShoppingBag className="h-6 w-6 text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">
                  {plan === 'vip' ? 'VIP Plan' : plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isActive ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                      <AlertCircle className="h-3 w-3" /> Expired
                    </span>
                  )}
                  {expiresAt && (
                    <span className="text-xs text-gray-500">
                      · {plan === 'free' ? '' : isActive ? 'Expires' : 'Expired'} {new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {plan === 'free' && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Daily limit</p>
                <p className="font-bold text-gray-900 dark:text-white">25 questions</p>
              </div>
            )}
            {plan !== 'free' && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Questions</p>
                <p className="font-bold text-gray-900 dark:text-white">Unlimited</p>
              </div>
            )}
          </div>
        </div>

        {/* Placeholder orders table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Payment History</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Loading...</div>
          ) : plan === 'free' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <ShoppingBag className="h-10 w-10 opacity-30" />
              <p className="text-sm">No purchase history yet.</p>
              <p className="text-xs max-w-xs text-center">Upgrade to Premium or VIP to unlock full Q-Bank access.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-5 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Valid Until</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Payment</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {plan === 'vip' ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-blue-500" />}
                      <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{plan} Plan</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No expiry'}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Activated by admin
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* How to pay */}
        {paymentInfo && (
          <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">How to Upgrade</h2>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
              <li>Choose your plan: <strong>Premium (₱250 / 2 months)</strong> or <strong>VIP (₱500 / 6 months)</strong></li>
              <li>Send payment via GCash or Maya:</li>
            </ol>
            <div className="mt-3 ml-5 space-y-1">
              {paymentInfo.accounts?.map((a: any) => (
                <p key={a.method} className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {a.method}: <span className="font-black">{a.number}</span> ({a.name})
                </p>
              ))}
            </div>
            <ol className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside" start={3}>
              <li>Send proof of payment and your registered email to our admin</li>
              <li>Your plan will be activated within 24 hours</li>
            </ol>
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
