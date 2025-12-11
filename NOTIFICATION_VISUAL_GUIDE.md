# Smart Notification System - Visual Guide

## 🔔 Notification Bell Component

### Unopened Notifications (Badge with Count)

```
┌─────────────────────────────────┐
│  [Header Navigation Bar]        │
│                                 │
│  🏠 Home   📋 Apps   👤 Profile │
│                                 │
│               🔔  ← Bell Icon   │
│              ┌──┐               │
│              │ 5│ ← Red Badge   │
│              └──┘   (pulsing)   │
│                  White Number   │
└─────────────────────────────────┘
```

**Specifications:**
- Badge Color: Red (#EF4444)
- Number Color: White (#FFFFFF)
- Badge Shape: Circle
- Badge Size: 20px height, min-width 20px
- Font: Bold, 10px
- Animation: 2-second pulse
- Position: Top-right corner of bell icon

### States

#### No Notifications
```
🔔  ← Just the bell icon, no badge
```

#### 1-99 Notifications
```
🔔
┌──┐
│ 5│  ← Shows exact number
└──┘
```

#### 100+ Notifications
```
🔔
┌───┐
│99+│  ← Shows "99+" for large counts
└───┘
```

## 📋 Notification Dropdown

### Dropdown Layout

```
┌────────────────────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃  Notifications        ✓ Mark all read ┃ │ ← Header (gradient)
│ ┃  5 unread notifications                ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 📄 Missing Required Documents    • NEW│ │ ← Unread (blue bg)
│ │    You have 3 missing documents...    │ │
│ │    2 minutes ago                      │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 💳 Payment Reminder                   │ │ ← Unread (blue bg)
│ │    Your payment of $450 is pending... │ │
│ │    3 hours ago                   • NEW│ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 🕐 Timeline Updated                   │ │ ← Read (normal bg)
│ │    Step "Credentialing" completed     │ │
│ │    1 day ago                          │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃        View all notifications          ┃ │ ← Footer
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└────────────────────────────────────────────┘
```

### Notification Item States

#### Unread Notification
```
┌────────────────────────────────────────┐
│ 🔵 Missing Required Documents    • NEW│ ← Bold title
│    You have 3 missing documents. Plea-│
│    se upload them to proceed...       │
│    2 minutes ago                  • NEW│
│                                        │
│ ◄── 4px blue left border              │
│ ◄── Light blue background             │
│ ◄── Red dot indicator                 │
└────────────────────────────────────────┘
```

#### Read Notification
```
┌────────────────────────────────────────┐
│ 🕐 Timeline Updated                    │ ← Normal weight
│    Step "Credentialing" has been comp-│
│    leted in your application timeline │
│    1 day ago                           │
│                                        │
│ ◄── White/Gray background (no border) │
└────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Notification Type Icons & Colors

| Type | Icon | Color | Hex Code |
|------|------|-------|----------|
| Document Reminder | 📄 File | Blue | #3B82F6 |
| Payment Reminder | 💳 Card | Green | #10B981 |
| Timeline Update | 🕐 Clock | Purple | #8B5CF6 |
| Profile Completion | 👤 User | Orange | #F59E0B |
| General | 🔔 Bell | Gray | #6B7280 |

### Badge States

| State | Background | Text | Border |
|-------|------------|------|--------|
| Unread Badge | Red #EF4444 | White #FFFFFF | None |
| Unread Item | Blue #EFF6FF | Dark #111827 | Left: Blue #3B82F6 |
| Read Item | White #FFFFFF | Gray #4B5563 | None |

## 📱 Responsive Design

### Desktop (> 768px)
```
┌──────────────────────────────┐
│ Dropdown Width: 420px        │
│ Max Height: 600px            │
│ Position: Right-aligned      │
│ Shadow: 2xl                  │
└──────────────────────────────┘
```

### Mobile (< 768px)
```
┌────────────────────────────────┐
│ Width: 100vw - 2rem (edges)   │
│ Max Height: 600px             │
│ Position: Center-aligned      │
│ Shadow: 2xl                   │
└────────────────────────────────┘
```

## 🎬 Animations

### Badge Pulse
```
Animation: pulse
Duration: 2 seconds
Effect: Scale 1.0 → 1.05 → 1.0
Repeat: Infinite
Easing: Ease-in-out
```

### Notification Entrance
```
Animation: Slide in from right
Duration: 300ms
Effect: translateX(100%) → translateX(0)
Easing: Ease-out
```

### Hover Effects
```
Notification Item Hover:
- Background: Lighten 5%
- Transition: 200ms ease
- Cursor: Pointer
```

## 📄 Full Notifications Page

```
┌─────────────────────────────────────────────────────┐
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  🔔 Notifications                              ┃  │
│  ┃     You have 5 unread notifications           ┃  │
│  ┃                                                ┃  │
│  ┃  [ All (12) ]  [ Unread (5) ]    ✓ Mark all  ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📄 Missing Required Documents          • NEW │  │
│  │    You have 3 missing documents. Please up-  │  │
│  │    load them to proceed with your applicat-  │  │
│  │    ion.                                      │  │
│  │    2 minutes ago          [Mark as read]    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 💳 Payment Reminder                    • NEW │  │
│  │    Your payment of $450.00 for Step 1 is    │  │
│  │    still pending. Please complete the pay-   │  │
│  │    ment to continue.                         │  │
│  │    3 hours ago            [Mark as read]    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🕐 Timeline Updated                          │  │
│  │    Step "Credentialing" has been completed   │  │
│  │    in your application timeline.             │  │
│  │    1 day ago                                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [ More notifications... ]                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 🔄 User Interaction Flow

### Opening Notification

```
Step 1: Click Bell
┌─────┐
│ 🔔  │ ← User clicks
│ ┌─┐ │
│ │5│ │
│ └─┘ │
└─────┘

Step 2: Dropdown Opens
┌─────┐  ┌──────────────────┐
│ 🔔  │  │ Notifications    │
│     │  │ ┌──────────────┐ │
└─────┘  │ │ Document...  │ │
         │ └──────────────┘ │
         │ ┌──────────────┐ │
         │ │ Payment...   │ │
         │ └──────────────┘ │
         └──────────────────┘

Step 3: Click Notification
         ┌──────────────────┐
         │ Notifications    │
         │ ┌──────────────┐ │
         │ │►Document...  │◄── User clicks
         │ └──────────────┘ │
         └──────────────────┘
                ↓
         Navigate to /documents
                ↓
         Mark as read (badge decreases)
```

### Badge Update Flow

```
5 Unread → Click → Mark as Read → 4 Unread
┌──┐              ✓              ┌──┐
│ 5│                             │ 4│
└──┘                             └──┘
```

## 🎯 Design Principles

### Visual Hierarchy
1. **Red badge** - Most urgent, immediate attention
2. **Unread items** - Blue background, bold text
3. **Read items** - Normal appearance, archived
4. **Icons** - Color-coded by importance/type

### User Experience
- **One-click navigation** - Direct to relevant page
- **Auto-read marking** - No extra clicks needed
- **Real-time updates** - No refresh required
- **Clear actions** - Obvious what to do next

### Accessibility
- **High contrast** - Red on white for badge
- **Clear labels** - Descriptive notification titles
- **Keyboard navigation** - All actions accessible
- **Screen reader friendly** - Proper ARIA labels

## 📊 State Transitions

```
New Notification Created
         ↓
Badge Count Increases (+1)
         ↓
Appears in Dropdown (Top)
         ↓
Real-time Update (All Tabs)
         ↓
User Clicks Notification
         ↓
Navigate to Page
         ↓
Mark as Read
         ↓
Badge Count Decreases (-1)
         ↓
Item Styling Changes
         ↓
Real-time Update (All Tabs)
```

## 🎨 CSS Classes Reference

### Badge
```css
.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  background: #EF4444;
  color: white;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: bold;
  animation: pulse 2s infinite;
}
```

### Unread Item
```css
.notification-unread {
  background: #EFF6FF;
  border-left: 4px solid #3B82F6;
  font-weight: 600;
}
```

### Read Item
```css
.notification-read {
  background: white;
  font-weight: 400;
}
```

## ✨ Polish Details

### Micro-interactions
- **Hover**: Slight background lighten (200ms)
- **Click**: Subtle scale down (100ms)
- **Badge pulse**: Gentle breathing effect (2s)
- **Dropdown entrance**: Smooth slide + fade (300ms)

### Typography
- **Title**: 14px, Semibold (Unread: Bold)
- **Message**: 12px, Regular
- **Timestamp**: 12px, Medium, Gray
- **Badge number**: 10px, Bold, White

### Spacing
- **Item padding**: 16px (1rem)
- **Gap between items**: Divider line
- **Icon margin**: 12px right
- **Badge offset**: -4px top/right

---

This visual guide complements the technical documentation and provides designers and developers with clear visual references for implementing and maintaining the notification system.

