# 📋 Notification System - Quick Reference Card

## 🎯 At a Glance

### Visual Design
```
Bell Icon + Red Badge (white number inside)
     🔔
    ┌──┐
    │ 5│  ← Animated pulse, shows unread count
    └──┘
```

### 5 Notification Types
| Icon | Type | Color | Triggers When |
|------|------|-------|---------------|
| 📄 | Document | Blue | Missing required docs |
| 💳 | Payment | Green | Payment pending >3 days |
| 🕐 | Timeline | Purple | Step completed / credentialing due |
| 👤 | Profile | Orange | Profile incomplete |
| 🔔 | General | Gray | Manual/system updates |

---

## ⚡ Quick Commands

### Deploy Notifications
```bash
# Run SQL migration
supabase db push supabase/add-smart-notifications.sql
```

### Test Notifications
```sql
-- Generate reminders manually
SELECT generate_document_reminders();
SELECT generate_profile_completion_reminders();
SELECT generate_payment_reminders();
SELECT notify_credentialing_reminder();
```

### Check Status
```sql
-- See recent notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Count unread per user
SELECT user_id, COUNT(*) FROM notifications 
WHERE read = false GROUP BY user_id;
```

### API Calls
```typescript
// Fetch notifications
const notifs = await notificationsAPI.getAll(false, 20)

// Get unread count
const count = await notificationsAPI.getUnreadCount()

// Mark as read
await notificationsAPI.markAsRead(id)

// Mark all read
await notificationsAPI.markAllAsRead()

// Check missing docs
const missing = await notificationsAPI.checkMissingDocuments()

// Check profile
const incomplete = await notificationsAPI.checkIncompleteProfile()
```

---

## 🔧 Configuration

### Adjust Frequencies (in SQL file)
```sql
-- Document reminders: Change from 7 days
WHERE created_at > NOW() - INTERVAL '7 days'

-- Payment reminders: Change from 3 days  
WHERE ap.created_at < NOW() - INTERVAL '3 days'

-- Credentialing: Change from 5 days
WHERE created_at > NOW() - INTERVAL '5 days'
```

### Set Up Automated Reminders
```sql
-- Using pg_cron (requires extension)
SELECT cron.schedule('doc-reminders', '0 9 * * *', 
  'SELECT generate_document_reminders()');
```

---

## 🐛 Troubleshooting

### Not Appearing?
```sql
-- 1. Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%notification%';

-- 2. Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- 3. Test manual insert
INSERT INTO notifications (user_id, type, title, message, read)
VALUES ('<user-id>', 'general', 'Test', 'Testing', false);
```

### Badge Wrong?
```typescript
// Clear cache
await notificationsAPI.invalidateCountCache()
await notificationsAPI.getUnreadCount(true)
```

### Real-time Not Working?
1. Check Supabase → Database → Replication
2. Ensure `notifications` table replication enabled
3. Check browser console for errors
4. Verify RLS allows SELECT for own notifications

---

## 📊 Monitoring Queries

```sql
-- Today's notifications by type
SELECT type, COUNT(*) FROM notifications 
WHERE created_at > CURRENT_DATE
GROUP BY type;

-- Average time to read
SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) 
FROM notifications WHERE read = true;

-- Users with most unread
SELECT user_id, COUNT(*) FROM notifications 
WHERE read = false 
GROUP BY user_id 
ORDER BY COUNT(*) DESC 
LIMIT 10;

-- Notification effectiveness
SELECT 
  type,
  COUNT(*) as total,
  SUM(CASE WHEN read THEN 1 ELSE 0 END) as read_count,
  ROUND(100.0 * SUM(CASE WHEN read THEN 1 ELSE 0 END) / COUNT(*), 2) as read_rate
FROM notifications
GROUP BY type;
```

---

## 🎨 UI Specs

### Badge
- **Color**: Red #EF4444
- **Text**: White #FFFFFF  
- **Size**: 20px height
- **Font**: Bold 10px
- **Animation**: 2s pulse

### Dropdown
- **Desktop**: 420px width
- **Mobile**: Full width - 2rem
- **Height**: 600px max
- **Shadow**: 2xl

### Notification States
- **Unread**: Blue bg, bold, left border, red dot
- **Read**: White bg, normal weight

---

## 📁 File Locations

```
Components:
├── src/components/NotificationBell.tsx
├── src/components/NotificationDropdown.tsx
└── src/pages/Notifications.tsx

Database:
└── supabase/add-smart-notifications.sql

API:
└── src/lib/supabase-api.ts (notificationsAPI)

Routes:
└── src/App.tsx (/notifications)

Docs:
├── SMART_NOTIFICATION_SYSTEM.md (full guide)
├── NOTIFICATION_SETUP_GUIDE.md (setup)
├── NOTIFICATION_VISUAL_GUIDE.md (design)
└── IMPLEMENTATION_SUMMARY_NOTIFICATIONS.md (summary)
```

---

## ⏰ Default Frequencies

| Notification Type | Check Frequency | Prevents Duplicates For |
|-------------------|-----------------|------------------------|
| Document Reminders | Daily (9 AM) | 7 days |
| Payment Reminders | Daily (2 PM) | 3 days |
| Profile Reminders | Daily (10 AM) | 7 days |
| Credentialing | Daily (11 AM) | 5 days |
| Timeline Updates | Real-time | N/A (immediate) |
| Payment Status | Real-time | N/A (immediate) |

---

## 🚀 Quick Setup (3 Steps)

1. **Deploy Database**
   ```bash
   supabase db push supabase/add-smart-notifications.sql
   ```

2. **Test Manually**
   ```sql
   SELECT generate_document_reminders();
   ```

3. **Set Up Cron (Optional)**
   ```sql
   SELECT cron.schedule('reminders', '0 9 * * *', 
     'SELECT generate_document_reminders()');
   ```

---

## ✅ Feature Checklist

- [x] Red badge with white number
- [x] Animated pulse effect
- [x] 5 notification types
- [x] Color-coded icons
- [x] One-click navigation
- [x] Auto-read marking
- [x] Mark all as read
- [x] Real-time updates
- [x] Responsive design
- [x] Dark mode support
- [x] Automated reminders
- [x] Database triggers
- [x] Full documentation

---

## 📞 Need Help?

1. **Setup Issues**: See `NOTIFICATION_SETUP_GUIDE.md`
2. **Design Questions**: See `NOTIFICATION_VISUAL_GUIDE.md`
3. **Technical Details**: See `SMART_NOTIFICATION_SYSTEM.md`
4. **Implementation Info**: See `IMPLEMENTATION_SUMMARY_NOTIFICATIONS.md`

---

## 🎯 Success Metrics

Track these KPIs:
- **Delivery Rate**: >99% (check DB logs)
- **Read Rate**: >70% (engagement)
- **Action Rate**: >50% (click-through)
- **Avg Time to Action**: <24 hours
- **Avg Unread**: <5 per user

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: December 10, 2025

---

*Print this card for quick reference during development and maintenance!*

