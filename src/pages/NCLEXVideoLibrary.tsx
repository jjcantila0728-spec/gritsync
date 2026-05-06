import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Video, Lock, Play, Clock, Search, Crown } from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

const VIDEO_CATEGORIES = [
  {
    name: 'Fundamentals of Nursing',
    count: 12,
    topics: ['Infection Control', 'Vital Signs', 'Medication Administration', 'Patient Safety'],
  },
  {
    name: 'Medical-Surgical Nursing',
    count: 24,
    topics: ['Cardiovascular', 'Respiratory', 'Neurological', 'Gastrointestinal', 'Renal'],
  },
  {
    name: 'Pharmacology',
    count: 18,
    topics: ['Cardiovascular Drugs', 'Antibiotics', 'Pain Management', 'Psychiatric Medications'],
  },
  {
    name: 'Maternal & Newborn',
    count: 10,
    topics: ['Antepartum Care', 'Intrapartum', 'Postpartum', 'Newborn Assessment'],
  },
  {
    name: 'Mental Health Nursing',
    count: 8,
    topics: ['Therapeutic Communication', 'Mood Disorders', 'Anxiety', 'Psychotic Disorders'],
  },
  {
    name: 'Pediatric Nursing',
    count: 9,
    topics: ['Growth & Development', 'Pediatric Conditions', 'Pain Assessment', 'Family Care'],
  },
  {
    name: 'NGN Next Generation NCLEX',
    count: 15,
    topics: ['Clinical Judgment Model', 'Case Studies', 'SATA Strategies', 'Matrix Questions'],
  },
]

export function NCLEXVideoLibrary() {
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<any>(null)
  const [search, setSearch] = useState('')

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

  const filtered = VIDEO_CATEGORIES.filter(c =>
    search === '' || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.topics.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-[#17c3b2]" /> Video Library
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {VIDEO_CATEGORIES.reduce((s, c) => s + c.count, 0)}+ NCLEX prep videos across all content areas
            </p>
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search videos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#17c3b2]"
            />
          </div>
        </div>

        {!hasAccess && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0d2137] to-[#163352] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#17c3b2]/20 flex items-center justify-center flex-shrink-0">
                <Crown className="h-5 w-5 text-[#17c3b2]" />
              </div>
              <div>
                <p className="font-bold">Premium & VIP members get full video access</p>
                <p className="text-sm text-white/70 mt-0.5">Upgrade to unlock {VIDEO_CATEGORIES.reduce((s, c) => s + c.count, 0)}+ nursing videos.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/', { state: { openUpgrade: true } })}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-[#17c3b2] text-white text-sm font-bold hover:bg-[#14a99a] transition-colors">
              Upgrade Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
              {/* Thumbnail */}
              <div className="relative h-36 bg-gradient-to-br from-[#0d2137] to-[#17c3b2]/40 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  {hasAccess ? (
                    <Play className="h-6 w-6 text-white ml-0.5" />
                  ) : (
                    <Lock className="h-5 w-5 text-white/70" />
                  )}
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" /> {cat.count} videos
                </div>
              </div>
              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">{cat.name}</h3>
                <div className="flex flex-wrap gap-1">
                  {cat.topics.slice(0, 3).map(t => (
                    <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                  {cat.topics.length > 3 && (
                    <span className="text-xs text-gray-400">+{cat.topics.length - 3} more</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Video className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm">No videos found matching "{search}"</p>
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
