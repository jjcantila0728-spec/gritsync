import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Logo } from './Logo'
import { Moon, Sun, LogOut, Menu, X, ChevronDown, Settings, UserCircle, Bell } from 'lucide-react'
import { Button } from './ui/Button'
import { MobileSidebar } from './Sidebar'
import { cn } from '@/lib/utils'
import { getInitials, getAvatarColor, getAvatarColorDark, getAvatarTextColor, getAvatarTextColorDark } from '@/lib/avatar'
import { userDetailsAPI, notificationsAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { getSignedFileUrl } from '@/lib/supabase-api'
import { supabase } from '@/lib/supabase'
import { subscribeToNotifications, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function Header() {
  const { user, signOut, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false)
  
  // Refs must be declared before useState that uses them
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const exploreMenuRef = useRef<HTMLDivElement>(null)
  const notificationChannelRef = useRef<RealtimeChannel | null>(null)
  const avatarPathRef = useRef<string | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const avatarImageRef = useRef<HTMLImageElement | null>(null)
  const isFetchingAvatarRef = useRef(false)
  const persistedFirstNameRef = useRef<string | null>(null)

  // Load firstName from cache on mount
  const getCachedFirstName = (userId: string | undefined): string | null => {
    if (!userId) return null
    try {
      const cached = localStorage.getItem(`firstName_${userId}`)
      if (cached) {
        return cached
      }
    } catch {
      // Ignore errors
    }
    return null
  }

  // Initialize firstName from cache if available
  const [firstName, setFirstName] = useState<string | null>(() => {
    const cached = getCachedFirstName(user?.id)
    if (cached) {
      persistedFirstNameRef.current = cached
      return cached
    }
    return null
  })
  const [fullName, setFullName] = useState<string | null>(null)

  // Helper to set firstName and cache it
  const setFirstNameWithCache = (name: string | null, userId: string | undefined) => {
    setFirstName(name)
    if (name) {
      persistedFirstNameRef.current = name
      if (userId) {
        try {
          localStorage.setItem(`firstName_${userId}`, name)
        } catch {
          // Ignore errors
        }
      }
    }
  }

  // Initialize avatarUrl from cache on mount
  const getCachedAvatar = (userId: string | undefined): { url: string | null; path: string | null } => {
    if (!userId) return { url: null, path: null }
    try {
      const cachedUrl = localStorage.getItem(`avatar_${userId}`)
      const cachedPath = localStorage.getItem(`avatar_path_${userId}`)
      if (cachedUrl && cachedPath) {
        return { url: cachedUrl, path: cachedPath }
      }
    } catch {
      // Ignore errors
    }
    return { url: null, path: null }
  }

  // Get cached default avatar design
  const getCachedDefaultDesign = (userId: string | undefined): string => {
    if (!userId) return 'default'
    try {
      const cached = localStorage.getItem(`default_avatar_design_${userId}`)
      return cached || 'default'
    } catch {
      return 'default'
    }
  }

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    // Initialize from cache if available
    const cached = getCachedAvatar(user?.id)
    if (cached.url && cached.path) {
      avatarPathRef.current = cached.path
      return cached.url
    }
    return null
  })
  
  // State for default avatar design (updated when fetched from DB)
  const [defaultAvatarDesign, setDefaultAvatarDesign] = useState<string>(() => {
    return getCachedDefaultDesign(user?.id)
  })
  
  // Function to get current design from cache - always reads fresh from cache
  // This ensures the design is always consistent and never flickers
  const getCurrentDesign = (): string => {
    if (!user?.id) return 'default'
    // Always read from cache synchronously - this prevents flickering
    // Cache is updated immediately when design changes, so this is always current
    return getCachedDefaultDesign(user.id)
  }
  
  // Update state when fetched from DB, but render always uses getCurrentDesign()
  useEffect(() => {
    if (user?.id) {
      const cached = getCachedDefaultDesign(user.id)
      if (cached !== defaultAvatarDesign) {
        setDefaultAvatarDesign(cached)
      }
    }
  }, [user?.id, defaultAvatarDesign])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  // Helper to cache avatar URL and path
  const cacheAvatar = (userId: string | undefined, url: string, path: string) => {
    if (!userId) return
    try {
      localStorage.setItem(`avatar_${userId}`, url)
      localStorage.setItem(`avatar_path_${userId}`, path)
    } catch (error) {
      // Ignore localStorage errors (quota exceeded, etc.)
      console.warn('Failed to cache avatar:', error)
    }
  }

  // Helper to cache default avatar design
  const cacheDefaultDesign = (userId: string | undefined, design: string) => {
    if (!userId) return
    try {
      localStorage.setItem(`default_avatar_design_${userId}`, design)
    } catch (error) {
      // Ignore localStorage errors
      console.warn('Failed to cache default avatar design:', error)
    }
  }

  // Helper to clear avatar cache
  const clearAvatarCache = (userId: string | undefined) => {
    if (!userId) return
    try {
      localStorage.removeItem(`avatar_${userId}`)
      localStorage.removeItem(`avatar_path_${userId}`)
    } catch {
      // Ignore errors
    }
  }

  // Compute display name synchronously from user object to prevent flickering
  // Use persisted ref and cache as fallback to prevent showing empty during navigation
  const displayFirstName = useMemo(() => {
    // Priority: 1. user.first_name (immediate), 2. firstName state, 3. persisted ref, 4. cache
    let name = user?.first_name || firstName || persistedFirstNameRef.current
    if (!name && user?.id) {
      // Fallback to cache if nothing else is available
      const cached = getCachedFirstName(user.id)
      if (cached) {
        name = cached
        persistedFirstNameRef.current = cached
      }
    }
    // Update ref and cache whenever we have a valid name
    if (name) {
      persistedFirstNameRef.current = name
      if (user?.id && name !== firstName) {
        // Cache it if not already cached
        try {
          localStorage.setItem(`firstName_${user.id}`, name)
        } catch {
          // Ignore errors
        }
      }
    }
    return name || null
  }, [user?.first_name, user?.id, firstName])

  // Compute full name for display (first + last name only, no middle name)
  // This matches the avatar generation logic in MyDetails page
  // Initialize immediately from user object to prevent avatar changes during loading
  const displayFullName = useMemo(() => {
    // Priority: 1. fullName state (from user details), 2. user object, 3. null
    if (fullName) return fullName
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return null
  }, [user, fullName])

  // Compute name for avatar generation (first + last name only, uniform across all components)
  // This must be consistent from the start to prevent avatar changes during loading
  const avatarName = useMemo(() => {
    // Use the same logic as MyDetails: first + last name, or email as fallback
    // This ensures the avatar stays the same during loading
    if (displayFullName) return displayFullName
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.email || ''
  }, [displayFullName, user])

  // Initialize avatar from localStorage on mount or when user changes
  useEffect(() => {
    if (user) {
      const cached = getCachedAvatar(user.id)
      
      if (cached.url && cached.path) {
        // Set immediately from cache to prevent flicker
        setAvatarUrl(cached.url)
        avatarPathRef.current = cached.path
        
        // Preload the image in the background to verify it's still valid
        const img = new Image()
        img.onload = () => {
          // Image is valid, keep it
        }
        img.onerror = () => {
          // If cached image fails, clear cache - will be refetched in main effect
          clearAvatarCache(user.id)
          // Only reset if this is still the current user's avatar
          if (currentUserIdRef.current === user.id) {
            setAvatarUrl(null)
            avatarPathRef.current = null
          }
        }
        img.src = cached.url
      } else {
        // No cache, but don't clear if we already have a cached avatar from initialization
        if (currentUserIdRef.current !== user.id) {
          setAvatarUrl(null)
          avatarPathRef.current = null
        }
      }
    }
  }, [user?.id])

  // Update first name, full name, and avatar when user changes
  useEffect(() => {
    if (user) {
      const userIdChanged = currentUserIdRef.current !== user.id
      currentUserIdRef.current = user.id
      
          // Design is already computed from cache via useMemo, no need to set here
      
      // Always set from user object first (immediate) - this prevents avatar changes during loading
      // Check cache first, then user object, then email fallback
      const cachedName = getCachedFirstName(user.id)
      if (cachedName) {
        // Use cached name immediately
        persistedFirstNameRef.current = cachedName
        if (firstName !== cachedName) {
          setFirstName(cachedName)
        }
      } else if (user.first_name) {
        // Update ref and cache immediately to persist across navigation
        persistedFirstNameRef.current = user.first_name
        setFirstNameWithCache(user.first_name, user.id)
      } else if (user.email) {
        // Fallback to email prefix
        const emailName = user.email.split('@')[0]
        persistedFirstNameRef.current = emailName
        setFirstNameWithCache(emailName, user.id)
      } else if (userIdChanged) {
        // Only clear if user actually changed and we have no fallback
        setFirstName(null)
        persistedFirstNameRef.current = null
      }
      // Set full name immediately from user object to ensure consistent avatar from the start
      if (user.first_name && user.last_name) {
        setFullName(`${user.first_name} ${user.last_name}`)
      } else {
        // If user object doesn't have names, initialize to null (will use email fallback)
        setFullName(null)
      }
      
      // Fetch avatar from users table (same source as MyDetails page)
      // Always check database to detect avatar changes, but use cache to prevent flicker
      const cachedAvatarKey = `avatar_${user.id}`
      const cachedAvatarPathKey = `avatar_path_${user.id}`
      
      // Only fetch if we're not already fetching
      if (isFetchingAvatarRef.current) {
        return
      }
      
      isFetchingAvatarRef.current = true
      
      ;(async () => {
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('avatar_path, default_avatar_design')
            .eq('id', user.id)
            .single()
          
          if (error || !userData) {
            // Only reset if user changed
            if (userIdChanged) {
              setAvatarUrl(null)
              clearAvatarCache(user.id)
              // Design will be computed from cache via useMemo
            }
            avatarPathRef.current = null
            isFetchingAvatarRef.current = false
            return
          }
          
          const userDataTyped = userData as any
          const newAvatarPath = userDataTyped?.avatar_path || null
          const newDefaultDesign = userDataTyped?.default_avatar_design || 'default'
          
          // Cache the design immediately (this ensures it's available for next render)
          // This is critical - cache must be updated before state to prevent flickering
          cacheDefaultDesign(user.id, newDefaultDesign)
          
          // Update state if it changed (computedDefaultDesign will update on next render via useMemo)
          if (newDefaultDesign !== defaultAvatarDesign) {
            setDefaultAvatarDesign(newDefaultDesign)
          }
          const currentCachedPath = localStorage.getItem(cachedAvatarPathKey)
          
          // Check if avatar path has changed (even if user hasn't changed)
          const avatarPathChanged = newAvatarPath !== avatarPathRef.current && newAvatarPath !== currentCachedPath
          
          // Only fetch new URL if avatar path changed or user changed
          if (newAvatarPath && (avatarPathChanged || userIdChanged)) {
            avatarPathRef.current = newAvatarPath
            try {
              const url = await getSignedFileUrl(newAvatarPath)
              
              // Preload image before setting state to prevent flicker
              const img = new Image()
              img.onload = () => {
                // Only update if this is still the current avatar path (prevent race conditions)
                if (avatarPathRef.current === newAvatarPath && currentUserIdRef.current === user.id) {
                  setAvatarUrl(url)
                  // Cache the URL and path
                  cacheAvatar(user.id, url, newAvatarPath)
                }
                isFetchingAvatarRef.current = false
              }
              img.onerror = () => {
                // Only reset if user changed or path changed
                if (userIdChanged || avatarPathChanged) {
                  setAvatarUrl(null)
                  clearAvatarCache(user.id)
                }
                isFetchingAvatarRef.current = false
              }
              img.src = url
            } catch (error) {
              // Only reset if user changed or path changed
              if (userIdChanged || avatarPathChanged) {
                setAvatarUrl(null)
                clearAvatarCache(user.id)
              }
              isFetchingAvatarRef.current = false
            }
          } else if (!newAvatarPath) {
            // No avatar path - only reset if user changed
            avatarPathRef.current = null
            if (userIdChanged) {
              setAvatarUrl(null)
              clearAvatarCache(user.id)
            }
            isFetchingAvatarRef.current = false
          } else {
            // Avatar path hasn't changed, keep existing URL (don't reset)
            // Update ref to match current path
            avatarPathRef.current = newAvatarPath
            // Ensure cached URL is still set
            const cached = getCachedAvatar(user.id)
            if (cached.url && !avatarUrl) {
              setAvatarUrl(cached.url)
            }
            isFetchingAvatarRef.current = false
          }
        } catch (error) {
          // Only reset if user changed
          if (userIdChanged) {
            setAvatarUrl(null)
            clearAvatarCache(user.id)
          }
          avatarPathRef.current = null
          isFetchingAvatarRef.current = false
        }
      })()
      
      // Then fetch from user details to update if available (this won't change avatar if name is same)
      userDetailsAPI.get()
        .then((details: any) => {
          if (details?.first_name) {
            // Update ref and cache to persist across navigation
            persistedFirstNameRef.current = details.first_name
            setFirstNameWithCache(details.first_name, user.id)
          }
          // Build full name from user details (first name + last name only, no middle name)
          // This matches the avatar generation logic in MyDetails page
          // Only update if different to prevent unnecessary re-renders
          if (details?.first_name || details?.last_name) {
            const parts = [details.first_name, details.last_name].filter(Boolean)
            const newFullName = parts.length > 0 ? parts.join(' ') : null
            // Only update if the name actually changed
            setFullName(prevFullName => {
              if (newFullName !== prevFullName) {
                return newFullName
              }
              return prevFullName
            })
          }
        })
        .catch(() => {
          // Keep the current name if fetch fails
        })
    } else {
      // Only reset if user is actually null (logged out)
      setFirstName(null)
      setFullName(null)
      setAvatarUrl(null)
      avatarPathRef.current = null
      currentUserIdRef.current = null
      persistedFirstNameRef.current = null
      isFetchingAvatarRef.current = false
    }
  }, [user])

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return
    setLoadingNotifications(true)
    try {
      // Optimize: Limit initial fetch to recent 20 notifications for better performance
      // Full list can be loaded on demand if needed
      const [notifs, count] = await Promise.all([
        notificationsAPI.getAll(false, 20),
        notificationsAPI.getUnreadCount()
      ])
      setNotifications(notifs || [])
      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
      
      // Set up real-time subscription for notifications
      const notificationChannel = subscribeToNotifications(user.id, (payload) => {
        handleNotificationRealtimeUpdate(payload)
      })
      notificationChannelRef.current = notificationChannel

      // Cleanup on unmount
      return () => {
        if (notificationChannelRef.current) {
          unsubscribe(notificationChannelRef.current)
          notificationChannelRef.current = null
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Handle real-time notification updates
  function handleNotificationRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New notification received - add to list and update count
        setNotifications((prev) => [newRecord, ...prev])
        if (!newRecord.read) {
          setUnreadCount((prev) => prev + 1)
        }
        
        // Show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newRecord.title || 'New Notification', {
            body: newRecord.message || '',
            icon: '/favicon.ico',
          })
        }
      } else if (eventType === 'UPDATE' && newRecord && oldRecord) {
        // Notification was updated (e.g., marked as read)
        setNotifications((prev) => 
          prev.map(n => n.id === newRecord.id ? newRecord : n)
        )
        // Update count if read status changed
        if (oldRecord.read !== newRecord.read) {
          if (newRecord.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1))
          } else {
            setUnreadCount((prev) => prev + 1)
          }
        }
      }
    } catch (error) {
      console.error('Error handling real-time notification update:', error)
      // Fallback to fetching notifications
      fetchNotifications()
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.markAsRead(notificationId)
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: 1 } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
      setUserMenuOpen(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
      if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
        setExploreMenuOpen(false)
      }
    }

    if (userMenuOpen || notificationsOpen || exploreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen, notificationsOpen, exploreMenuOpen])

  const navLinks = [
    { label: 'Home', path: '/', hash: '' },
    { label: 'Quote', path: '/quote', hash: '' },
    { label: 'Tracking', path: '/tracking', hash: '' },
  ]

  const exploreMenuItems = [
    { label: 'Sponsorship', path: '/sponsorship', hash: '' },
    { label: 'Career', path: '/career', hash: '' },
    { label: 'Donate', path: '/donate', hash: '' },
    { label: 'About Us', path: '/about-us', hash: '' },
  ]

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string, hash: string) => {
    e.preventDefault()
    
    if (hash) {
      // If we're on the home page, just scroll
      if (location.pathname === '/') {
        const element = document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          // Update URL hash without scrolling
          window.history.pushState(null, '', `#${hash}`)
        }
      } else {
        // If we're on another page, navigate with hash
        navigate(`${path}#${hash}`)
        // Wait for navigation and then scroll
        setTimeout(() => {
          const element = document.getElementById(hash)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 150)
      }
    } else {
      // Regular navigation
      navigate(path)
    }
  }

  const isActive = (path: string, hash: string) => {
    if (path === '/' && hash === '') {
      return location.pathname === '/' && !location.hash
    }
    
    // Check exact path match with hash
    if (location.pathname === path && location.hash === `#${hash}`) {
      return true
    }
    
    // Handle route aliases for Quote and Tracking
    if (path === '/about-us') {
      return location.pathname === '/about-us'
    }
    
    if (path === '/quote') {
      // Quote page can be accessed via /quote or /quotations
      return location.pathname === '/quote' || location.pathname === '/quotations'
    }
    
    if (path === '/tracking') {
      // Tracking page can be accessed via /tracking or /applications
      // But not /applications/:id (that's the detail page)
      return location.pathname === '/tracking' || location.pathname === '/applications'
    }
    
    return false
  }

  const isExploreActive = () => {
    return exploreMenuItems.some(item => isActive(item.path, item.hash))
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Left side - Logo and Mobile Menu */}
          <div className="flex items-center gap-4">
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <Link to={user ? (isAdmin() ? '/admin/dashboard' : '/dashboard') : '/'} className="flex items-center">
              <Logo />
            </Link>
          </div>

          {/* Center - Navigation Links (Desktop, non-authenticated) */}
          {!user && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={`${link.path}-${link.hash}`}
                  href={link.hash ? `${link.path}#${link.hash}` : link.path}
                  onClick={(e) => handleNavClick(e, link.path, link.hash)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                    isActive(link.path, link.hash)
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {link.label}
                </a>
              ))}
              
              {/* Explore Dropdown */}
              <div
                ref={exploreMenuRef}
                className="relative"
              >
                <button
                  onClick={() => setExploreMenuOpen(!exploreMenuOpen)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1',
                    exploreMenuOpen || isExploreActive()
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  Explore
                  <ChevronDown className={cn('h-4 w-4 transition-transform', exploreMenuOpen && 'rotate-180')} />
                </button>
                
                {exploreMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                    {exploreMenuItems.map((item) => (
                      <a
                        key={`${item.path}-${item.hash}`}
                        href={item.hash ? `${item.path}#${item.hash}` : item.path}
                        onClick={(e) => {
                          handleNavClick(e, item.path, item.hash)
                          setExploreMenuOpen(false)
                        }}
                        className={cn(
                          'block px-4 py-2 text-sm transition-colors cursor-pointer first:rounded-t-lg last:rounded-b-lg',
                          isActive(item.path, item.hash)
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          )}

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                  className="hidden sm:flex"
                >
                  {theme === 'light' ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </Button>

                {/* Notification Icon */}
                <div className="relative" ref={notificationsRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative"
                    aria-label="Notifications"
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen)
                      if (!notificationsOpen) {
                        fetchNotifications()
                      }
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
                    )}
                  </Button>

                  {/* Notifications Dropdown */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-[calc(100vw-2rem)] sm:max-w-none rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[500px] flex flex-col">
                      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Notifications
                        </h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      
                      <div className="overflow-y-auto flex-1">
                        {loadingNotifications ? (
                          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            Loading...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            No notifications
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={cn(
                                  "p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer",
                                  !notification.read && "bg-primary-50/50 dark:bg-primary-900/10"
                                )}
                                onClick={() => {
                                  if (notification.application_id) {
                                    navigate(`/applications/${notification.application_id}/timeline`)
                                    setNotificationsOpen(false)
                                  }
                                  if (!notification.read) {
                                    handleMarkAsRead(notification.id)
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                      {formatDate(notification.created_at)}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <div className="h-2 w-2 bg-primary-600 dark:bg-primary-400 rounded-full flex-shrink-0 mt-1"></div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="User menu"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shadow-lg",
                      !avatarUrl && getAvatarColor(avatarName, getCurrentDesign()),
                      !avatarUrl && getAvatarColorDark(avatarName, getCurrentDesign()),
                      !avatarUrl && getAvatarTextColor(avatarName, getCurrentDesign()),
                      !avatarUrl && getAvatarTextColorDark(avatarName, getCurrentDesign())
                    )}>
                      {avatarUrl ? (
                        <img 
                          ref={avatarImageRef}
                          src={avatarUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(_e) => {
                            // If image fails to load, clear cache and reset to initials
                            const cachedAvatarKey = `avatar_${user?.id}`
                            const cachedAvatarPathKey = `avatar_path_${user?.id}`
                            localStorage.removeItem(cachedAvatarKey)
                            localStorage.removeItem(cachedAvatarPathKey)
                            setAvatarUrl(null)
                            avatarPathRef.current = null
                          }}
                        />
                      ) : (
                        getInitials(avatarName)
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {displayFirstName || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform",
                      userMenuOpen && "rotate-180"
                    )} />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg py-2"
                      role="menu"
                      aria-label="User menu"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden shadow-lg",
                            !avatarUrl && getAvatarColor(avatarName, getCurrentDesign()),
                            !avatarUrl && getAvatarColorDark(avatarName, getCurrentDesign()),
                            !avatarUrl && getAvatarTextColor(avatarName, getCurrentDesign()),
                            !avatarUrl && getAvatarTextColorDark(avatarName, getCurrentDesign())
                          )}>
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(_e) => {
                                  // If image fails to load, clear cache and reset to initials
                                  const cachedAvatarKey = `avatar_${user?.id}`
                                  const cachedAvatarPathKey = `avatar_path_${user?.id}`
                                  localStorage.removeItem(cachedAvatarKey)
                                  localStorage.removeItem(cachedAvatarPathKey)
                                  setAvatarUrl(null)
                                  avatarPathRef.current = null
                                }}
                              />
                            ) : (
                              getInitials(avatarName)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {displayFullName || user.email}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        {isAdmin() && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                            Admin
                          </span>
                        )}
                      </div>
                      
                      <div className="py-1">
                        <Link
                          to="/my-details"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <UserCircle className="h-4 w-4" />
                          My Details
                        </Link>
                        <Link
                          to="/account-settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                          Account Settings
                        </Link>
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Auth Buttons */}
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="hidden sm:flex">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="hidden sm:flex">
                    Sign Up
                  </Button>
                </Link>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu (Non-authenticated) */}
        {!user && mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <nav className="container mx-auto px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={`${link.path}-${link.hash}`}
                  href={link.hash ? `${link.path}#${link.hash}` : link.path}
                  onClick={(e) => {
                    handleNavClick(e, link.path, link.hash)
                    setMobileMenuOpen(false)
                  }}
                  className={cn(
                    'block px-4 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer',
                    isActive(link.path, link.hash)
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 mt-2">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Explore
                </div>
                {exploreMenuItems.map((item) => (
                  <a
                    key={`${item.path}-${item.hash}`}
                    href={item.hash ? `${item.path}#${item.hash}` : item.path}
                    onClick={(e) => {
                      handleNavClick(e, item.path, item.hash)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      'block px-4 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer',
                      isActive(item.path, item.hash)
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 mt-4 space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Sidebar (Authenticated) */}
      {user && mobileMenuOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-16 bottom-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-64 overflow-y-auto">
            <MobileSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
