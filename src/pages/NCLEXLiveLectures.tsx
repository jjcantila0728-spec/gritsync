import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useState } from 'react'
import { Radio, Calendar, Clock, Users, Crown, Bell, Lock, Star } from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

const UPCOMING = [
  {
    title: 'NCLEX-RN Cardiovascular Deep Dive',
    instructor: 'RN Educator Team',
    date: 'May 5, 2026',
    time: '7:00 PM PHT',
    duration: '2 hrs',
    registrants: 142,
    live: false,
  },
  {
    title: 'Pharmacology Mastery: High-Alert Drugs',
    instructor: 'GritSync Faculty',
    date: 'May 10, 2026',
    time: '6:00 PM PHT',
    duration: '1.5 hrs',
    registrants: 98,
    live: false,
  },
  {
    title: 'NGN Next Generation NCLEX Strategies',
    instructor: 'RN Educator Team',
    date: 'May 15, 2026',
    time: '7:00 PM PHT',
    duration: '2 hrs',
    registrants: 211,
    live: false,
  },
  {
    title: 'Mental Health Nursing NCLEX Prep',
    instructor: 'GritSync Faculty',
    date: 'May 20, 2026',
    time: '6:30 PM PHT',
    duration: '1.5 hrs',
    registrants: 87,
    live: false,
  },
  {
    title: 'OB/Maternal Nursing Essentials',
    instructor: 'RN Educator Team',
    date: 'May 25, 2026',
    time: '7:00 PM PHT',
    duration: '2 hrs',
    registrants: 76,
    live: false,
  },
]

const PAST = [
  { title: 'NCLEX-RN Review: Respiratory System', date: 'Apr 20, 2026', duration: '2 hrs', views: 534 },
  { title: 'Fundamentals: Infection Control & Safety', date: 'Apr 12, 2026', duration: '1.5 hrs', views: 412 },
  { title: 'Pediatric Nursing High-Yield Topics', date: 'Apr 5, 2026', duration: '2 hrs', views: 389 },
]

export function NCLEXLiveLectures() {
  const [subscription, setSubscription] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    fetch('/api/questions/subscription/me', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(setSubscription)
      .catch(() => {})
  }, [])

  const plan = subscription?.plan || 'free'
  const hasAccess = plan === 'vip'

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio className="h-5 w-5 text-[#17c3b2]" /> Live Lectures
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Live NCLEX prep sessions with our faculty team</p>
          </div>
        </div>

        {!hasAccess && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0d2137] to-[#163352] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold">VIP Exclusive Feature</p>
                <p className="text-sm text-white/70 mt-0.5">Live lectures are available for VIP plan members only. Upgrade to join our live sessions.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-5 gap-1">
          {[{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past Recordings' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key ? 'border-[#17c3b2] text-[#17c3b2]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {UPCOMING.map(lecture => (
              <div key={lecture.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col sm:flex-row items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#0d2137] to-[#17c3b2]/40 flex flex-col items-center justify-center flex-shrink-0 text-white">
                  <span className="text-lg font-black leading-none">LIVE</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{lecture.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">Instructor: {lecture.instructor}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" /> {lecture.date}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" /> {lecture.time} · {lecture.duration}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3 w-3" /> {lecture.registrants} registered
                    </span>
                  </div>
                </div>
                <button
                  disabled={!hasAccess}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    hasAccess ? 'bg-[#17c3b2] text-white hover:bg-[#14a99a]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {hasAccess ? <><Bell className="h-3.5 w-3.5" /> Register</> : <><Lock className="h-3.5 w-3.5" /> VIP Only</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'past' && (
          <div className="space-y-4">
            {PAST.map(lecture => (
              <div key={lecture.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col sm:flex-row items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Radio className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{lecture.title}</h3>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" /> {lecture.date}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" /> {lecture.duration}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3 w-3" /> {lecture.views} views
                    </span>
                  </div>
                </div>
                <button
                  disabled={!hasAccess}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    hasAccess ? 'bg-[#17c3b2] text-white hover:bg-[#14a99a]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {hasAccess ? <>Watch Recording</> : <><Lock className="h-3.5 w-3.5" /> VIP Only</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
