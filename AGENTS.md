# WordAndWords — Guía para agentes de IA

> **Léelo entero antes de tocar código.** Este documento describe la arquitectura real
> y, sobre todo, las **invariantes que NO se pueden romper**. Cada regla de la sección
> "🚨 Invariantes críticas" corresponde a un bug real que ya ocurrió. Si tu cambio
> contradice una de ellas, estás reintroduciendo un fallo conocido.

---

## 🏗️ Qué es y cómo está montado

Juego de palabras multijugador estilo Scrabble, en tiempo real vía WebSockets.

| Componente | Path | Descripción |
|-----------|------|-------------|
| **Servidor** | `/server` | Node.js + Express + Socket.IO. **Autoridad del juego.** |
| **Cliente** | `/client` | React 18 + Vite. Solo presentación. |
| **Diccionarios** | `/server/dictionaries/*.txt` | Lista de palabras por idioma (`ca`, `en`, `es`). Una palabra por línea. |
| **Persistencia** | `/server/games.json`, `/server/data/users.json`, `/server/archive.json` | **Ficheros JSON**, reescritos enteros en cada cambio. **No hay base de datos SQL.** |

### Stack
- **Backend**: Node.js con **ES Modules** (`"type": "module"` — usa `import`, nunca `require`). Express + Socket.IO + uuid + web-push + nodemailer.
- **Frontend**: React 18 (solo componentes funcionales + hooks), Vite, **CSS plano con variables CSS** (NO Tailwind), i18n propio en `/client/src/i18n`.
- **Puertos**: servidor `3001`, cliente dev `5173`. En producción el servidor sirve el build estático de `/client/dist`.

### Arrancar en desarrollo
```bash
# Terminal 1
cd server && npm install && npm run dev
# Terminal 2
cd client && npm install && npm run dev
```

---

## 🚨 Invariantes críticas (NO romper)

### 1. El servidor es la autoridad. Nunca confíes en el cliente.
Toda la lógica de juego (validar colocación, palabras, puntuación, turnos, robar fichas)
vive en `/server/game/`. El cliente solo dibuja y manda intenciones.
- `makeMove` **valida que cada ficha jugada esté en el atril del jugador** antes de aplicarla (`engine.js`). No elimines esa comprobación: sin ella un cliente manipulado juega letras que no tiene y roba fichas del saco.
- `exchangeTiles` valida que el jugador posee las fichas **antes** de tocar el saco. El orden importa: validar → robar → quitar → devolver → barajar. Si robas antes de validar, una petición inválida corrompe el saco.

### 2. El diccionario del juego lo posee `server/game/validator.js`.
Hay **un único** almacén de palabras en memoria (el `Map` de `validator.js`).
- El arranque DEBE llamar a `initializeDictionaries()` **importado de `validator.js`** (no a una función local con el mismo nombre).
- El admin recarga con `reloadDictionary`/`addWordsToDictionary` de `validator.js`.
- ❌ **Nunca** crees una segunda caché de diccionario en `server.js`. Ya pasó: había una caché paralela que el validador no usaba → `isValidWord()` devolvía siempre `false` y **ninguna palabra era válida**.

### 3. "Primer movimiento" = tablero vacío, NO `moveHistory.length === 0`.
`moveHistory` también acumula pases, cambios y penalizaciones. Detecta el primer
movimiento con `game.board.every(row => row.every(cell => !cell))`. Si usas la longitud
del historial, una partida en la que alguien pasa antes de la primera palabra queda
**bloqueada** (se exige "conectar" sobre un tablero vacío).

### 4. Fichas en blanco (comodines).
- En el atril, un comodín es `{ letter: '', value: 0, isBlank: true }`.
- Al colocarlo, el cliente pide la letra y manda `{ row, col, letter: <ELEGIDA>, value: 0, isBlank: true }`.
- El tablero guarda la letra elegida (para que las palabras se lean), pero la posición se marca en `game.blankCells["row,col"] = true` y **puntúa 0** siempre.
- Al quitar del atril, los comodines se emparejan por `isBlank`, no por letra.

### 5. El estado SOLO llega al cliente vía `getGameStateForPlayer(game, playerId)`.
Esa función oculta el saco (`tileBag`), oculta las fichas de los rivales y **redacta las
fichas de `historyLogs[].racksSnapshot`** mientras la partida está en curso.
- ❌ Nunca emitas el objeto `game` crudo por socket: filtra el saco y los atriles rivales (incluida la consola del navegador).
- Si añades datos sensibles al estado, ocúltalos también aquí.

### 6. `socket.emit` del hook `useSocket` devuelve una **Promesa**.
En el cliente: `await socket.emit('evento', data)`. El ack del servidor resuelve/rechaza
la promesa.
- ❌ **No** pases un tercer argumento callback (`socket.emit(ev, data, cb)`): el hook lo ignora y la promesa queda colgada para siempre. Ya pasó con `exchangeTiles`/`sendMessage`.

### 7. El temporizador de turno es del servidor.
El auto-pase por tiempo lo gestiona `scheduleTurnTimer`/`turnTimers` en `server.js`, para
que un turno expire aunque el jugador cierre el navegador. El temporizador del cliente
(`Game.jsx`) es **solo visual**. No vuelvas a disparar `onPass()` desde el cliente: provoca
doble pase en carrera con el servidor.

### 8. Todos los endpoints `/api/admin/*` llevan `adminAuth`.
Sin excepción. Filtrar la lista de usuarios expone emails y **códigos de recuperación**
→ robo de cuenta trivial vía `/api/user/recover`. Si añades un endpoint admin, añade el
middleware `adminAuth`.

### 9. Secretos solo por entorno.
Nada de claves VAPID ni contraseñas en el código ni en `.env.example`. Si faltan las VAPID,
el servidor genera un par efímero en arranque (y avisa). `ADMIN_PASSWORD` por defecto es
`admin123` **solo para dev**: en producción es obligatorio fijarla.

### 10. Persistencia = reescritura de fichero completo.
- Guarda partidas con `saveGame(game)` (reescribe `games.json` con todo el `Map`).
- Para tocar la lista de partidas de un usuario usa los helpers de `server/users.js`
  (`addGameToUser`, `removeGameFromUser`, `removeGameFromAllUsers`). ❌ No leas/escribas el
  fichero de usuarios directamente desde `server.js` (no existe `USERS_FILE` ahí — provoca `ReferenceError`).

---

## 🔌 Eventos Socket.IO

**Cliente → Servidor** (todos responden por ack/callback con `{ success, ... }`):
`register`, `createGame`, `joinGame`, `startGame`, `makeMove`, `passTurn`, `exchangeTiles`,
`sendMessage`, `rejoinGame`.

**Servidor → Cliente** (broadcast):
`gameUpdate`, `gameStarted`, `gameEnded`, `playerJoined`, `playerReconnected`,
`playerDisconnected`, `gameCancelled`, `gameTerminated`.

Notas:
- `joinGame` y su variante devuelven `playerId` en el ack: úsalo para identificar al jugador. **No** lo adivines por nombre (los nombres pueden duplicarse).
- `broadcastGameUpdate(game)` es la única vía de difusión: manda `gameUpdate` personalizado a cada jugador, lanza el push "es tu turno" **solo al cambiar de turno**, y programa el temporizador. Úsala tras cualquier cambio de estado.

---

## 🎮 Reglas del juego (referencia)

- Tablero 15×15, casilla central `ST` (cuenta como doble palabra). La primera palabra debe cruzar el centro.
- Fichas por idioma y sus valores en `server/game/tiles.js` (100 fichas por set, incluye dígrafos como `CH`, `LL`, `NY`, `L·L`, `RR` y 2 comodines).
- Movimientos por turno: **jugar** palabra, **pasar**, o **cambiar** fichas (requiere ≥7 en el saco).
- Puntuación: multiplicadores `DL/TL` (letra ×2/×3) y `DW/TW/ST` (palabra ×2/×3) solo cuando la ficha es **nueva**. Bonus de 50 por usar las 7 fichas (bingo). Comodines = 0.
- Fin: un jugador agota su atril con el saco vacío, o todos pasan `2×nº jugadores` veces seguidas. Al terminar se restan las fichas sobrantes; el que cierra suma lo que restan los demás. Empates → `game.isTie = true`.
- **Modo estricto**: una palabra inválida = pierdes el turno (penalización). Sin él, el movimiento se rechaza y puedes reintentar.

---

## 🎨 Convenciones de código

- **ESM siempre** en el servidor (`import`/`export`). Extensión `.js` explícita en imports relativos.
- **React**: solo componentes funcionales + hooks. Nada de clases (salvo `ErrorBoundary`). Respeta las dependencias de `useEffect`/`useCallback`.
- **CSS**: variables de `index.css` (`var(--...)`), un `.css` por componente. Estilo "glassmorphism". Diseño responsive (móvil = drawers/modales). No añadas Tailwind ni librerías de UI.
- **i18n**: todo texto visible pasa por `t('clave')` con fallback (`t('x') || 'Texto'`). Añade las claves a los tres idiomas en `/client/src/i18n`.
- **Comentarios**: explica el *porqué* de la lógica no obvia (sobre todo en `engine.js`), no el *qué*.

---

## ✅ Checklist antes de dar por hecho un cambio

1. ¿La lógica de juego nueva está en el **servidor** y valida la entrada del cliente?
2. ¿El estado que sale al cliente pasa por `getGameStateForPlayer` (sin filtrar saco/atriles)?
3. ¿Tocaste diccionario? Usa las funciones de `validator.js`, no una caché nueva.
4. ¿Endpoint admin nuevo? Lleva `adminAuth`.
5. ¿Secretos? Solo por env.
6. **Verifica de verdad**:
   - Servidor arranca: `cd server && node server.js` (debe cargar diccionarios y decir "Server running").
   - Cliente compila: `cd client && npm run build`.
   - Motor: prueba una jugada real (ver que una palabra del diccionario puntúa y avanza el turno).
7. No dejes `console.log` de depuración nuevos ni código muerto.

---

## ⚠️ Deuda conocida (cuidado al tocar)

- **Persistencia frágil**: `games.json` se escribe en el CWD del servidor, no en `DATA_DIR`/`/app/data`. En Docker, si solo montas `/app/data`, las partidas no sobreviven a reinicios. Si lo arreglas, hazlo de forma consistente para partidas, usuarios y archivo.
- **Diccionarios ES/EN cortos** (~1.6k / ~1k palabras) frente al catalán completo (~583k). Jugar en es/en es limitado hasta ampliarlos.
- **`dictionaries/` (raíz) vs `server/dictionaries/`**: el juego lee de `server/dictionaries/`. La carpeta raíz es para el montaje Docker; mantenlas sincronizadas o unifícalas.
- **Auth admin básica**: el "token" admin es la propia contraseña. Suficiente para uso casero; si abres el panel a internet, refuérzalo.
