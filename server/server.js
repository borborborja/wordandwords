import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import {
    BOARD_LAYOUT,
    createGame,
    addPlayer,
    startGame,
    makeMove,
    passTurn,
    exchangeTiles,
    getGameStateForPlayer
} from './game/engine.js';
import {
    createUser,
    getUser,
    getUserByRecoveryCode,
    getUserByEmail,
    addGameToUser,
    removeGameFromUser,
    getUserGames,
    updateUser as updateUserProfile,
    generateMagicToken,
    verifyMagicToken,
    createVerificationToken,
    verifyEmailToken,
    isEmailVerified,
    getAllUsers
} from './users.js';

// Web Push Configuration
const publicVapidKey = process.env.VITE_VAPID_PUBLIC_KEY || 'BO6d-kaZ3rbflknBQKNGcUAz84HHZRKunuPhE0-gendQd_zovyZ3lO10LUxSq2jjQph5rJCVy_vmifSCCeki58s';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'NYYs4gXRp5o3u30FCcfuIPXehFALezHsbLpN35jgHUE';
// NOTE: Ideally these should be loaded strictly from ENV in production.
// Using defaults here for immediate testing without restart if .env isn't reloaded.

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@wordandwords.com',
    publicVapidKey,
    privateVapidKey
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory subscription storage: Map<playerId, SubscriptionObject>
const pushSubscriptions = new Map();

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
// Global player registry (optional, for tracking names)
const players = new Map();

function createPlayer(id, name) {
    if (!players.has(id)) {
        players.set(id, { id, name, createdAt: Date.now() });
    } else {
        // Update name if changed
        const p = players.get(id);
        p.name = name;
        p.lastSeen = Date.now();
    }
}

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
    res.json({
        gameName: serverConfig.gameName || GAME_NAME,
        enableProfiles: serverConfig.enableProfiles !== false
    });
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

// =====================
// User Profile Endpoints
// =====================

// Create new user profile
app.post('/api/user/create', (req, res) => {
    const { name, email } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    // Check if email already in use
    if (email && getUserByEmail(email)) {
        return res.status(409).json({ error: 'Email already in use' });
    }

    const user = createUser(name, email);
    res.status(201).json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            recoveryCode: user.recoveryCode,
            activeGames: user.activeGames
        }
    });
});

// Helper to check if SMTP is configured (Env or Config)
function isSmtpAvailable() {
    return !!(
        (process.env.SMTP_HOST && process.env.SMTP_USER) ||
        (serverConfig.smtp && serverConfig.smtp.host && serverConfig.smtp.user)
    );
}

// Helper to get SMTP transporter
async function getTransporter() {
    const nodemailer = await import('nodemailer');

    // Prefer env vars
    if (process.env.SMTP_HOST) {
        return nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Fallback to configured settings
    const { host, port, user, pass } = serverConfig.smtp || {};
    return nodemailer.default.createTransport({
        host,
        port: parseInt(port || '587'),
        secure: port === '465',
        auth: { user, pass }
    });
}

// Get user by ID
app.get('/api/user/:userId', (req, res) => {
    const user = getUser(req.params.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Get game details for each active game
    const gameDetails = user.activeGames.map(gameId => {
        const game = games.get(gameId) || getGame(gameId);
        if (!game) return null;
        return {
            id: game.id,
            status: game.status,
            language: game.language,
            players: game.players.map(p => ({ name: p.name, score: p.score })),
            currentPlayerIndex: game.currentPlayerIndex,
            isMyTurn: game.players[game.currentPlayerIndex]?.id === req.params.userId
        };
    }).filter(Boolean);

    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        recoveryCode: user.recoveryCode,
        activeGames: gameDetails
    });
});

// Recover profile by code
app.post('/api/user/recover', (req, res) => {
    const { code, email } = req.body;

    let user = null;

    if (code) {
        user = getUserByRecoveryCode(code);
    } else if (email) {
        user = getUserByEmail(email);
    }

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            recoveryCode: user.recoveryCode,
            activeGames: user.activeGames
        }
    });
});

// Update user profile
app.put('/api/user/:userId', (req, res) => {
    const { name, email } = req.body;
    const user = getUser(req.params.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Check if new email is already in use by another user
    if (email && email !== user.email) {
        const existing = getUserByEmail(email);
        if (existing && existing.id !== user.id) {
            return res.status(409).json({ error: 'Email already in use' });
        }
    }

    const updated = updateUserProfile(req.params.userId, { name, email });
    res.json({ success: true, user: updated });
});

// Send magic link to email (for login from another device)
app.post('/api/user/send-link', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    const user = getUserByEmail(email);
    if (!user) {
        // Return 404 so frontend can show helpful message
        return res.status(404).json({ error: 'User not found' });
    }

    // Check if SMTP is configured
    if (!isSmtpAvailable()) {
        return res.status(400).json({
            error: 'Email not configured on server',
            fallbackCode: user.recoveryCode // Provide code as fallback
        });
    }

    // Generate magic token
    const token = generateMagicToken(user.id);
    const baseUrl = serverConfig.serverUrl || `http://localhost:${process.env.PORT || 3001}`;
    const magicLink = `${baseUrl}/?auth_token=${token}`;

    try {
        const transporter = await getTransporter();

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || serverConfig.smtp?.user,
            to: email,
            subject: `[${serverConfig.gameName}] Tu enlace de acceso`,
            text: `Hola ${user.name}!\n\nHaz click en este enlace para acceder a tus partidas:\n\n${magicLink}\n\nEste enlace expira en 24 horas.`,
            html: `
                <h2>¡Hola ${user.name}!</h2>
                <p>Haz click en el botón para acceder a tus partidas:</p>
                <a href="${magicLink}" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Entrar a ${serverConfig.gameName}
                </a>
                <p style="color:#666;font-size:12px;margin-top:20px;">Este enlace expira en 24 horas.</p>
            `
        });

        res.json({ success: true, message: 'Link sent' });
    } catch (err) {
        console.error('Error sending magic link:', err);
        res.status(500).json({ error: 'Failed to send email', fallbackCode: user.recoveryCode });
    }
});

// Verify magic link token
app.get('/api/auth/verify', (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    const user = verifyMagicToken(token);

    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            recoveryCode: user.recoveryCode,
            activeGames: user.activeGames
        }
    });
});

// ADMIN USER MANAGEMENT
// Get all users
app.get('/api/admin/users', (req, res) => {
    // Ideally add admin auth check here
    const users = getAllUsers();

    // Map to include relevant info
    const userList = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        recoveryCode: u.recoveryCode,
        createdAt: u.createdAt,
        lastSeen: u.lastSeen,
        gamesCount: u.activeGames?.length || 0
    })).sort((a, b) => b.lastSeen - a.lastSeen); // Sort by most recently active

    res.json(userList);
});

// Update user details (Admin)
app.put('/api/admin/users/:userId', (req, res) => {
    const { name, email } = req.body;
    const user = getUser(req.params.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Check if new email in use (if changed)
    if (email && email !== user.email) {
        const existing = getUserByEmail(email);
        if (existing && existing.id !== user.id) {
            return res.status(409).json({ error: 'Email already in use' });
        }
    }

    const updated = updateUserProfile(req.params.userId, { name, email });
    res.json({ success: true, user: updated });
});


// START VERIFICATION API
// Init verification for new/unknown emails
app.post('/api/auth/init-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    if (!isSmtpAvailable()) {
        return res.status(503).json({ error: 'Email system not configured' });
    }

    const token = createVerificationToken(email.trim().toLowerCase());
    const baseUrl = serverConfig.serverUrl || `http://localhost:${process.env.PORT || 3001}`;
    const verifyLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

    try {
        const transporter = await getTransporter();

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || serverConfig.smtp?.user,
            to: email,
            subject: `[${serverConfig.gameName}] Valida tu email`,
            html: `
                <h2>Valida tu email</h2>
                <p>Para continuar en ${serverConfig.gameName}, haz click en el enlace:</p>
                <a href="${verifyLink}" style="display:inline-block;background:#48bb78;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Validar Email
                </a>
                <p style="color:#666;font-size:12px;margin-top:20px;">Si no has solicitado esto, ignora este email.</p>
            `
        });

        res.json({ success: true, message: 'Verification link sent' });
    } catch (err) {
        console.error('Error sending verification:', err);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Verify email link (clicked by user)
app.get('/api/auth/verify-email', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token missing');

    const email = verifyEmailToken(token);

    if (email) {
        res.send(`
            <div style="font-family:sans-serif;text-align:center;padding:50px;">
                <h1 style="color:#48bb78;font-size:48px;">✅</h1>
                <h2>Email Validado!</h2>
                <p>Puedes cerrar esta ventana y volver al juego.</p>
                <script>window.close()</script>
            </div>
        `);
    } else {
        res.status(400).send(`
            <div style="font-family:sans-serif;text-align:center;padding:50px;">
                <h1 style="color:#f56565;font-size:48px;">❌</h1>
                <h2>Link expirado o inválido</h2>
            </div>
        `);
    }
});

// Check status (polling)
app.get('/api/auth/check-status', (req, res) => {
    const { email } = req.query;
    if (!email) return res.json({ verified: false });

    const verified = isEmailVerified(email.trim().toLowerCase());
    res.json({ verified });
});

// Check if SMTP is available (for frontend to know)
app.get('/api/config/smtp-status', (req, res) => {
    res.json({
        smtpConfigured: isSmtpAvailable(),
        profilesEnabled: serverConfig.enableProfiles !== false
    });
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

// Configuration Management
const CONFIG_FILE = path.join(__dirname, 'config.json');

// SMTP config from environment (read-only if set)
const SMTP_ENV = {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS ? '********' : '', // Masked
    from: process.env.SMTP_FROM || '',
    isEnvConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER)
};

let serverConfig = {
    gameName: process.env.GAME_NAME || 'WordAndWords',
    serverUrl: '', // To be set by admin
    enableProfiles: true, // Enable persistent user profiles
    smtp: {
        host: '',
        port: '587',
        user: '',
        pass: '',
        from: ''
    }
};

// Load config
try {
    if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        serverConfig = { ...serverConfig, ...JSON.parse(data) };
        console.log('Loaded server config:', serverConfig);
    }
} catch (err) {
    console.error('Error loading config:', err);
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfig, null, 2));
    } catch (err) {
        console.error('Error saving config:', err);
    }
}

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



// GET Config
app.get('/api/admin/config', adminAuth, (req, res) => {
    res.json({
        ...serverConfig,
        smtpEnv: SMTP_ENV // Include env-based SMTP config (read-only info)
    });
});

// UPDATE Config
app.put('/api/admin/config', adminAuth, (req, res) => {
    const { gameName, serverUrl, enableProfiles, smtp } = req.body;
    if (gameName) serverConfig.gameName = gameName;
    if (serverUrl !== undefined) serverConfig.serverUrl = serverUrl;
    if (enableProfiles !== undefined) serverConfig.enableProfiles = enableProfiles;

    // Only update SMTP if not configured via env
    if (smtp && !SMTP_ENV.isEnvConfigured) {
        serverConfig.smtp = { ...serverConfig.smtp, ...smtp };
    }

    saveConfig();
    res.json({ success: true, config: serverConfig });
});

// Test SMTP configuration
app.post('/api/admin/smtp/test', adminAuth, async (req, res) => {
    const { to } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Destination email required' });
    }

    // Get SMTP config (prefer env, fallback to serverConfig)
    const smtpConfig = SMTP_ENV.isEnvConfigured ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM
    } : serverConfig.smtp;

    if (!smtpConfig.host || !smtpConfig.user) {
        return res.status(400).json({ error: 'SMTP not configured' });
    }

    try {
        // Dynamic import nodemailer (only if needed)
        const nodemailer = await import('nodemailer');

        const transporter = nodemailer.default.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port || '587'),
            secure: smtpConfig.port === '465',
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            }
        });

        await transporter.sendMail({
            from: smtpConfig.from || smtpConfig.user,
            to: to,
            subject: `[${serverConfig.gameName}] Test Email`,
            text: 'Este es un email de prueba. Si lo recibes, la configuración SMTP es correcta.',
            html: `<h2>✅ Configuración SMTP Correcta</h2><p>Este es un email de prueba de <strong>${serverConfig.gameName}</strong>.</p>`
        });

        res.json({ success: true });
    } catch (err) {
        console.error('SMTP test error:', err);
        res.status(500).json({ success: false, error: err.message });
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

    // Add words to dictionary
    try {
        const result = addWordsToDictionary(lang, words);
        res.json({ success: true, ...result });
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

// Get specific game details (including board state) for Admin debug
app.get('/api/admin/games/:gameId/details', adminAuth, (req, res) => {
    const game = games.get(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
});

// Delete a specific game
app.delete('/api/admin/games/:gameId', adminAuth, (req, res) => {
    const { gameId } = req.params;
    const game = games.get(gameId);

    // Notify connected players that game was terminated
    if (game) {
        io.to(gameId).emit('gameTerminated', { reason: 'Game deleted by administrator' });
    }

    // Remove from memory
    games.delete(gameId);

    // Remove from database
    deleteGame(gameId);

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
            deleteGame(id); // Also delete from database
            cleaned++;
        }
    }

    res.json({ success: true, cleaned, remaining: games.size });
});

// =====================
// Archive Management
// =====================

// Archive a finished game
app.post('/api/admin/games/:gameId/archive', adminAuth, (req, res) => {
    const { gameId } = req.params;
    const { title } = req.body;

    // Get game from memory or database
    let game = games.get(gameId);
    if (!game) {
        game = getGame(gameId);
    }

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'finished') {
        return res.status(400).json({ error: 'Only finished games can be archived' });
    }

    const archived = archiveGame(gameId, title);

    // Remove from active games cache
    games.delete(gameId);

    res.json({ success: true, game: archived });
});

// Get archived games
app.get('/api/admin/archived-games', adminAuth, (req, res) => {
    const archived = getArchivedGames();
    res.json({ games: archived });
});

// Update archived game title
app.put('/api/admin/archived-games/:gameId', adminAuth, (req, res) => {
    const { gameId } = req.params;
    const { title } = req.body;

    const updated = updateGameTitle(gameId, title);

    if (!updated) {
        return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ success: true });
});

// Delete archived game
app.delete('/api/admin/archived-games/:gameId', adminAuth, (req, res) => {
    const { gameId } = req.params;
    const deleted = deleteGame(gameId);

    res.json({ success: deleted, gameId });
});

// Export game backup
app.get('/api/admin/games/:gameId/export', adminAuth, (req, res) => {
    const { gameId } = req.params;
    let game = games.get(gameId);
    if (!game) game = getGame(gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
});

// Import game backup
app.post('/api/admin/games/import', adminAuth, (req, res) => {
    const gameData = req.body;

    if (!gameData || !gameData.id) {
        return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Overwrite in memory and save
    games.set(gameData.id, gameData);
    saveGame(gameData);

    console.log(`Game ${gameData.id} imported/restored by Admin.`);
    res.json({ success: true, gameId: gameData.id });
});

// Public endpoint - Get archived game for replay (no auth required)
app.get('/api/replay/:gameId', (req, res) => {
    const { gameId } = req.params;

    const game = getGame(gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'archived') {
        return res.status(403).json({ error: 'Only archived games can be replayed' });
    }

    // Return game data for replay (full history, board states, etc.)
    res.json({
        id: game.id,
        title: game.title,
        language: game.language,
        players: game.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        historyLogs: game.historyLogs || [],
        board: game.board,
        createdAt: game.createdAt,
        finishedAt: game.lastActivity
    });
});

// Push Subscription Endpoint
app.post('/api/subscribe', (req, res) => {
    const { subscription, playerId } = req.body;
    if (!subscription || !playerId) {
        return res.status(400).json({ error: 'Subscription and playerId required' });
    }

    pushSubscriptions.set(playerId, subscription);
    console.log(`Push subscription added for player ${playerId}`);
    res.status(201).json({ success: true });
});

// Helper to send push notification
const sendPushToPlayer = (playerId, payload) => {
    const subscription = pushSubscriptions.get(playerId);
    if (subscription) {
        webpush.sendNotification(subscription, JSON.stringify(payload))
            .catch(error => {
                console.error(`Error sending push to ${playerId}:`, error);
                if (error.statusCode === 410) { // Gone
                    pushSubscriptions.delete(playerId);
                }
            });
    }
};

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
            const { language, playerName, userId, showTileBagCount, showTileBagBreakdown } = data || {};

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
                enableHistory: data.enableHistory,
                qAsQu: data.qAsQu,
                showTileBagCount: showTileBagCount,
                showTileBagBreakdown: showTileBagBreakdown
            });

            // Link userId to player in game
            if (userId) {
                game.players[0].userId = userId;
                addGameToUser(userId, gameId);
            }

            games.set(gameId, game);
            saveGame(game);

            currentGameId = gameId;
            socket.join(gameId);

            safeCallback(callback, {
                success: true,
                gameId,
                game: getGameStateForPlayer(game, currentPlayerId)
            });

            console.log(`Game created: ${gameId} (${language}) by ${playerName}${userId ? ` [user: ${userId}]` : ''}`);
        } catch (error) {
            console.error('Create game error:', error);
            safeCallback(callback, { success: false, error: error.message });
        }
    });

    // Join existing game
    socket.on('joinGame', (data, callback) => {
        try {
            const { gameId, playerName, userId } = data || {};

            if (!gameId || !playerName) {
                return safeCallback(callback, { success: false, error: 'Game ID and player name required' });
            }

            const game = games.get(gameId.toUpperCase());
            if (!game) {
                return safeCallback(callback, { success: false, error: 'Game not found' });
            }

            // Check for duplicate username (case-insensitive)
            const nameExists = game.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (nameExists) {
                return safeCallback(callback, { success: false, error: 'Username already taken in this game' });
            }

            if (!currentPlayerId) {
                currentPlayerId = uuidv4();
                createPlayer(currentPlayerId, playerName);
                playerSockets.set(currentPlayerId, socket);
            }

            addPlayer(game, currentPlayerId, playerName);

            // Link userId to this player in the game
            if (userId) {
                const playerInGame = game.players.find(p => p.id === currentPlayerId);
                if (playerInGame) {
                    playerInGame.userId = userId;
                }
                addGameToUser(userId, gameId.toUpperCase());
            }

            saveGame(game);

            currentGameId = gameId.toUpperCase();
            socket.join(currentGameId);

            // Notify all players in the game
            io.to(currentGameId).emit('playerJoined', {
                player: { id: currentPlayerId, name: playerName },
                playerCount: game.players.length
            });

            // WEB PUSH: Notify Host (if not me)
            if (game.players.length > 0) {
                const host = game.players[0]; // Host is always first
                if (host.id !== currentPlayerId) {
                    sendPushToPlayer(host.id, {
                        title: '¡Nuevo Jugador!',
                        body: `${playerName} se ha unido a tu partida.`,
                        url: '/'
                    });
                }
            }

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

            console.log(`Player ${playerName} joined game ${gameId}${userId ? ` [user: ${userId}]` : ''}`);
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

            safeCallback(callback, {
                success: true,
                game: getGameStateForPlayer(game, currentPlayerId)
            });
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
            // Only remove if this socket is the active one (prevents race condition on reconnect)
            const currentSocket = playerSockets.get(currentPlayerId);
            if (currentSocket === socket) {
                playerSockets.delete(currentPlayerId);
            }
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
        if (!game) return;

        // Notify players of turn change (Web Push)
        if (game.status === 'playing') {
            const activePlayer = game.players[game.currentPlayerIndex];
            if (activePlayer) {
                sendPushToPlayer(activePlayer.id, {
                    title: '¡Es tu turno!',
                    body: `Te toca jugar en ${game.title || 'tu partida'}.`,
                    url: '/'
                });
            }
        }

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
// PERSISTENCE LOGIC
// =====================

const GAMES_FILE = path.join(__dirname, 'games.json');
const ARCHIVE_FILE = path.join(__dirname, 'archive.json');

function loadData(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error loading ${filePath}:`, err);
        return [];
    }
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err);
    }
}

function getActiveGames() {
    return loadData(GAMES_FILE);
}

function saveGame(game) {
    games.set(game.id, game); // Update memory

    // Persist to file
    const activeGames = Array.from(games.values());
    saveData(GAMES_FILE, activeGames);
}

function getGame(gameId) {
    if (games.has(gameId)) return games.get(gameId);

    // Check archive
    const archived = loadData(ARCHIVE_FILE);
    const game = archived.find(g => g.id === gameId);
    if (game) return game;

    return null;
}

function deleteGame(gameId) {
    let deleted = false;

    // Remove from memory/active
    if (games.has(gameId)) {
        games.delete(gameId);
        saveData(GAMES_FILE, Array.from(games.values()));
        deleted = true;
    }

    // Remove from archive
    const archived = loadData(ARCHIVE_FILE);
    const newArchived = archived.filter(g => g.id !== gameId);
    if (newArchived.length !== archived.length) {
        saveData(ARCHIVE_FILE, newArchived);
        deleted = true;
    }

    return deleted;
}

function archiveGame(gameId, title) {
    const game = games.get(gameId);
    if (!game) return null;

    // Add title and archive metadata
    game.title = title;
    game.archivedAt = Date.now();

    // Add to archive
    const archived = loadData(ARCHIVE_FILE);
    // Avoid duplicates
    const index = archived.findIndex(g => g.id === gameId);
    if (index >= 0) {
        archived[index] = game;
    } else {
        archived.push(game);
    }
    saveData(ARCHIVE_FILE, archived);

    return game;
}

function getArchivedGames() {
    return loadData(ARCHIVE_FILE);
}

function updateGameTitle(gameId, title) {
    const archived = loadData(ARCHIVE_FILE);
    const game = archived.find(g => g.id === gameId);
    if (game) {
        game.title = title;
        saveData(ARCHIVE_FILE, archived);
        return true;
    }
    return false;
}

function cleanupOldGames() {
    const now = Date.now();
    const activeGames = Array.from(games.values());
    let changed = false;

    activeGames.forEach(game => {
        // Example: cleanup waiting games older than 24h
        if (game.status === 'waiting' && (now - game.createdAt > 86400000)) {
            games.delete(game.id);
            changed = true;
        }
    });

    if (changed) {
        saveData(GAMES_FILE, Array.from(games.values()));
        console.log('Cleaned up old games');
    }
}

// =====================
// DICTIONARY MANAGEMENT
// =====================

import { createInterface } from 'readline';

const dictionaryCache = new Map(); // <lang, Set<word>>

function initializeDictionaries() {
    const dictDir = path.join(__dirname, 'dictionaries');
    if (!fs.existsSync(dictDir)) {
        fs.mkdirSync(dictDir);
        console.log('Created dictionaries directory');
    }
}

function getDictionaryWords(lang) {
    if (dictionaryCache.has(lang)) {
        return Array.from(dictionaryCache.get(lang));
    }

    // Attempt to load from file
    const dictPath = path.join(__dirname, 'dictionaries', `${lang}.txt`);
    if (fs.existsSync(dictPath)) {
        try {
            const content = fs.readFileSync(dictPath, 'utf-8');
            const words = content.split('\n').map(w => w.trim().toUpperCase()).filter(w => w);
            dictionaryCache.set(lang, new Set(words));
            return words;
        } catch (err) {
            console.error(`Error loading dictionary ${lang}:`, err);
        }
    }

    return [];
}

function reloadDictionary(lang) {
    dictionaryCache.delete(lang);
    getDictionaryWords(lang); // Re-load
}

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

    // Serve static files from client build
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Handle SPA routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            const indexPath = path.join(__dirname, '../client/dist/index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.status(404).send('Client build not found. Run "npm run build" in client directory.');
            }
        } else {
            res.status(404).json({ error: 'Endpoint not found' });
        }
    });

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();
