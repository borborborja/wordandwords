import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Load users from file
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
    return {};
}

// Save users to file
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving users:', err);
    }
}

// Generate short recovery code (6 chars, alphanumeric uppercase)
function generateRecoveryCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Generate user ID
function generateUserId() {
    return 'user_' + crypto.randomBytes(8).toString('hex');
}

// In-memory cache
let usersCache = loadUsers();

/**
 * Create a new user profile
 */
export function createUser(name, email = null) {
    const id = generateUserId();
    const recoveryCode = generateRecoveryCode();

    const user = {
        id,
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : null,
        recoveryCode,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        activeGames: []
    };

    usersCache[id] = user;
    saveUsers(usersCache);

    console.log(`Created user: ${name} (${id}), recovery code: ${recoveryCode}`);
    return user;
}

/**
 * Get user by ID
 */
export function getUser(userId) {
    return usersCache[userId] || null;
}

/**
 * Get user by recovery code
 */
export function getUserByRecoveryCode(code) {
    const normalizedCode = code.trim().toUpperCase();
    return Object.values(usersCache).find(u => u.recoveryCode === normalizedCode) || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    return Object.values(usersCache).find(u => u.email === normalizedEmail) || null;
}

/**
 * Get all users (for admin)
 */
export function getAllUsers() {
    return Object.values(usersCache);
}

/**
 * Update user's last seen timestamp
 */
export function updateLastSeen(userId) {
    if (usersCache[userId]) {
        usersCache[userId].lastSeen = Date.now();
        saveUsers(usersCache);
    }
}

/**
 * Add a game to user's active games list
 */
export function addGameToUser(userId, gameId) {
    if (usersCache[userId]) {
        if (!usersCache[userId].activeGames.includes(gameId)) {
            usersCache[userId].activeGames.push(gameId);
            saveUsers(usersCache);
        }
    }
}

/**
 * Remove a game from user's active games list
 */
export function removeGameFromUser(userId, gameId) {
    if (usersCache[userId]) {
        usersCache[userId].activeGames = usersCache[userId].activeGames.filter(g => g !== gameId);
        saveUsers(usersCache);
    }
}

/**
 * Get all active games for a user
 */
export function getUserGames(userId) {
    return usersCache[userId]?.activeGames || [];
}

/**
 * Update user profile (name, email)
 */
export function updateUser(userId, updates) {
    if (usersCache[userId]) {
        if (updates.name) usersCache[userId].name = updates.name.trim();
        if (updates.email !== undefined) {
            usersCache[userId].email = updates.email ? updates.email.trim().toLowerCase() : null;
        }
        saveUsers(usersCache);
        return usersCache[userId];
    }
    return null;
}

/**
 * Regenerate recovery code for a user
 */
export function regenerateRecoveryCode(userId) {
    if (usersCache[userId]) {
        usersCache[userId].recoveryCode = generateRecoveryCode();
        saveUsers(usersCache);
        return usersCache[userId].recoveryCode;
    }
    return null;
}

/**
 * Get all users (for admin)
 */


/**
 * Delete a user
 */
export function deleteUser(userId) {
    if (usersCache[userId]) {
        delete usersCache[userId];
        saveUsers(usersCache);
        return true;
    }
    return false;
}

// Magic tokens storage (in-memory, expire after 24h)
const magicTokens = new Map();

/**
 * Generate a magic login token for a user
 */
export function generateMagicToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    magicTokens.set(token, { userId, expires });

    // Cleanup expired tokens
    for (const [t, data] of magicTokens.entries()) {
        if (data.expires < Date.now()) {
            magicTokens.delete(t);
        }
    }

    return token;
}

/**
 * Verify a magic token and return the user
 */
export function verifyMagicToken(token) {
    const data = magicTokens.get(token);

    if (!data) return null;

    if (data.expires < Date.now()) {
        magicTokens.delete(token);
        return null;
    }

    // Token is valid - delete it (one-time use)
    magicTokens.delete(token);

    // Mark email as verified if not already
    if (usersCache[data.userId]) {
        usersCache[data.userId].emailVerified = true;
        saveUsers(usersCache);
    }

    return usersCache[data.userId] || null;
}

// Email verification storage (in-memory, expire after 1h)
// email -> { token, verified: boolean, expires: number }
const emailVerifications = new Map();

/**
 * Create a verification token for an email
 */
export function createVerificationToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour

    emailVerifications.set(email, { token, verified: false, expires });

    return token;
}

/**
 * Verify an email token
 */
export function verifyEmailToken(token) {
    for (const [email, data] of emailVerifications.entries()) {
        if (data.token === token) {
            if (data.expires < Date.now()) {
                emailVerifications.delete(email);
                return null;
            }

            // Mark as verified
            data.verified = true;
            emailVerifications.set(email, data);
            return email;
        }
    }
    return null;
}

/**
 * Check verification status of an email
 */
export function isEmailVerified(email) {
    const data = emailVerifications.get(email);
    if (!data) return false;
    if (data.expires < Date.now()) {
        emailVerifications.delete(email);
        return false;
    }
    return data.verified;
}

/**
 * Check if SMTP is configured
 */
export function isSmtpConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}
