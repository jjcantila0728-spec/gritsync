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
  const [firstName, setFirstName] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const notificationChannelRef = useRef<RealtimeChannel | null>(null)
  const avatarPathRef = useRef<string | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const avatarImageRef = useRef<HTMLImageElement | null>(null)
  const isFetchingAvatarRef = useRef(false)

  // Compute display name synchronously from user object to prevent flickering
  const displayFirstName = useMemo(() => {
    return user?.first_name || firstName || null
  }, [user, firstName])

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
      const cachedAvatarKey = `avatar_${user.id}`
      const cachedAvatarPathKey = `avatar_path_${user.id}`
      const cachedUrl = localStorage.getItem(cachedAvatarKey)
      const cachedPath = localStorage.getItem(cachedAvatarPathKey)
      
      if (cachedUrl && cachedPath) {
        // Set immediately from cache to prevent flicker
        setAvatarUrl(cachedUrl)
        avatarPathRef.current = cachedPath
        
        // Preload the image in the background to verify it's still valid
        const img = new Image()
        img.onerror = () => {
          // If cached image fails, clear cache - will be refetched in main effect
          localStorage.removeItem(cachedAvatarKey)
          localStorage.removeItem(cachedAvatarPathKey)
          // Don't reset state here - let the main effect handle it
        }
        img.src = cachedUrl
      } else {
        // No cache, clear state
        setAvatarUrl(null)
        avatarPathRef.current = null
      }
    }
  }, [user?.id])

  // Update first name, full name, and avatar when user changes
  useEffect(() => {
    if (user) {
      const userIdChanged = currentUserIdRef.current !== user.id
      currentUserIdRef.current = user.id
      
      // Always set from user object first (immediate) - this prevents avatar changes during loading
      if (user.first_name) {
        setFirstName(user.first_name)
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
            .select('avatar_path')
            .eq('id', user.id)
            .single()
          
          if (error || !userData) {
            // Only reset if user changed
            if (userIdChanged) {
              setAvatarUrl(null)
              localStorage.removeItem(cachedAvatarKey)
              localStorage.removeItem(cachedAvatarPathKey)
            }
            avatarPathRef.current = null
            isFetchingAvatarRef.current = false
            return
          }
          
          const userDataTyped = userData as any
          const newAvatarPath = userDataTyped?.avatar_path || null
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
                if (avatarPathRef.current === newAvatarPath) {
                  setAvatarUrl(url)
                  // Cache the URL and path
                  localStorage.setItem(cachedAvatarKey, url)
                  localStorage.setItem(cachedAvatarPathKey, newAvatarPath)
                }
                isFetchingAvatarRef.current = false
              }
              img.onerror = () => {
                // Only reset if user changed or path changed
                if (userIdChanged || avatarPathChanged) {
                  setAvatarUrl(null)
                  localStorage.removeItem(cachedAvatarKey)
                  localStorage.removeItem(cachedAvatarPathKey)
                }
                isFetchingAvatarRef.current = false
              }
              img.src = url
            } catch (error) {
              // Only reset if user changed or path changed
              if (userIdChanged || avatarPathChanged) {
                setAvatarUrl(null)
                localStorage.removeItem(cachedAvatarKey)
                localStorage.removeItem(cachedAvatarPathKey)
              }
              isFetchingAvatarRef.current = false
            }
          } else if (!newAvatarPath) {
            // No avatar path - only reset if user changed
            avatarPathRef.current = null
            if (userIdChanged) {
              setAvatarUrl(null)
              localStorage.removeItem(cachedAvatarKey)
              localStorage.removeItem(cachedAvatarPathKey)
            }
            isFetchingAvatarRef.current = false
          } else {
            // Avatar path hasn't changed, keep existing URL (don't reset)
            // Update ref to match current path
            avatarPathRef.current = newAvatarPath
            isFetchingAvatarRef.current = false
          }
        } catch (error) {
          // Only reset if user changed
          if (userIdChanged) {
            setAvatarUrl(null)
            localStorage.removeItem(cachedAvatarKey)
            localStorage.removeItem(cachedAvatarPathKey)
          }
          avatarPathRef.current = null
          isFetchingAvatarRef.current = false
        }
      })()
      
      // Then fetch from user details to update if available (this won't change avatar if name is same)
      userDetailsAPI.get()
        .then((details: any) => {
          if (details?.first_name) {
            setFirstName(details.first_name)
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
      setFirstName(null)
      setFullName(null)
      setAvatarUrl(null)
      avatarPathRef.current = null
      currentUserIdRef.current = null
      isFetchingAvatarRef.current = false
    }
  }, [user])

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return
    setLoadingNotifications(true)
    try {
      const [notifs, count] = await Promise.all([
        notificationsAPI.getAll(),
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

      if (eventType === 'INSERT' && newRecord) {
        // New notification received - add to list and update count
        setNotifications((prev) => [newRecord, ...prev])
        setUnreadCount((prev) => prev + 1)
        
        // Show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newRecord.title || 'New Notification', {
            body: newRecord.message || '',
            icon: '/favicon.ico',
          })
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
    }

    if (userMenuOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen, notificationsOpen])

  const navLinks = [
    { label: 'Home', path: '/', hash: '' },
    { label: 'Quote', path: '/quote', hash: '' },
    { label: 'Tracking', path: '/tracking', hash: '' },
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
                    <div className="absolute right-0 mt-2 w-80 md:w-96 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[500px] flex flex-col">
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
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shadow-lg",
                      !avatarUrl && getAvatarColor(avatarName),
                      !avatarUrl && getAvatarColorDark(avatarName),
                      !avatarUrl && getAvatarTextColor(avatarName),
                      !avatarUrl && getAvatarTextColorDark(avatarName)
                    )}>
                      {avatarUrl ? (
                        <img 
                          ref={avatarImageRef}
                          src={avatarUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
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
                    <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
                      {displayFirstName || ''}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform",
                      userMenuOpen && "rotate-180"
                    )} />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg py-2">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden shadow-lg",
                            !avatarUrl && getAvatarColor(avatarName),
                            !avatarUrl && getAvatarColorDark(avatarName),
                            !avatarUrl && getAvatarTextColor(avatarName),
                            !avatarUrl && getAvatarTextColorDark(avatarName)
                          )}>
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
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
