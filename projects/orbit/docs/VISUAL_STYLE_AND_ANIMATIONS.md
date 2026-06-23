# Visual Style and Animations Specification

This document details the exact design tokens, typography, layout rules, and animation blueprints for building the Orbit frontend. Use these specifications to ensure the application looks premium, futuristic, and highly interactive.

---

## 🎨 1. Color Palette (Dark Space Theme)

To create an immersive dark space aesthetic, implement a rich, dark theme with vibrant nebula accents. Avoid plain blacks (#000) or generic gray colors.

| Token | CSS Variable / Tailwind | Hex Value | Semantic Role / Description |
|---|---|---|---|
| **Deep Space** | `--bg-space` / `bg-space` | `#030308` | Main canvas background. Deepest obsidian black with a subtle blue tint. |
| **Ether Gray** | `--bg-ether` / `bg-ether` | `#0b0a14` | Card, container, and sidebar background. Sleek translucent background. |
| **Galaxy Violet** | `--accent-violet` | `#6366f1` | Highlights, buttons, links, active tab indicators (Indigo-600 equivalent). |
| **Stellar Teal** | `--accent-teal` | `#14b8a6` | Real-time presence badges, updates, tooltips, verified symbols (Teal-500). |
| **Nebula Magenta** | `--accent-magenta` | `#ec4899` | Heart reactions, alerts, special post highlights, direct message highlights. |
| **Dust White** | `--text-dust` | `#e2e8f0` | Main body copy text. Low-glare, high contrast (Slate-200). |
| **Cosmic Gray** | `--text-cosmic` | `#94a3b8` | Subtext, timestamps, inactive counts, placeholders (Slate-400). |
| **Atmosphere Border** | `--border-atmosphere`| `rgba(255, 255, 255, 0.08)` | Thin divider lines and glass boundaries. |

---

## 🫧 2. Glassmorphism Design System

All cards, modals, and headers must follow these glassmorphism styling rules:
- **Translucency:** Combine background opacity and backdrop filter.
  ```css
  background: rgba(11, 10, 20, 0.45);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  ```
- **Dual-Layer Border:** Add a sub-pixel border overlay to simulate light refractions:
  ```css
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);
  ```
- **Nebula Glow (Hover States):** When hovering over interactive glass cards, apply a dynamic gradient shadow:
  ```css
  box-shadow: 
    0 10px 40px -10px rgba(99, 102, 241, 0.15),
    inset 0 1px 1px rgba(255, 255, 255, 0.1);
  ```

---

## 🌐 3. Interactive 3D Canvas (Three.js / React Three Fiber)

Implement an interactive 3D background wrapper (`3DCanvasBackdrop`) that remains active across all routes, changing state depending on the active view.

### A. Landing Page State: "The Orbit Gravity Well"
- **Particles:** A system of 1,500 - 2,500 small particle stars (colored slate and stellar teal) floating in a 3D field.
- **Center Node:** A glowing, rotating wireframe sphere (the "Core") that represents the Orbit platform.
- **User Cursor Interaction:** Particles must gravitate slightly toward the user’s cursor coordinates on hover.
- **GSAP Integration:** As the user scrolls down the landing page, the camera must zoom into the central node, eventually transitioning into the galaxy star-field background for the Home Feed.

### B. Feed/App State: "Nebula Dust"
- Transition the central node away (fade opacity to 0).
- Keep a gentle, slow-moving particle field drifting in the background to maintain depth without distracting the user from post content.

---

## ⚡ 4. Scroll-Triggered Animations (GSAP)

Use GSAP and ScrollTrigger for the Landing Page layout to build smooth, cinematic scroll-driven reveals:

1. **Header Split-Text Reveal:**
   - On load, use GSAP to split the main title "Orbit — Your Inner Circle" into individual letters.
   - Animate each letter upward with a stagger effect (`duration: 0.8, y: 100, opacity: 0, ease: "power4.out"`).
2. **Parallax Scrolling Sections:**
   - The landing page content cards must rise at different speeds (`data-speed="1.2"`, `data-speed="0.8"`).
3. **Scroll-Bound Card Reveals:**
   - Stagger the entrance of the core value cards (Real-Time Chat, Security, Custom Collections).
   - ScrollTrigger configuration:
     ```javascript
     gsap.from(".feature-card", {
       scrollTrigger: {
         trigger: ".features-container",
         start: "top 80%",
         end: "bottom 20%",
         toggleActions: "play none none reverse"
       },
       y: 60,
       opacity: 0,
       stagger: 0.15,
       duration: 1,
       ease: "power3.out"
     });
     ```

---

## 🏃 5. Micro-Animations & Gestures (Framer Motion)

Apply Framer Motion for immediate UI feedback and micro-interactions:

### A. Magnetic Active Tabs & Buttons
- Apply a magnetic effect to primary buttons (`Explore`, `Login`, `New Post`) that pulls the element slightly toward the user cursor within a 20px radius.
- In-menu active tab transition: When shifting menus, the background highlighter must transition smoothly via layout projection:
  ```tsx
  <motion.div layoutId="activeTabGlow" className="absolute inset-0 bg-white/5 rounded-xl" />
  ```

### B. Interactive Emoji Reactions
- When a user adds an emoji reaction to a chat message or comment, trigger a floating animation:
  - Spawn 3 mini emoji nodes that float upwards, rotate, and fade out.
  - Scale the trigger button up (`scale: 1.2`) and return to normal (`scale: 1`) using a spring transition.
  ```typescript
  const reactionSpring = { type: "spring", stiffness: 400, damping: 10 };
  ```

### C. Gestures for Mobile (Pull-To-Refresh)
- Drag-to-refresh container on the mobile Home Feed:
  - Set `drag="y"` with constraints `top: 0, bottom: 120`.
  - On release, if `y > 80`, trigger backend feed cache invalidation and reload, spinning a stellar loader element.
