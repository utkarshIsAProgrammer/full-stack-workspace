# Application Flow, Navigation, and Pages Specification

This document defines the routing, permission guards, state flows, and page layout architecture for the Orbit frontend application.

---

## 🔒 1. Access Control and Session Redirection Rules

Implement a strict authentication status watcher using a React context (`AuthContext`) that verifies user credentials on boot.

```
                  ┌──────────────────────┐
                  │   User Opens App     │
                  └──────────┬───────────┘
                             │
                  Is JWT Token Saved?
                   /            \
                (Yes)           (No)
                /                  \
   ┌───────────────────────┐   ┌───────────────────────┐
   │ Redirect to Home Feed │   │  Display Landing Page │
   │  (Bypass Landing Page)│   └───────────┬───────────┘
   └───────────────────────┘               │
                                   Clicks "Explore"
                                           │
                               ┌───────────▼───────────┐
                               │  Explore Mode (Read)  │
                               │  - Browse Feed        │
                               │  - View Public Profile│
                               │  - Search Posts/Users │
                               └───────────┬───────────┘
                                           │
                              Triggers Interactive Action
                              (Post, Like, Save, Comment, Chat)
                                           │
                               ┌───────────▼───────────┐
                               │ Open Glass Auth Modal │
                               │   (Login or Signup)   │
                               └───────────────────────┘
```

### A. Auth Guards
- **Authenticated State:** Once a user is verified (via session cookie or context state), they must never see the Landing page. Any attempt to navigate to `/` or `/landing` must redirect to `/feed`.
- **Explore Mode (Anonymous):** The Landing page must include an "Explore" button. Clicking this puts the app in a **Guest session** where the user can view the Home Feed, search for posts/users, and read public comments.
- **Action Triggers:** If a guest user attempts any write operation (e.g., Liking a post, following an account, writing a comment, opening the Chat menu, creating a post), intercept the click, halt the action, and open a glassmorphic **Auth Overlay Modal** with Signup and Login options.

---

## 📐 2. Desktop Column Layout (X-Inspired Layout)

On desktop viewports (width >= 1024px), divide the view into a clean, glassmorphic 3-column system:

```
┌─────────────────┬───────────────────────────────────┬──────────────────┐
│ Left Column     │ Center Column (Main Viewport)     │ Right Column     │
│ (Width: 20%)    │ (Width: 55%)                      │ (Width: 25%)     │
├─────────────────┼───────────────────────────────────┼──────────────────┤
│ Floating Dock   │ Scrollable content area.          │ Context Sidebar  │
│ - Feed          │ Shows:                            │ - Search Bar     │
│ - Chat          │ - Post Composer Card              │ - Trending Tags  │
│ - Notifications │ - Scroll Feed (Has scroll trigger)│ - Suggested      │
│ - Saves         │ - Expanded Chat Thread            │   Follows        │
│ - Profile       │ - Profile View                    │ - Active Users   │
└─────────────────┴───────────────────────────────────┴──────────────────┘
```

### Mobile Layout Adaptations (Width < 1024px)
- **Left Column:** Hide completely. Replace with a bottom floating dock overlay (`backdrop-blur-lg border-t border-white/10`) containing icons for Home, Search, Messages, Notifications, and Profile.
- **Right Column:** Hide completely. Move the search bar to a slide-down header tab.
- **Float Action Button (FAB):** Add a floating circular "+" button in the bottom right corner to trigger the Post Composer Modal.

---

## 📄 3. Detailed Page Layouts

### A. Landing Page
- **Hero Section:** Sleek typography centered over the interactive 3D particle canvas.
- **Value Cards:** 3 staggered cards highlighting:
  - **Instant Connections:** Real-time messaging and feedback.
  - **Space Aesthetic:** Highly-animated custom dark atmosphere.
  - **Secure Circles:** Double-submit CSRF and strict cookie storage.
- **CTAs:** Large buttons: "Join Orbit Now" (opens Auth Modal) and "Explore Feed" (routes to feed as Guest).

### B. Home Feed
- **Post Composer Card (Authenticated users only):**
  - **Header:** Input text area with characters count (max 5,000 characters).
  - **Mention Box:** Typing `@` fetches user list suggestions dynamically and autocompletes upon selection.
  - **Image Attachment:** Supports up to 5 images. Includes a crop button triggering an `ImageCropModal` with a crop canvas interface.
- **Scroll Feed:**
  - Infinitely scrolling list fetching 10 posts at a time using cursor pagination.
  - Interactive cards showing: Title, Body (parse `#hashtags` and `@mentions` into active link tags), Image carousel, and Action Counts (Likes, Reposts, Comments, Saves).
  - A real-time banner that slides down from the header: *"New post from [User]! Click to view."*

### C. Profiles
- **Banner and Avatar:** Editable cover banner image and circular avatar (crop support).
- **Meta Info:** Username, bio text (max 500 characters), active website link, and joined date.
- **Follow Stats:** Follower and Following counts. Clicking on these opens a overlay list of users.
- **Tabbed Views:** Toggle between:
  1. **Posts:** Original posts created by this user.
  2. **Reposts:** Posts reshared by this user.
  3. **Saved (Private):** Bookmarked posts (visible only to profile owner).

### D. Chat Center (Direct Messages)
- **Conversations Panel:** Left-hand list showing users sorted by last message timestamp. Display active green presence dots next to avatars of online users.
- **Message Area:**
  - **Active Header:** Recipient profile and status indicator (Online / Last Seen time).
  - **Message History:** Bubbles aligned left (received) or right (sent).
  - **Typing Indicator:** A pulsing glassmorphic bubble with loading dots when the other participant emits `chat:typing`.
  - **Reactions:** Hovering over a message opens an emoji reaction ribbon. Selected emojis render directly attached to the bubble border with reaction counts.

### E. Notifications Tab
- List of events: *"John Doe liked your post"*, *"Sarah comment on your post"*, *"Alex followed you"*.
- Unread notifications highlight with a soft blue backdrop glow.
- Header button to trigger marking all notifications as read instantly.
