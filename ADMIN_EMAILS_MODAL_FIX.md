# Admin Emails Modal Fix

## Issue
Emails were not opening in Admin Emails views (`/admin/emails` and `/admin/emails/sent`)

## Root Cause
The AdminEmails component had the email selection logic but was missing:
1. Modal state management (`showEmailDetail`)
2. Integration with `EmailDetailModal` component
3. Proper state updates to show the modal

## Changes Made

### 1. Added Modal Import
```typescript
import { EmailDetailModal } from '@/components/email/EmailDetailModal'
```

### 2. Added Modal State
```typescript
// Email detail modal state
const [showEmailDetail, setShowEmailDetail] = useState(false)
```

### 3. Updated Email Handlers

**Inbox Email Handler** (`handleViewReceivedEmail`):
- Changed `setSelectedReceivedEmail(email)` → `setSelectedInboxEmail(email)`
- Added `setShowEmailDetail(true)` after setting selected email
- Opens modal when email is clicked

**Sent Email Handler** (`handleViewSentEmail`):
- Changed `setSelectedEmail(email)` → `setSelectedSentEmail(email)`
- Added `setShowEmailDetail(true)` after setting selected email
- Opens modal when email is clicked

### 4. Added EmailDetailModal Component
Added at the end of the AdminEmails component (before closing tags):

```typescript
{/* Email Detail Modal */}
{showEmailDetail && (selectedInboxEmail || selectedSentEmail) && (
  <EmailDetailModal
    isOpen={showEmailDetail}
    onClose={() => {
      setShowEmailDetail(false)
      setSelectedInboxEmail(null)
      setSelectedSentEmail(null)
    }}
    email={selectedInboxEmail || selectedSentEmail!}
    type={activeTab === 'inbox' ? 'inbox' : 'sent'}
    onReply={...}  // For inbox emails
    onForward={...}  // For inbox emails
    onDelete={...}  // For inbox emails
    getAvatarInitial={getInitials}
    getAvatarColor={getAvatarColor}
  />
)}
```

## Features Now Working

### Admin Inbox (`/admin/emails`)
- ✅ Click any email → Modal opens
- ✅ View full email content with HTML preview
- ✅ Reply button (opens compose modal with pre-filled data)
- ✅ Forward button (opens compose modal with pre-filled data)
- ✅ Print button (triggers print dialog)
- ✅ Delete button (deletes email and closes modal)
- ✅ Close button (dismisses modal)
- ✅ Sender info with avatar
- ✅ Attachments with download buttons
- ✅ Sanitized HTML rendering

### Admin Sent (`/admin/emails/sent`)
- ✅ Click any email → Modal opens
- ✅ View full email content with HTML preview
- ✅ Recipient info with avatar
- ✅ Status badge (delivered, pending, failed)
- ✅ Print button
- ✅ Close button
- ✅ Sanitized HTML rendering

### Compose Modal
- ✅ Works when opened from Reply/Forward buttons
- ✅ Pre-fills recipient, subject, and body
- ✅ Has preview toggle for HTML preview

## Files Modified

- `src/pages/AdminEmails.tsx`:
  - Added `EmailDetailModal` import
  - Added `showEmailDetail` state
  - Updated `handleViewReceivedEmail` to show modal
  - Updated `handleViewSentEmail` to show modal
  - Added `EmailDetailModal` component render

## Testing

✅ No linting errors
✅ Admin inbox opens emails in modal
✅ Admin sent opens emails in modal
✅ All action buttons functional
✅ Compose modal opens from Reply/Forward
✅ HTML content sanitized and rendered correctly

## Result

All admin email views now use the same compact modal pattern as the client email views:
- Click email → Modal opens
- View details → Take action (Reply/Forward/Delete)
- Close modal → Return to email list

The fix ensures consistency across both admin and client email management interfaces.

