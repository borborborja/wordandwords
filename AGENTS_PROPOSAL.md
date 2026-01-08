# 🤖 AI Protocol: PROJECT v2 (High Performance Edition)

> **Role**: You are an Expert Full-Stack Engineer specializing in **Golang**, **React Performance**, and **Distributed Systems**.
> **Objective**: Build a lightning-fast, scalable, and crash-proof multiplayer real-time game.

## 🏗️ Tech Stack Strategy (The "Speed" Stack)

### 🟢 Backend: Golang + PocketBase (Framework)
*   **Documentation**: [PocketBase as Framework](https://pocketbase.io/docs/use-as-framework/)
*   **Why**: Best of both worlds. You get a production-ready **Admin Dashboard**, **Auth**, and **DB Management** out of the box (saving weeks of work), but you import it as a Go library to write your own **Custom Game Logic** in the same process.
*   **Architecture**:
    *   **Core**: PocketBase serves the API, Authentication, and Admin UI (`/_/`).
    *   **Game Loop**: Your custom Go code hooks into PocketBase routing to handle high-performance WebSockets on the same port.
    *   **Deploy**: Compiles to a **single executable file**. No Docker containers needed for the DB (SQLite embedded).
    *   **ORM**: `GORM` or direct `SQLX` (for raw performance).

### 🔵 Frontend: React + Vite + Zustand
*   **Why**: React for component ecosystem. **Zustand** for state management because it works outside the React render loop (transient updates) which is critical for 60fps game animations.
*   **Performance Rules**:
    *   ❌ NEVER put high-frequency data (timers, mouse coordinates) in `useState` or `Context`.
    *   ✅ Use `useRef` or direct DOM manipulation for animations.
    *   ✅ Use `React.memo` aggressively for board cells.

### 💾 Infrastructure: Docker Optimized
*   **Build**: Multi-stage Dockerfile.
*   **Runtime**: `scratch` or `alpine` image. Final image size should be **< 20MB**.

---

## 📏 Coding Standards & "The Constitution"

### 1. 🚀 Performance First (No "Lazy" Code)
*   **Backend**: Avoid reflection. Use pointers for large structs (Game State). pre-allocate slices (`make([]T, 0, cap)`).
*   **Frontend**: Validate re-renders. If a user types, ONLY the input component should re-render, not the whole layout.
*   **Communication**:
    *   ❌ DO NOT send the entire `GameState` (5KB) every second.
    *   ✅ Send **Deltas/Actions** (e.g., `{"op": "move", "id": 123, "x": 5, "y": 5}`).

### 2. 🛡️ Robustness & Error Handling
*   **Go**: Handle EVERY error. `if err != nil { return err }`. Panic is only for startup failures.
*   **State**: Game Logic must be atomic. Use **Mutexes** (`sync.RWMutex`) when accessing the `Games` map.
*   **Validation**: Never trust the client. Re-validate every move on the server (Physics, Rules, Permissions).

### 3. 🎨 Visual Excellence & UX Standards
*   **Responsiveness**: "Write once, run everywhere". The UI must be perfect on both **Desktop** and **Mobile** (PWA).
*   **Navigation**: Standard **Top Menu** (or responsive Hamburger) for general options (Home, Profile, Settings) accessible at all times.
*   **Theming**: First-class support for **Light ☀️ / Dark 🌙 Mode** (system sync by default).
*   **Localization (i18n)**: MANDATORY support for **Catalan (CA)**, **Spanish (ES)**, and **English (EN)** from day one. No hardcoded strings.
*   **Animations**: Use `transform` and `opacity` ONLY (GPU accelerated). Use CSS Variables (`--glass-bg`, `--glass-border`).

### 4. 📝 Documentation & Types
*   **Backend**: Comment all public functions. Use Swagger/OpenAPI for REST endpoints.
*   **Frontend**: Strict TypeScript. No `any`. Define shared types in a `shared/types.ts` or generate them from Go structs.

## 🧪 Workflow for Agents
1.  **Context**: Before writing code, analyze if the change affects the "Hot Path" (Game Loop).
2.  **Plan**: If changing logic, write a short plan.
3.  **Execute**: Implement in small, testable chunks.
4.  **Verify**: Check "Did I increase bundle size? Did I add latency?".

---

## 📂 Implementation Hints
*   **Game Loop**: Use a `time.Ticker` in a Goroutine for turn timers, separate from the request handling.
*   **Broadcasting**: Use a Hub pattern to manage WebSocket connections.
*   **Persistence**: Write to SQLite/Postgres asynchronously (don't block the game move on DB write).

## 📱 Mobile Strategy (3-Level Evolution)

This project is designed to evolve from Web to App Store without rewriting the core.

### 🟢 Level 1: PWA (Current Standard)
*   **Goal**: Zero-install "Add to Home Screen".
*   **Tech**: `manifest.json`, Service Workers (offline assets), Viewport meta tags (prohibit zoom).
*   **Result**: Full-screen experience, feels native on Android/iOS but runs in browser engine.

### 🟡 Level 2: Capacitor Wrapper (Hybrid)
*   **Goal**: Play Store / App Store release.
*   **Tech**: [Capacitor](https://capacitorjs.com/).
*   **Strategy**:
    *   Initialize: `npx cap init`.
    *   Build: `npm run build` -> Copy to `android` folder.
    *   **Plugins**: Use Capacitor plugins for Haptic Feedback (vibration on move) and Push Notifications.
*   **Code Sharing**: 100% reuse of React frontend.

### 🔴 Level 3: Native UI (Long Term)
*   **Goal**: 60fps Native Performance & Complex Gestures.
*   **Tech**: React Native or Flutter.
*   **Strategy**: Rebuild **only** the `client` folder. Keep the Go backend exactly as is.

