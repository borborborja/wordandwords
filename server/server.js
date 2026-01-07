import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initializeDictionaries, reloadDictionary, getDictionaryWords } from './game/validator.js';
import {
    createGame,
    addPlayer,
    startGame,
    makeMove,
    passTurn,
    exchangeTiles,
    getGameStateForPlayer,
    BOARD_LAYOUT
} from './game/engine.js';
import {
    createPlayer,
    saveGame,
    getActiveGames,
    cleanupOldGames
} from './db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration from environment variables
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GAME_NAME = process.env.GAME_NAME || 'WordAndWords';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
}

// In-memory game cache
const games = new Map();

// Player to socket mapping
const playerSockets = new Map();

// Load games from database on startup
async function loadGames() {
    const activeGames = getActiveGames();
    for (const game of activeGames) {
        games.set(game.id, game);
    }
    console.log(`Loaded ${games.size} active games from database`);
}

// =====================
// REST API endpoints
// =====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/config', (req, res) => {
    res.json({ gameName: GAME_NAME });
});

app.get('/api/board-layout', (req, res) => {
    res.json(BOARD_LAYOUT);
});

app.get('/api/games', (req, res) => {
    const waitingGames = Array.from(games.values())
        .filter(g => g.status === 'waiting')
        .map(g => ({
            id: g.id,
            language: g.language,
            playerCount: g.players.length,
            createdAt: g.createdAt
        }));
    res.json(waitingGames);
});

app.get('/api/games/:id', (req, res) => {
    const game = games.get(req.params.id);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    res.json({
        id: game.id,
        language: game.language,
        status: game.status,
        playerCount: game.players.length,
        players: game.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });
});

// =====================
// Admin API endpoints
// =====================

// Middleware to verify admin password
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Invalid admin password' });
    }

    next();
}

// Admin login (verify password)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_PASSWORD });
    } else {
        res.status(403).json({ success: false, error: 'Invalid password' });
    }
});

// Get dictionary for a language
app.get('/api/admin/dictionary/:lang', adminAuth, (req, res) => {
    const { lang } = req.params;
    const words = getDictionaryWords(lang);
    res.json({ language: lang, wordCount: words.length, words });
});

// Update dictionary for a language
app.put('/api/admin/dictionary/:lang', adminAuth, (req, res) => {
    const { lang } = req.params;
    const { words } = req.body;

    if (!words || !Array.isArray(words)) {
        return res.status(400).json({ error: 'Words must be an array' });
    }

    const dictPath = path.join(__dirname, 'dictionaries', `${lang}.txt`);

    try {
        // Write words to dictionary file
        const content = words.map(w => w.trim().toUpperCase()).filter(w => w).join('\n');
        fs.writeFileSync(dictPath, content, 'utf-8');

        // Reload dictionary into memory
        reloadDictionary(lang);

        const newWords = getDictionaryWords(lang);
        res.json({ success: true, wordCount: newWords.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add words to dictionary
app.post('/api/admin/dictionary/:lang/add', adminAuth, (req, res) => {
    const { lang } = req.params;
    const { words } = req.body;

    if (!words || !Array.isArray(words)) {
        return res.status(400).json({ error: 'Words must be an array' });
    }

    const dictPath = path.join(__dirname, 'dictionaries', `${lang}.txt`);

    try {
        // Get existing words
        const existing = getDictionaryWords(lang);
        const existingSet = new Set(existing);

        // Add new words
        const newWords = words.map(w => w.trim().toUpperCase()).filter(w => w && !existingSet.has(w));
        const allWords = [...existing, ...newWords];

        // Write to file
        fs.writeFileSync(dictPath, allWords.join('\n'), 'utf-8');

        // Reload
        reloadDictionary(lang);

        res.json({ success: true, added: newWords.length, total: allWords.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get stats
app.get('/api/admin/stats', adminAuth, (req, res) => {
    const activeGames = Array.from(games.values());
    const now = Date.now();

    // Calculate ghost games (no connected players for > 30 min)
    const ghostGames = activeGames.filter(g => {
        const hasConnectedPlayers = g.players.some(p => playerSockets.has(p.id));
        const lastActivity = g.lastActivity || g.createdAt;
        const inactiveMinutes = (now - lastActivity) / 60000;
        return !hasConnectedPlayers && inactiveMinutes > 30;
    });

    res.json({
        totalGames: activeGames.length,
        waitingGames: activeGames.filter(g => g.status === 'waiting').length,
        playingGames: activeGames.filter(g => g.status === 'playing').length,
        ghostGames: ghostGames.length,
        connectedPlayers: playerSockets.size,
        dictionaries: {
            ca: getDictionaryWords('ca').length,
            en: getDictionaryWords('en').length,
            es: getDictionaryWords('es').length
        }
    });
});

// List all games for admin
app.get('/api/admin/games', adminAuth, (req, res) => {
    const now = Date.now();
    const gamesList = Array.from(games.values()).map(g => {
        const connectedCount = g.players.filter(p => playerSockets.has(p.id)).length;
        const lastActivity = g.lastActivity || g.createdAt;
        const inactiveMinutes = Math.round((now - lastActivity) / 60000);

        return {
            id: g.id,
            language: g.language,
            status: g.status,
            createdAt: g.createdAt,
            lastActivity,
            inactiveMinutes,
            playerCount: g.players.length,
            connectedCount,
            isGhost: connectedCount === 0 && inactiveMinutes > 30,
            players: g.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                connected: playerSockets.has(p.id)
            }))
        };
    });

    // Sort by lastActivity (newest first)
    gamesList.sort((a, b) => b.lastActivity - a.lastActivity);

    res.json({ games: gamesList });
});

// Delete a specific game
app.delete('/api/admin/games/:gameId', adminAuth, (req, res) => {
    const { gameId } = req.params;
    const game = games.get(gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    // Notify connected players that game was terminated
    io.to(gameId).emit('gameTerminated', { reason: 'Game deleted by administrator' });

    // Remove game
    games.delete(gameId);

    res.json({ success: true, gameId });
});

// Cleanup ghost games (no connected players for > X minutes)
app.post('/api/admin/cleanup-ghosts', adminAuth, (req, res) => {
    const { maxInactiveMinutes = 30 } = req.body;
    const now = Date.now();
    let cleaned = 0;

    for (const [id, game] of games) {
        const hasConnectedPlayers = game.players.some(p => playerSockets.has(p.id));
        const lastActivity = game.lastActivity || game.createdAt;
        const inactiveMinutes = (now - lastActivity) / 60000;

        if (!hasConnectedPlayers && inactiveMinutes > maxInactiveMinutes) {
            games.delete(id);
            cleaned++;
        }
    }

    res.json({ success: true, cleaned, remaining: games.size });
});

// =====================
// WebSocket handling
// =====================

// Safe callback helper
function safeCallback(callback, data) {
    if (typeof callback === 'function') {
        callback(data);
    }
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    let currentPlayerId = null;
    let currentGameId = null;

    // Register player
    socket.on('register', (data, callback) => {
        try {
            const { name } = data || {};
            const playerId = uuidv4();
            currentPlayerId = playerId;
            createPlayer(playerId, name || 'Anonymous');
            playerSockets.set(playerId, socket);
            safeCallback(callback, { success: true, playerId, name });
            console.log(`Player registered: ${name} (${playerId})`);
        } catch (error) {
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Create new game
    socket.on('createGame', (data, callback) => {
        try {
            const { language, playerName } = data || {};

            if (!playerName) {
                return safeCallback(callback, { success: false, error: 'Player name required' });
            }

            if (!currentPlayerId) {
                currentPlayerId = uuidv4();
                createPlayer(currentPlayerId, playerName);
                playerSockets.set(currentPlayerId, socket);
            }

            const gameId = uuidv4().substring(0, 8).toUpperCase();
            const game = createGame(gameId, language || 'es', currentPlayerId, playerName, {
                strictMode: data.strictMode,
                timeLimit: data.timeLimit,
                enableChat: data.enableChat,
                enableHistory: data.enableHistory
            });

            games.set(gameId, game);
            saveGame(game);

            currentGameId = gameId;
            socket.join(gameId);

            safeCallback(callback, {
                success: true,
                gameId,
                game: getGameStateForPlayer(game, currentPlayerId)
            });

            console.log(`Game created: ${gameId} (${language}) by ${playerName}`);
        } catch (error) {
            console.error('Create game error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Join existing game
    socket.on('joinGame', (data, callback) => {
        try {
            const { gameId, playerName } = data || {};

            if (!gameId || !playerName) {
                return safeCallback(callback, { success: false, error: 'Game ID and player name required' });
            }

            const game = games.get(gameId.toUpperCase());
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            if (!currentPlayerId) {
                currentPlayerId = uuidv4();
                createPlayer(currentPlayerId, playerName);
                playerSockets.set(currentPlayerId, socket);
            }

            addPlayer(game, currentPlayerId, playerName);
            saveGame(game);

            currentGameId = gameId.toUpperCase();
            socket.join(currentGameId);

            // Notify all players in the game
            io.to(currentGameId).emit('playerJoined', {
                player: { id: currentPlayerId, name: playerName },
                playerCount: game.players.length
            });

            // Send full game state to all players
            game.players.forEach(player => {
                const playerSocket = playerSockets.get(player.id);
                if (playerSocket) {
                    playerSocket.emit('gameUpdate', {
                        game: getGameStateForPlayer(game, player.id)
                    });
                }
            });

            safeCallback(callback, {
                success: true,
                game: getGameStateForPlayer(game, currentPlayerId)
            });

            console.log(`Player ${playerName} joined game ${gameId}`);
        } catch (error) {
            console.error('Join game error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Start game
    socket.on('startGame', (data, callback) => {
        try {
            const game = games.get(currentGameId);
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            if (game.players[0].id !== currentPlayerId) {
                return safeCallback(callback, { success: false, error: 'Only host can start game' });
            }

            startGame(game);
            saveGame(game);

            // Send personalized game state to each player
            game.players.forEach(player => {
                const playerSocket = playerSockets.get(player.id);
                if (playerSocket) {
                    playerSocket.emit('gameStarted', {
                        game: getGameStateForPlayer(game, player.id)
                    });
                }
            });

            safeCallback(callback, { success: true });
            console.log(`Game ${currentGameId} started`);
        } catch (error) {
            console.error('Start game error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Make a move
    socket.on('makeMove', (data, callback) => {
        try {
            const { tiles } = data || {};
            const game = games.get(currentGameId);

            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            const result = makeMove(game, currentPlayerId, tiles);
            saveGame(game);

            // Broadcast updated game state to all players
            broadcastGameUpdate(game);

            safeCallback(callback, {
                success: true,
                score: result.score,
                words: result.words.map(w => w.text)
            });

            console.log(`Move made in ${currentGameId}: +${result.score} points`);
        } catch (error) {
            console.error('Make move error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Pass turn
    socket.on('passTurn', (data, callback) => {
        try {
            const game = games.get(currentGameId);
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            passTurn(game, currentPlayerId);
            saveGame(game);

            broadcastGameUpdate(game);
            safeCallback(callback, { success: true });

            console.log(`Player ${currentPlayerId} passed in ${currentGameId}`);
        } catch (error) {
            console.error('Pass turn error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Exchange tiles
    socket.on('exchangeTiles', (data, callback) => {
        try {
            const { tiles } = data || {};
            const game = games.get(currentGameId);

            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            exchangeTiles(game, currentPlayerId, tiles);
            saveGame(game);

            broadcastGameUpdate(game);
            safeCallback(callback, { success: true });

            console.log(`Player ${currentPlayerId} exchanged ${tiles.length} tiles`);
        } catch (error) {
            console.error('Exchange tiles error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Send chat message
    socket.on('sendMessage', (data, callback) => {
        try {
            const { text } = data || {};
            if (!text || !text.trim()) {
                return safeCallback(callback, { success: false, error: 'Message required' });
            }

            const game = games.get(currentGameId);
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            if (!game.enableChat) {
                return safeCallback(callback, { success: false, error: 'Chat is disabled' });
            }

            const sender = game.players.find(p => p.id === currentPlayerId);
            const message = {
                id: Date.now().toString(),
                senderId: currentPlayerId,
                senderName: sender ? sender.name : 'Unknown',
                text: text.trim(),
                timestamp: Date.now(),
                type: 'msg'
            };

            game.chatMessages.push(message);
            saveGame(game);

            broadcastGameUpdate(game);
            safeCallback(callback, { success: true });
        } catch (error) {
            console.error('Send message error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Rejoin game
    socket.on('rejoinGame', (data, callback) => {
        try {
            const { gameId, playerId } = data || {};

            if (!gameId || !playerId) {
                return safeCallback(callback, { success: false, error: 'Game ID and player ID required' });
            }

            const game = games.get(gameId);
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            const player = game.players.find(p => p.id === playerId);
            if (!player) {
                return safeCallback(callback, { success: false, error: 'Player not in game' });
            }

            currentPlayerId = playerId;
            currentGameId = gameId;
            player.connected = true;
            playerSockets.set(playerId, socket);

            socket.join(gameId);

            safeCallback(callback, {
                success: true,
                game: getGameStateForPlayer(game, playerId)
            });

            // Notify others
            io.to(gameId).emit('playerReconnected', { playerId });

            console.log(`Player ${playerId} rejoined game ${gameId}`);
        } catch (error) {
            console.error('Rejoin game error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        if (currentPlayerId) {
            playerSockets.delete(currentPlayerId);
        }

        if (currentGameId && currentPlayerId) {
            const game = games.get(currentGameId);
            if (game) {
                const player = game.players.find(p => p.id === currentPlayerId);
                if (player) {
                    player.connected = false;
                    io.to(currentGameId).emit('playerDisconnected', { playerId: currentPlayerId });
                }
            }
        }
        console.log('Client disconnected:', socket.id);
    });

    // Helper: Broadcast game update to all players
    function broadcastGameUpdate(game) {
        game.players.forEach(player => {
            const playerSocket = playerSockets.get(player.id);
            if (playerSocket) {
                playerSocket.emit('gameUpdate', {
                    game: getGameStateForPlayer(game, player.id)
                });
            }
        });

        // Check for game end
        if (game.status === 'finished') {
            io.to(game.id).emit('gameEnded', {
                winner: game.winner,
                players: game.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
            });
        }
    }
});

// =====================
// Initialize and start server
// =====================

const PORT = process.env.PORT || 3001;

async function start() {
    console.log('Starting WordAndWords server...');
    console.log(`Admin password: ${ADMIN_PASSWORD === 'admin123' ? 'admin123 (default)' : '***'}`);

    // Initialize dictionaries
    initializeDictionaries();

    // Load active games
    await loadGames();

    // Schedule cleanup
    setInterval(cleanupOldGames, 3600000); // Every hour

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();
