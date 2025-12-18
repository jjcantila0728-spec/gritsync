# Email Templates - User Guide

## Quick Start Guide for Admins

### 📧 Sending an Email with a Template

1. **Navigate to Emails:**
   - Admin → Emails → Compose tab

2. **Select Template:**
   - Look for the blue "Use Email Template" section
   - Choose a template from the dropdown (e.g., "Welcome New User")

3. **Fill Variables:**
   - Input fields will appear for each template variable
   - Example: Enter "John Smith" for `userName`
   - Enter "https://gritsync.com/dashboard" for `dashboardUrl`

4. **Apply Template:**
   - Click "Apply Template to Email"
   - Subject and body will be automatically filled

5. **Customize (Optional):**
   - Edit the generated content if needed
   - Add recipient email and name

6. **Send:**
   - Click "Send Email"
   - Template usage counter automatically increments

### 🎨 Creating a New Template

1. **Navigate to Templates:**
   - Admin → Emails → Templates tab

2. **Create New:**
   - Click "Create Template" button (top right)

3. **Fill Details:**
   - **Name:** Descriptive name (e.g., "Password Reset")
   - **Slug:** URL-friendly (e.g., "password-reset")
   - **Category:** Choose appropriate category
   - **Subject:** Use `{{variables}}` for dynamic content
   - **Description:** Brief description of template purpose

4. **Add Variables:**
   - Click "Add Variable"
   - Enter variable name (e.g., `resetUrl`)
   - Add description
   - Mark as required if necessary

5. **Create Content:**
   - Write HTML in the HTML Content section
   - Use `{{variableName}}` syntax for placeholders
   - Add plain text version (recommended)

6. **Preview:**
   - Right panel shows live preview
   - Fill test variables to see how it looks
   - Switch between Desktop/Mobile/Code views

7. **Save:**
   - Click "Save Template"
   - Template is now available for use

### ✏️ Editing Existing Templates

1. **Find Template:**
   - Admin → Emails → Templates tab
   - Filter by category if needed

2. **Edit:**
   - Click "Edit" button on template card
   - Make your changes
   - Preview updates in real-time

3. **Save:**
   - Click "Save Template"
   - All future emails use the updated version

### 📋 Cloning Templates

**Why Clone?**
- Create variations of successful templates
- Test different approaches
- Customize system templates without affecting originals

**How to Clone:**
1. Find template in Templates tab
2. Click "Clone" button
3. New template created with "(Copy)" suffix
4. Edit the clone as needed

### 🏷️ Template Categories

- **Welcome:** New user onboarding emails
- **Notification:** Status updates, alerts
- **Marketing:** Newsletters, promotions
- **Transactional:** Receipts, confirmations
- **Reminder:** Due dates, pending actions
- **Announcement:** Company news, updates
- **Custom:** Anything else

### 🔤 Using Variables

**Syntax:**
```html
Hello {{userName}},

Your application #{{applicationId}} has been {{newStatus}}.

Visit: {{applicationUrl}}
```

**Common Variables:**
- `{{userName}}` - User's full name
- `{{userEmail}}` - User's email
- `{{applicationId}}` - Application ID
- `{{dashboardUrl}}` - Link to dashboard
- `{{supportEmail}}` - Support contact email
- `{{companyName}}` - Your company name
- `{{date}}` - Current date
- `{{amount}}` - Payment amounts

**Best Practices:**
- Use clear, descriptive variable names
- Mark critical variables as "required"
- Provide fallback text for optional variables
- Test with various input lengths

### 🎯 Pre-designed Templates

#### 1. Welcome New User
**Use when:** New user signs up
**Variables:**
- `userName` - User's full name
- `dashboardUrl` - Link to their dashboard
- `supportEmail` - Your support email
- `websiteUrl` - Your website

**Example:**
```javascript
{
  userName: "John Smith",
  dashboardUrl: "https://gritsync.com/dashboard",
  supportEmail: "support@gritsync.com",
  websiteUrl: "https://gritsync.com"
}
```

#### 2. Application Status Update
**Use when:** Application status changes
**Variables:**
- `userName` - User's name
- `applicationId` - Application number
- `newStatus` - New status value
- `message` - Detailed message
- `applicationUrl` - Link to application

#### 3. Payment Receipt
**Use when:** Payment is received
**Variables:**
- `userName` - User's name
- `amount` - Payment amount (with currency symbol)
- `receiptNumber` - Receipt/transaction ID
- `paymentDate` - Date of payment
- `paymentMethod` - Payment method used
- `description` - What the payment was for

#### 4. General Reminder
**Use when:** Reminding users of pending actions
**Variables:**
- `userName` - User's name
- `reminderTitle` - What they need to do
- `reminderMessage` - Detailed reminder
- `actionUrl` - Link to take action

#### 5. Newsletter
**Use when:** Sending newsletters/announcements
**Variables:**
- `userName` - Recipient name
- `newsletterTitle` - Newsletter title
- `newsletterDate` - Publication date
- `contentBody` - Main content (HTML supported)
- `ctaText` - Call-to-action button text
- `ctaUrl` - Call-to-action link
- `unsubscribeUrl` - Unsubscribe link

### 💡 Tips & Best Practices

**Design Tips:**
1. Keep emails under 600px wide for compatibility
2. Use web-safe fonts (Arial, Helvetica, Georgia)
3. Include alt text for images
4. Test on mobile devices
5. Always include a plain text version

**Content Tips:**
1. Clear, concise subject lines (40-50 characters)
2. Start with most important information
3. Single, clear call-to-action
4. Include unsubscribe link (for marketing emails)
5. Add footer with contact info

**Technical Tips:**
1. Use inline CSS (not external stylesheets)
2. Avoid JavaScript (not supported in emails)
3. Test variables with edge cases (long names, special characters)
4. Preview on multiple email clients
5. Keep image file sizes small

**Variable Tips:**
1. Always provide fallback values
2. Validate URLs before inserting
3. Format dates consistently
4. Escape HTML in user-generated content
5. Use descriptive names like `userFirstName` not just `name`

### 🔍 Template Management

**Finding Templates:**
- Use category tabs to filter
- All templates show usage statistics
- System templates have blue badge
- Inactive templates are dimmed

**Activating/Deactivating:**
- Click eye icon on template card
- Inactive templates hidden from compose dropdown
- Keep templates but stop using them

**Deleting Templates:**
- Only user-created templates can be deleted
- System templates are protected
- Confirm before deleting
- Consider deactivating instead

### 📊 Tracking Usage

Each template tracks:
- **Usage Count:** How many times it's been used
- **Last Used:** When it was last applied
- **Created By:** Who created it
- **Updated By:** Who last modified it

**To view stats:**
1. Go to Templates tab
2. Check "Usage: X times" on each card
3. Most-used templates = most effective

### 🚨 Troubleshooting

**Template not appearing in dropdown?**
- Check if template is active (eye icon)
- Refresh the page
- Verify template category

**Variables not replacing?**
- Check spelling of variable name
- Ensure you're using `{{variableName}}` syntax
- No spaces inside brackets

**Preview not updating?**
- Fill in test variables
- Check HTML syntax
- Refresh preview by switching modes

**Email looks different when sent?**
- Email clients render differently
- Test in multiple clients
- Use inline CSS
- Avoid complex layouts

### 🆘 Need Help?

**Common Issues:**
- Template previews correctly but sends wrong content
  → Click "Apply Template" before sending
- Can't delete a template
  → System templates can't be deleted, only deactivated
- Variables showing as {{variable}}
  → Fill in all variables before applying

**Support:**
- Contact your system administrator
- Check documentation
- Review pre-designed templates for examples

---

## 📚 Additional Resources

- Full technical documentation: `EMAIL_TEMPLATES_SYSTEM_COMPLETE.md`
- Implementation summary: `EMAIL_TEMPLATES_IMPLEMENTATION_SUMMARY.md`
- Email best practices: [Standard email design guides]

Happy templating! 🎉

