# WordAndWords - Project Guidelines for AI Agents

> **Constitution for AI-Assisted Development**
> This document defines strict rules and best practices for contributing to the WordAndWords project.

---

## 🏗️ Project Overview

WordAndWords is a **multiplayer Scrabble-style word game** with real-time gameplay via WebSockets.

| Component | Path | Description |
|-----------|------|-------------|
| **Server** | `/server` | Node.js + Express + Socket.IO backend |
| **Client** | `/client` | React + Vite frontend |
| **Database** | `/server/data` | SQLite via better-sqlite3 |
| **Dictionaries** | `/server/dictionaries` | Word lists per language (.txt) |

---

## 🛠️ Technology Stack

### Backend (`/server`)
- **Runtime**: Node.js (ES Modules - `"type": "module"`)
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: better-sqlite3 (SQLite)
- **IDs**: uuid

### Frontend (`/client`)
- **Framework**: React 18+ (functional components only)
- **Build Tool**: Vite
- **Styling**: Vanilla CSS with CSS Custom Properties (NO TailwindCSS)
- **State**: React hooks (useState, useEffect, useCallback)
- **i18n**: Custom translation system in `/client/src/i18n`

### Development
- **Package Manager**: npm
- **Dev Server**: `npm run dev` (both client and server)
- **Ports**: Server = 3001, Client = 5173

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `GAME_NAME` | WordAndWords | Display name shown in UI |
| `ADMIN_PASSWORD` | admin123 | Admin panel login password |
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Set to `production` for static file serving |

---

## 📁 Directory Structure

```
wordandwords/
├── server/
│   ├── server.js           # Main entry point + Socket.IO handlers
│   ├── game/
│   │   ├── engine.js       # Game logic (moves, scoring, validation)
│   │   └── validator.js    # Dictionary loading and word validation
│   ├── db/
│   │   └── database.js     # SQLite database operations
│   ├── dictionaries/       # Language word lists (ca.txt, en.txt, es.txt)
│   └── data/               # SQLite database files (gitignored)
│
├── client/
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── main.jsx        # React entry point
│   │   ├── index.css       # Global styles + CSS variables
│   │   ├── App.css         # App-specific styles
│   │   ├── components/     # React components (each with .jsx + .css)
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useSocket.js    # Socket.IO connection management
│   │   │   └── useGame.js      # Game state management
│   │   ├── i18n/           # Internationalization
│   │   │   ├── index.js    # Translation hook + LANGUAGES array
│   │   │   ├── ca.json     # Catalan translations
│   │   │   ├── en.json     # English translations
│   │   │   └── es.json     # Spanish translations
│   │   └── utils/          # Utility modules
│   └── public/             # Static assets
│
├── .env.example            # Environment variable template
├── docker-compose.yml      # Docker deployment config
├── Dockerfile              # Production build
└── nginx.conf              # Nginx reverse proxy config
```

---

## 🎨 Styling Guidelines

### CSS Architecture
1. **Global Variables**: All design tokens in `/client/src/index.css` under `:root`
2. **Component Styles**: Each component has its own `.css` file
3. **No Inline Styles**: Use CSS classes, not `style={{}}` props
4. **No TailwindCSS**: Use vanilla CSS only

### Design Tokens (from `index.css`)
```css
/* Colors */
--bg-primary: #0f0f1a;
--bg-secondary: #1a1a2e;
--accent-primary: #667eea;
--accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Glass Effect */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);

/* Spacing */
--space-xs: 0.25rem;
--space-sm: 0.5rem;
--space-md: 1rem;
--space-lg: 1.5rem;
--space-xl: 2rem;

/* Border Radius */
--radius-sm: 0.5rem;
--radius-md: 1rem;
--radius-lg: 1.5rem;
```

### Visual Style
- **Theme**: Dark mode with glassmorphism
- **Effects**: `backdrop-filter: blur()` for glass panels
- **Animations**: Subtle transitions (0.2s-0.3s ease)
- **Font**: 'Outfit' from Google Fonts

### Mobile & Responsive Design
- **Mobile First Approach**: The UI adapts significantly for small screens.
- **Board Visibility**: On mobile, the board takes priority. It occupies up to 82% of the vertical space (`82dvh`).
- **Footer Scoreboard**: To save space, the scoreboard moves from the sidebar to the footer (above the tile rack) on mobile devices.
- **Chat Modal**: The chat modal is full-screen (98-100% width/height) on mobile for better usability.
- **Hidden Sidebar**: The sidebar is completely hidden on mobile view to prevent layout shifts.

---

## 📝 Code Quality & Comments

> **CRITICAL**: Code must be heavily commented to facilitate maintenance by both AI agents and human DevOps.

### Commenting Guidelines
1. **Explain Intent**: Don't just explain *what* the code does, explain *why* it does it.
   ```js
   // BAD: Set width to 100%
   // GOOD: Force full width to prevent layout collapse on mobile resizing
   ```
2. **Complex Logic**: Any non-trivial logic (like the board size calculation) must have a block comment explaining the formula.
3. **CSS Hacks**: If using `!important` or specific hacks (like `min-height: 0` for flex), add a comment explaining the browser behavior being fixed.
4. **Function Headers**: Briefly describe inputs and expected side effects for key functions.

---

## 🔌 Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `register` | `{ name }` | Register new player |
| `createGame` | `{ language, playerName, strictMode, timeLimit }` | Create game room |
| `joinGame` | `{ gameId, playerName }` | Join existing game |
| `startGame` | `{}` | Host starts the game |
| `makeMove` | `{ tiles: [{row, col, letter, value}] }` | Submit word placement |
| `passTurn` | `{}` | Pass current turn |
| `exchangeTiles` | `{ tiles: [letters] }` | Exchange tiles |
| `rejoinGame` | `{ gameId, playerId }` | Reconnect to game |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `gameUpdate` | `{ game }` | Full game state update |
| `gameStarted` | `{ game }` | Game has begun |
| `playerJoined` | `{ player, playerCount }` | New player joined |
| `playerDisconnected` | `{ playerId }` | Player disconnected |
| `playerReconnected` | `{ playerId }` | Player reconnected |
| `gameEnded` | `{ winner, players }` | Game finished |
| `gameTerminated` | `{ reason }` | Game deleted by admin |

---

## 🌍 Internationalization (i18n)

### Adding Translations
1. Add keys to all JSON files in `/client/src/i18n/` (ca.json, en.json, es.json)
2. Use nested structure: `{ "section": { "key": "value" } }`
3. Use `{{param}}` for dynamic values

### Using Translations
```jsx
const { t } = useTranslation(language);
t('lobby.title');                    // Simple key
t('game.waitingTurn', { name });     // With parameters
```

### Adding New Language
1. Create `xx.json` in `/client/src/i18n/`
2. Add to `LANGUAGES` array in `/client/src/i18n/index.js`:
   ```js
   { code: 'xx', name: 'Language Name', flag: '🏳️' }
   ```
3. Add dictionary file `/server/dictionaries/xx.txt`

---

## 🎮 Game Rules (Complete Reference)

> **This game is a crossword-style word game.** The objective is to score the most points by forming words on a 15×15 board using letter tiles.

### Components
- **Board**: 15×15 grid with special bonus squares
- **Tiles**: 100 letter tiles per language (including 2 blank/wildcard tiles)
- **Rack**: Each player holds 7 tiles at a time
- **Tile Bag**: All tiles start here; players draw to replenish

---

### The Board & Bonus Squares

| Square Type | Color | Effect |
|-------------|-------|--------|
| **Double Letter (DL)** | Light Blue | 2× the value of that letter |
| **Triple Letter (TL)** | Dark Blue | 3× the value of that letter |
| **Double Word (DW)** | Pink | 2× the total word score |
| **Triple Word (TW)** | Red | 3× the total word score |
| **Center (★)** | Purple | Acts as Double Word on first turn |

**Bonus Rules:**
1. **Calculation order**: Letter bonuses first, then word bonuses
2. **One-time use**: Bonuses only apply when the tile is first placed
3. **Wildcards on word squares**: The word bonus still applies (even though wildcard = 0 points)
4. **Stacking**: If a word covers two DW squares = 4× total; two TW squares = 9× total

---

### Game Flow

#### Starting the Game
1. Each player draws 7 tiles from the bag
2. First player places a word crossing the center star (★)
3. This first word gets Double Word bonus automatically
4. Play continues clockwise

#### On Your Turn (3 Options)
1. **Place a word**: Add tiles to form a new word connected to existing tiles
2. **Exchange tiles**: Return unwanted tiles to the bag, draw new ones (loses your turn)
3. **Pass**: Do nothing (if all players pass twice consecutively, game ends)

---

### How to Form Words (5 Legal Moves)

1. **Extension**: Add letters to the beginning or end of an existing word
   - Example: `TREN` → add `ES` + `A` → `ESTRENA`

2. **Crossing (Perpendicular)**: Cross an existing word using one of its letters
   - Like a crossword intersection

3. **Parallel Play**: Place a word parallel to another, forming multiple 2-letter words
   - All adjacent letter combinations must be valid words
   - You score points for ALL words formed

4. **Hook**: Add a letter to modify an existing word AND use that letter for a new perpendicular word
   - Example: `SOL` + `A` = `SOLA`, and `A` starts `AMOR` downward

5. **Bridge**: Place tiles that incorporate existing letters in the middle
   - Example: Board has `O` and `I` spaced apart; you place `H`, `M`, `L`, `A` to form `HOMILIA`

---

### Scoring

| Rule | Description |
|------|-------------|
| **Tile Values** | Each letter has a point value (defined per language) |
| **Word Score** | Sum of all tile values (× any letter/word bonuses) |
| **Multiple Words** | If your move forms multiple words, score ALL of them |
| **Shared Letters** | A letter in two words scores in both calculations |
| **Bingo (7-tile bonus)** | Use all 7 tiles in one turn = +50 bonus points |

---

### Wildcards (Blank Tiles)

- Worth **0 points** but can represent **any letter**
- Once placed, the represented letter is fixed for the entire game
- Cannot be retrieved or changed
- Still triggers word bonuses if placed on DW/TW squares

---

### Strict Mode (Optional Rule)

When enabled (`strictMode: true`):
- **Invalid word = lose turn** (tiles returned, no points)
- When disabled: Invalid words are rejected and player must try again

---

### End of Game

The game ends when:
1. One player uses all tiles AND the bag is empty
2. All players pass consecutively (2 rounds)

**Final Scoring:**
- Each player loses points equal to their remaining tiles
- If a player emptied their rack (closed the game), they gain the total of all other players' remaining tiles

---

### Valid Words

✅ **Allowed:**
- Dictionary words, plurals, verb conjugations
- Words in the selected language dictionary

❌ **Not Allowed:**
- Proper nouns (names, places, brands)
- Abbreviations
- Prefixes/suffixes alone
- Words with hyphens or apostrophes

---

### Implementation Notes (for developers)

| Aspect | Location |
|--------|----------|
| Board layout (bonus squares) | `/server/game/engine.js` → `BOARD_LAYOUT` |
| Tile values per language | `/server/game/engine.js` → `TILE_CONFIG` |
| Word validation | `/server/game/validator.js` |
| Dictionaries | `/server/dictionaries/{lang}.txt` |

**Move Validation Logic:**
1. All placed tiles must be in a single row OR column
2. Must connect to existing tiles (except first move on center)
3. All formed words must exist in the dictionary
4. First move must cross the center star (7,7)

## 🔧 Development Workflow

### Starting Development
```bash
# Terminal 1: Start server
cd server && npm run dev

# Terminal 2: Start client
cd client && npm run dev
```

### Making Changes

1. **Components**: Create both `.jsx` and `.css` files
2. **New Features**: Update translations in all language files
3. **API Changes**: Update both server handlers and client hooks
4. **Game Rules**: Modify `/server/game/engine.js`

### File Naming Conventions
- Components: `PascalCase.jsx` + `PascalCase.css`
- Hooks: `useCamelCase.js`
- Utils: `camelCase.js`

---

## 🚫 Anti-Patterns (DO NOT DO)

1. **NO TailwindCSS** - Use vanilla CSS with variables
2. **NO class components** - Functional components only
3. **NO inline styles** - Use CSS classes
4. **NO `.env` commits** - Always gitignored
5. **NO hardcoded strings** - Use i18n for user-facing text
6. **NO synchronous file reads in hot paths** - Dictionaries loaded at startup
7. **NO external image URLs** - Keep assets local or use emojis

---

## ✅ Best Practices

1. **Always use CSS variables** for colors, spacing, radii
2. **Keep components small** - Split into sub-components
3. **Use semantic HTML** - Proper heading hierarchy
4. **Add `title` attributes** - For accessibility on icon buttons
5. **Handle loading states** - Show feedback during async ops
6. **Use memoization** - `useCallback` for event handlers passed to children
7. **Error boundaries** - Graceful error handling

---

## 🚀 Deployment

### Docker Build
```bash
docker build -t wordandwords .
docker-compose up -d
```

### Production Notes
- Server serves static files in production mode
- Nginx handles SSL and proxying
- Database persists in `/server/data/` volume

---

## 📋 Quick Reference

### Common Tasks

| Task | Command/Location |
|------|------------------|
| Add translation | `/client/src/i18n/*.json` |
| Add new component | `/client/src/components/Name.jsx` + `Name.css` |
| Modify game rules | `/server/game/engine.js` |
| Add word to dictionary | `/server/dictionaries/{lang}.txt` |
| Change styling | `/client/src/index.css` (global) or component CSS |
| Socket events | `/server/server.js` + `/client/src/hooks/useSocket.js` |

### CSS Class Utilities (from index.css)
```css
.glass          /* Glassmorphism panel */
.btn            /* Base button */
.btn-primary    /* Gradient accent button */
.btn-secondary  /* Glass button */
.input          /* Form input styling */
.animate-fade-in /* Fade in animation */
```
