import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useState } from 'react'
import { FileText, Download, Lock, Search, Crown, BookOpen } from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

const CHEAT_SHEETS = [
  { title: 'Lab Values Cheat Sheet', category: 'Fundamentals', pages: 4, hot: true },
  { title: 'EKG / ECG Quick Reference', category: 'Cardiac', pages: 2, hot: true },
  { title: 'Medication Safety Rights', category: 'Pharmacology', pages: 1, hot: false },
  { title: 'NCLEX-RN Content Areas & Weights', category: 'Study Guide', pages: 3, hot: true },
  { title: 'Acid-Base Balance (ABGs)', category: 'Respiratory', pages: 2, hot: false },
  { title: 'Fluid & Electrolytes Summary', category: 'Fundamentals', pages: 3, hot: true },
  { title: 'Wound & Dressing Types', category: 'Skin/Wound', pages: 2, hot: false },
  { title: 'Pediatric Growth & Development', category: 'Pediatrics', pages: 3, hot: false },
  { title: 'Therapeutic Communication Phrases', category: 'Psych', pages: 1, hot: false },
  { title: 'Antepartum Warning Signs', category: 'OB', pages: 2, hot: false },
  { title: 'Neurological Assessment (GCS)', category: 'Neuro', pages: 1, hot: false },
  { title: 'Priority & Delegation Framework', category: 'Management', pages: 2, hot: true },
  { title: 'NGN Clinical Judgment Model', category: 'NGN/NCLEX', pages: 4, hot: true },
  { title: 'Pain Assessment Scales', category: 'Fundamentals', pages: 1, hot: false },
  { title: 'Infection Control Precautions', category: 'Safety', pages: 2, hot: false },
]

const CATEGORIES = ['All', ...Array.from(new Set(CHEAT_SHEETS.map(s => s.category)))]

export function NCLEXCheatSheets() {
  const [subscription, setSubscription] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    fetch('/api/questions/subscription/me', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(setSubscription)
      .catch(() => {})
  }, [])

  const plan = subscription?.plan || 'free'
  const hasAccess = plan === 'premium' || plan === 'vip'

  const filtered = CHEAT_SHEETS.filter(s => {
    const matchSearch = search === '' || s.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || s.category === category
    return matchSearch && matchCat
  })

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#17c3b2]" /> Cheat Sheets
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Quick-reference guides for NCLEX success</p>
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cheat sheets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#17c3b2]"
            />
          </div>
        </div>

        {!hasAccess && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0d2137] to-[#163352] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <Crown className="h-6 w-6 text-[#17c3b2] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Unlock all {CHEAT_SHEETS.length} cheat sheets</p>
                <p className="text-sm text-white/70 mt-0.5">Premium & VIP members can download all PDF study guides.</p>
              </div>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                category === cat
                  ? 'bg-[#17c3b2] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(sheet => (
            <div key={sheet.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#17c3b2]/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-[#17c3b2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug flex-1">{sheet.title}</h3>
                    {sheet.hot && (
                      <span className="flex-shrink-0 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">HOT</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{sheet.category} · {sheet.pages} pages</p>
                </div>
              </div>
              <button
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  hasAccess
                    ? 'bg-[#17c3b2] text-white hover:bg-[#14a99a]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
                disabled={!hasAccess}
              >
                {hasAccess ? <><Download className="h-3.5 w-3.5" /> Download PDF</> : <><Lock className="h-3.5 w-3.5" /> Upgrade to Download</>}
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm">No cheat sheets found matching "{search}"</p>
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
