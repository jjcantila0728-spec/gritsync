# Admin Emails - Route Documentation

## Available Routes

The Admin Emails page now supports direct navigation to specific tabs via URL routes.

### Base Route
```
http://localhost:5000/admin/emails
```
- Default view: Opens the **History** tab

### Tab-Specific Routes

#### 1. Email History
```
http://localhost:5000/admin/emails/history
```
- View all sent emails
- Filter by status, type, category
- Search by email, subject, or recipient
- View email details and resend failed emails

#### 2. Analytics
```
http://localhost:5000/admin/emails/analytics
```
- View email statistics and delivery rates
- Monitor email performance metrics
- Track success/failure rates
- Usage analytics over time

#### 3. Compose Email
```
http://localhost:5000/admin/emails/compose
```
- Send new emails
- Select sender address
- Use email templates with variables
- Rich HTML email composition

#### 4. Email Templates
```
http://localhost:5000/admin/emails/templates
```
- Manage email templates
- Create/edit/delete templates
- Preview templates with live rendering
- Organize by category
- Track template usage

## Hash-Based Navigation (Alternative)

The system also supports hash-based navigation for compatibility:

```
http://localhost:5000/admin/emails#history
http://localhost:5000/admin/emails#analytics
http://localhost:5000/admin/emails#compose
http://localhost:5000/admin/emails#templates
```

## Features

### URL Synchronization
- ✅ URL updates when you click on tabs
- ✅ Browser back/forward buttons work correctly
- ✅ Bookmarkable tab-specific pages
- ✅ Shareable links to specific tabs

### Navigation Behavior
- **Replace History:** Tab changes use `replace: true` to avoid cluttering browser history
- **Deep Linking:** Direct navigation to any tab via URL
- **State Preservation:** Tab state is preserved on page refresh

## Use Cases

### 1. Sharing Links
Share a direct link to compose email:
```
http://localhost:5000/admin/emails/compose
```

### 2. Bookmarking
Bookmark frequently used tabs:
- Bookmark `/admin/emails/history` for quick access to email logs
- Bookmark `/admin/emails/compose` for quick email composition

### 3. External Links
Link to specific tabs from other parts of the application:
```jsx
<Link to="/admin/emails/templates">Manage Templates</Link>
```

### 4. Email Notifications
Include direct links in email notifications:
```
"View your email analytics: http://localhost:5000/admin/emails/analytics"
```

## Technical Implementation

### React Router Integration
- Uses `useNavigate()` for programmatic navigation
- Uses `useLocation()` to detect current route
- Supports both path-based and hash-based routing

### State Management
- Tab state synced with URL
- Initial tab determined from URL on mount
- Listeners for route changes (back/forward navigation)

### Route Configuration
All routes defined in `App.tsx`:
```jsx
<Route path="/admin/emails" element={<AdminEmails />} />
<Route path="/admin/emails/history" element={<AdminEmails />} />
<Route path="/admin/emails/analytics" element={<AdminEmails />} />
<Route path="/admin/emails/compose" element={<AdminEmails />} />
<Route path="/admin/emails/templates" element={<AdminEmails />} />
```

## Testing Routes

### Manual Testing
1. Navigate to `http://localhost:5000/admin/emails/compose`
2. Should open directly to Compose tab
3. Click on History tab
4. URL should change to `/admin/emails/history`
5. Click browser back button
6. Should return to Compose tab

### Integration with Sidebar
The sidebar link `/admin/emails` still works and opens the default (History) tab.

## Production URLs

When deployed, replace `localhost:5000` with your production domain:
```
https://gritsync.com/admin/emails/compose
https://gritsync.com/admin/emails/templates
https://gritsync.com/admin/emails/analytics
https://gritsync.com/admin/emails/history
```

## API for Developers

### Navigate to Specific Tab Programmatically
```typescript
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()

// Navigate to compose
navigate('/admin/emails/compose')

// Navigate to templates
navigate('/admin/emails/templates')
```

### Link Component
```tsx
import { Link } from 'react-router-dom'

<Link to="/admin/emails/compose">
  Compose New Email
</Link>
```

### Get Current Tab
The current tab is determined from the URL path or hash:
- Path: `/admin/emails/compose` → `compose`
- Hash: `/admin/emails#compose` → `compose`
- Default: `/admin/emails` → `history`

## Benefits

1. **Better UX:** Users can bookmark and share specific tabs
2. **Browser Navigation:** Back/forward buttons work as expected
3. **SEO Friendly:** Path-based routing is more SEO friendly
4. **Developer Friendly:** Easy to link to specific views
5. **Debugging:** Easier to identify which view a user is on from URL

---

**Last Updated:** December 10, 2025
**Version:** 1.0.0

