# AI Orchestrator - Master Frontend Generation Instructions

You are an expert Frontend Architect specializing in building ultra-premium, interactive, 3D-infused React web applications. Your task is to generate a fully modern, professional, aesthetic, and highly animated 3D website for **Orbit — A Real-Time Social Media Platform**, based entirely on reading the backend code and following these specifications.

---

## 🎯 High-Level Goal
Build a modern, lightning-fast client-side application that communicates with the Orbit backend REST API and Socket.io server. The application must feature high-fidelity animations, a sleek dark space theme, and a responsive layout inspired by modern design systems and "X" (Twitter) UX conventions, enhanced by 3D parallax effects and scroll triggers.

---

## 🛠️ Required Technology Stack
Your implementation must exclusively use the following technologies:
1. **Core:** React 19 (concurrent mode, standard hooks) with TypeScript 5.x.
2. **Build Tool:** Vite (configured for rapid builds, code splitting, and source map caching).
3. **Styling:** Tailwind CSS v4 (for utility-first layouts, flexible dark-mode utilities, and fluid layout styling) combined with Custom Vanilla CSS for specialized effects.
4. **Animation Libraries:**
   - **GSAP (GreenSock)** + **ScrollTrigger:** For scrolling parallax, text reveals, scroll-linked canvas timelines, and timeline orchestration.
   - **Framer Motion (motion/react):** For micro-interactions (likes, active states), layout transitions, modal exits, and list enters.
5. **3D Rendering:** **Three.js** (or `@react-three/fiber` + `@react-three/drei`) for compiling real-time interactive 3D particle fields, orbit graphs, and floating glass cards.
6. **Real-Time updates:** **Socket.io Client** (to listen for events and trigger immediate state updates across components).
7. **Icons:** **Lucide React** (icons for user interactions, settings, and tabs).

---

## 📐 Golden Rules of Implementation

### 1. Zero Placeholders
Do not write incomplete code, stubbed handlers, or `// TODO` blocks. Every API endpoint must have a fully implemented hook, form validation, error boundary, and response loader.

### 2. High Aesthetics & "Wowed" First Impression
Use custom space-themed background gradients, backdrop filters (`backdrop-blur-md`), vibrant border glows (`border-white/10` with custom hover gradients), and custom typography (e.g., Google Fonts *Orbit* or *Inter*). Design every state (active, hover, selected, disabled, loading).

### 3. Immediate Optimistic Updates
Every user interaction (e.g., clicking Like, Save, Follow, or Repost) must immediately update the local React state and visual indicators. If the backend API request fails, roll back to the previous state and trigger a user-friendly toast message.

### 4. Real-Time Bidirectional Sync
Maintain a persistent Socket.io connection. You must implement instant state merging for comments, posts, typing indicators, presence, reactions, and direct messages, ensuring no duplicate elements occur during pagination.

### 5. Secure Session Management
Handle authentication cookies (`httpOnly`, `sameSite`) and CSRF tokens automatically in headers. Once a user session is active, the app must bypass the Landing page entirely, routing them straight to their Home Feed.

---

## 📁 AI Documentation Package Directory
To complete this system, refer to the following guide files located in `/ai_docs`:
1. [VISUAL_STYLE_AND_ANIMATIONS.md](file:///home/indiedev/Develooper/SDE/production/orbit/ai_docs/VISUAL_STYLE_AND_ANIMATIONS.md): The design system, HSL color palettes, Glassmorphic rules, and GSAP/Framer/3D canvas configurations.
2. [APP_FLOW_AND_ROUTING.md](file:///home/indiedev/Develooper/SDE/production/orbit/ai_docs/APP_FLOW_AND_ROUTING.md): The step-by-step layout structure, pages (Landing, Feed, Profile, Chat, Notifications, Search, Saves, Settings), and access permissions.
3. [BACKEND_API_CONTRACT.md](file:///home/indiedev/Develooper/SDE/production/orbit/ai_docs/BACKEND_API_CONTRACT.md): The complete REST API mappings, payload expectations, query strings, and controller mappings.
4. [SOCKET_IO_SPECIFICATION.md](file:///home/indiedev/Develooper/SDE/production/orbit/ai_docs/SOCKET_IO_SPECIFICATION.md): The real-time listener schema and dispatcher methods for bidirectional socket events.

---

## 🚀 Execution Strategy for the Generating AI Tool
1. **Analyze:** Parse the models, schemas, and routes in `orbit-server/src`. Understand the payload shape of all backend resources.
2. **Design tokens:** Set up `index.css` and the Tailwind configuration matching the specifications in `VISUAL_STYLE_AND_ANIMATIONS.md`.
3. **Core wrappers:** Implement the HTTP client wrapper (`api.ts`), custom hooks (like `useAuth`, `useSocket`), and central React context providers.
4. **Layout framework:** Build the main responsive layouts, navigation docks, and sidebars.
5. **Page elements:** Build the components one by one, adding real-time socket events and optimistic actions immediately.
6. **Polishing:** Layer in Three.js backgrounds, GSAP scroll triggers, and Framer Motion micro-effects.
