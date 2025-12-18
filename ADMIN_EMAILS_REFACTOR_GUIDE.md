# Admin Emails Refactoring Guide

## Completed Work

### 1. Shared Components Created
- **`src/components/email/EmailPreview.tsx`**: Reusable component for rendering sanitized HTML email content
- **`src/pages/AdminEmails/components/EmailListWithPreview.tsx`**: Two-column email list with live preview panel

### 2. Client Emails Refactored
- ✅ Converted from full-page detail view to two-column layout
- ✅ Email list on left (2/5 width on large screens)
- ✅ Live HTML preview on right (3/5 width on large screens)
- ✅ Integrated `EmailPreview` component for safe HTML rendering
- ✅ Mobile-responsive with fallback to single column

### 3. Compose Modal Enhanced
- ✅ Added "Preview" toggle button
- ✅ Live HTML preview of compose content
- ✅ Uses `EmailPreview` component for consistent rendering

## Integration Instructions for AdminEmails

To complete the AdminEmails refactoring, replace the inbox and sent views with the `EmailListWithPreview` component:

### Step 1: Add State (Already Done)
```typescript
// Added in src/pages/AdminEmails.tsx around line 148
const [selectedInboxEmail, setSelectedInboxEmail] = useState<EnrichedReceivedEmail | null>(null)
const [selectedSentEmail, setSelectedSentEmail] = useState<EmailLog | null>(null)
```

### Step 2: Replace Inbox View
Find the section `{activeTab === 'inbox' && (` (around line 2406) and replace the inbox table rendering with:

```typescript
{activeTab === 'inbox' && (
  <>
    {/* Keep bulk actions toolbar, search, and filters */}
    {selectedInboxIds.size > 0 && (
      // ... existing bulk actions toolbar ...
    )}
    
    {/* Search and Filters */}
    // ... existing search and filters ...
    
    {/* Replace the email table with EmailListWithPreview */}
    {loading ? (
      <div className="py-12">
        <Loading text="Loading inbox..." />
      </div>
    ) : (
      <EmailListWithPreview
        type="inbox"
        emails={receivedEmails}
        selectedIds={selectedInboxIds}
        selectedEmail={selectedInboxEmail}
        onEmailSelect={(email) => setSelectedInboxEmail(email as EnrichedReceivedEmail)}
        onToggleSelection={toggleInboxSelection}
        onToggleSelectAll={toggleSelectAllInbox}
        onDelete={handleDeleteInboxEmail}
        onReply={(email) => {
          // Handle reply logic
          const senderEmail = email.from.match(/<(.+?)>/)?.[1] || email.from
          setComposeData({
            ...composeData,
            to: senderEmail,
            toName: email.senderName || '',
            subject: `Re: ${email.subject || ''}`,
          })
          setComposing(true)
        }}
        onForward={(email) => {
          // Handle forward logic
          setComposeData({
            ...composeData,
            to: '',
            subject: `Fwd: ${email.subject || ''}`,
            body: email.html || email.text || '',
          })
          setComposing(true)
        }}
        getAvatarInitial={getInitials}
        getAvatarColor={getAvatarColor}
        getEmailPreview={getEmailPreview}
      />
    )}
  </>
)}
```

### Step 3: Replace Sent View
Find the section `{activeTab === 'sent' && (` (around line 2059) and replace the sent table rendering with:

```typescript
{activeTab === 'sent' && (
  <>
    {/* Keep bulk actions toolbar, search, and filters */}
    {selectedSentIds.size > 0 && (
      // ... existing bulk actions toolbar ...
    )}
    
    {/* Search and Filters */}
    // ... existing search and filters ...
    
    {/* Replace the email table with EmailListWithPreview */}
    {loading ? (
      <div className="py-12">
        <Loading text="Loading sent emails..." />
      </div>
    ) : (
      <EmailListWithPreview
        type="sent"
        emails={emailLogs}
        selectedIds={selectedSentIds}
        selectedEmail={selectedSentEmail}
        onEmailSelect={(email) => setSelectedSentEmail(email as EmailLog)}
        onToggleSelection={toggleSentSelection}
        onToggleSelectAll={toggleSelectAllSent}
        getAvatarInitial={getInitials}
        getAvatarColor={getAvatarColor}
        getEmailPreview={getEmailPreview}
      />
    )}
  </>
)}
```

### Step 4: Update Helper Functions
Ensure these helper functions exist (they should already be in AdminEmails/utils/emailHelpers.ts):
- `getEmailPreview(html?: string, text?: string, maxLength?: number): string`
- Avatar functions: `getInitials`, `getAvatarColor`

### Step 5: Clear Selected Email on Tab Change
Update the `handleTabChange` function to clear selected emails:

```typescript
const handleTabChange = (tab: Tab) => {
  setActiveTab(tab)
  // ... existing navigation logic ...
  
  // Clear selections and previews when switching tabs
  if (tab === 'sent') {
    setSelectedInboxIds(new Set())
    setSelectedInboxEmail(null)
  } else if (tab === 'inbox') {
    setSelectedSentIds(new Set())
    setSelectedSentEmail(null)
  }
}
```

## Benefits

1. **Consistent UX**: Admin and client email views now have the same two-column layout
2. **Live HTML Preview**: All email content is rendered with sanitized HTML in a live preview panel
3. **Better Security**: All HTML is sanitized through `DOMPurify` before rendering
4. **Mobile Responsive**: Layout adapts to smaller screens (single column on mobile/tablet)
5. **Code Reuse**: `EmailPreview` and `EmailListWithPreview` components are shared across views

## Testing Checklist

- [ ] Client inbox view displays emails in two-column layout
- [ ] Client sent view displays emails in two-column layout
- [ ] Clicking an email shows preview on the right
- [ ] HTML content is sanitized and renders correctly
- [ ] Compose modal preview toggle works
- [ ] Compose modal preview shows sanitized HTML
- [ ] Reply/forward buttons work from preview panel
- [ ] Print button works from preview panel
- [ ] Mobile view falls back to single column gracefully
- [ ] Admin inbox view uses new layout (after integration)
- [ ] Admin sent view uses new layout (after integration)

