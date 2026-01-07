import { createTileBag, drawTiles, getLetterValue } from './tiles.js';
import { validateMove, isValidWord } from './validator.js';

// Board special squares
// TW = Triple Word, DW = Double Word, TL = Triple Letter, DL = Double Letter, ST = Start
export const BOARD_LAYOUT = [
    ['TW', '', '', 'DL', '', '', '', 'TW', '', '', '', 'DL', '', '', 'TW'],
    ['', 'DW', '', '', '', 'TL', '', '', '', 'TL', '', '', '', 'DW', ''],
    ['', '', 'DW', '', '', '', 'DL', '', 'DL', '', '', '', 'DW', '', ''],
    ['DL', '', '', 'DW', '', '', '', 'DL', '', '', '', 'DW', '', '', 'DL'],
    ['', '', '', '', 'DW', '', '', '', '', '', 'DW', '', '', '', ''],
    ['', 'TL', '', '', '', 'TL', '', '', '', 'TL', '', '', '', 'TL', ''],
    ['', '', 'DL', '', '', '', 'DL', '', 'DL', '', '', '', 'DL', '', ''],
    ['TW', '', '', 'DL', '', '', '', 'ST', '', '', '', 'DL', '', '', 'TW'],
    ['', '', 'DL', '', '', '', 'DL', '', 'DL', '', '', '', 'DL', '', ''],
    ['', 'TL', '', '', '', 'TL', '', '', '', 'TL', '', '', '', 'TL', ''],
    ['', '', '', '', 'DW', '', '', '', '', '', 'DW', '', '', '', ''],
    ['DL', '', '', 'DW', '', '', '', 'DL', '', '', '', 'DW', '', '', 'DL'],
    ['', '', 'DW', '', '', '', 'DL', '', 'DL', '', '', '', 'DW', '', ''],
    ['', 'DW', '', '', '', 'TL', '', '', '', 'TL', '', '', '', 'DW', ''],
    ['TW', '', '', 'DL', '', '', '', 'TW', '', '', '', 'DL', '', '', 'TW']
];

// Create an empty 15x15 board
export function createEmptyBoard() {
    return Array(15).fill(null).map(() => Array(15).fill(null));
}

// Game state factory
export function createGame(id, language, creatorId, creatorName, options = {}) {
    const tileBag = createTileBag(language);
    const { drawn: creatorTiles, remaining } = drawTiles(tileBag, 7);

    return {
        id,
        language,
        status: 'waiting', // waiting, playing, finished
        strictMode: options.strictMode || false,
        timeLimit: options.timeLimit || null, // null (infinite), 60, 180, 300
        enableChat: options.enableChat !== false, // default true
        enableHistory: options.enableHistory !== false, // default true
        board: createEmptyBoard(),
        tileBag: remaining,
        players: [{
            id: creatorId,
            name: creatorName,
            tiles: creatorTiles,
            score: 0,
            connected: true
        }],
        currentPlayerIndex: 0,
        moveHistory: [], // Structural history for game logic
        historyLogs: [], // User-facing detailed history
        chatMessages: [], // Chat messages
        passCount: 0,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        turnStartTime: null // Will be set when game starts or turn changes
    };
}

// Add a player to the game
export function addPlayer(game, playerId, playerName) {
    if (game.status !== 'waiting') {
        throw new Error('Game already started');
    }

    if (game.players.length >= 4) {
        throw new Error('Game is full');
    }

    if (game.players.some(p => p.id === playerId)) {
        throw new Error('Player already in game');
    }

    const { drawn, remaining } = drawTiles(game.tileBag, 7);
    game.tileBag = remaining;

    game.players.push({
        id: playerId,
        name: playerName,
        tiles: drawn,
        score: 0,
        connected: true
    });

    return game;
}

// Start the game
export function startGame(game) {
    if (game.players.length < 2) {
        throw new Error('Need at least 2 players');
    }

    game.status = 'playing';
    game.currentPlayerIndex = 0;
    game.lastActivity = Date.now();
    game.turnStartTime = Date.now();

    return game;
}

// Calculate score for a move
export function calculateScore(placedTiles, board, language) {
    let totalScore = 0;
    const wordsFormed = [];

    if (placedTiles.length === 0) return { score: 0, words: [] };

    // Create temporary board with new tiles
    const tempBoard = board.map(row => [...row]);
    for (const tile of placedTiles) {
        tempBoard[tile.row][tile.col] = tile.letter;
    }

    // Determine direction
    const rows = [...new Set(placedTiles.map(t => t.row))];
    const cols = [...new Set(placedTiles.map(t => t.col))];
    const isHorizontal = rows.length === 1;

    // Score main word
    if (isHorizontal) {
        const word = scoreHorizontalWord(placedTiles[0].row, Math.min(...cols), tempBoard, placedTiles, language);
        if (word.text.length > 1) {
            totalScore += word.score;
            wordsFormed.push(word);
        }
    } else {
        const word = scoreVerticalWord(Math.min(...rows), placedTiles[0].col, tempBoard, placedTiles, language);
        if (word.text.length > 1) {
            totalScore += word.score;
            wordsFormed.push(word);
        }
    }

    // Score cross words
    for (const tile of placedTiles) {
        if (isHorizontal) {
            const crossWord = scoreVerticalWord(tile.row, tile.col, tempBoard, [tile], language);
            if (crossWord.text.length > 1) {
                totalScore += crossWord.score;
                wordsFormed.push(crossWord);
            }
        } else {
            const crossWord = scoreHorizontalWord(tile.row, tile.col, tempBoard, [tile], language);
            if (crossWord.text.length > 1) {
                totalScore += crossWord.score;
                wordsFormed.push(crossWord);
            }
        }
    }

    // Bingo bonus: 50 points for using all 7 tiles
    if (placedTiles.length === 7) {
        totalScore += 50;
    }

    return { score: totalScore, words: wordsFormed };
}

function scoreHorizontalWord(row, startCol, board, placedTiles, language) {
    let col = startCol;
    while (col > 0 && board[row][col - 1]) col--;

    let word = '';
    let score = 0;
    let wordMultiplier = 1;

    while (col < 15 && board[row][col]) {
        const letter = board[row][col];
        let letterScore = getLetterValue(letter, language);
        const isNewTile = placedTiles.some(t => t.row === row && t.col === col);

        if (isNewTile) {
            const special = BOARD_LAYOUT[row][col];
            if (special === 'DL') letterScore *= 2;
            else if (special === 'TL') letterScore *= 3;
            else if (special === 'DW' || special === 'ST') wordMultiplier *= 2;
            else if (special === 'TW') wordMultiplier *= 3;
        }

        word += letter;
        score += letterScore;
        col++;
    }

    return { text: word, score: score * wordMultiplier };
}

function scoreVerticalWord(startRow, col, board, placedTiles, language) {
    let row = startRow;
    while (row > 0 && board[row - 1][col]) row--;

    let word = '';
    let score = 0;
    let wordMultiplier = 1;

    while (row < 15 && board[row][col]) {
        const letter = board[row][col];
        let letterScore = getLetterValue(letter, language);
        const isNewTile = placedTiles.some(t => t.row === row && t.col === col);

        if (isNewTile) {
            const special = BOARD_LAYOUT[row][col];
            if (special === 'DL') letterScore *= 2;
            else if (special === 'TL') letterScore *= 3;
            else if (special === 'DW' || special === 'ST') wordMultiplier *= 2;
            else if (special === 'TW') wordMultiplier *= 3;
        }

        word += letter;
        score += letterScore;
        row++;
    }

    return { text: word, score: score * wordMultiplier };
}

// Make a move
export function makeMove(game, playerId, placedTiles) {
    if (game.status !== 'playing') {
        throw new Error('Game is not in progress');
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
        throw new Error('Not your turn');
    }

    // Validate tile placement
    const validation = validateTilePlacement(placedTiles, game.board, game.moveHistory.length === 0);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Validate words
    const wordValidation = validateMove(placedTiles, game.board, game.language);
    if (!wordValidation.isValid) {
        if (!game.strictMode) {
            // Default behavior: allow retry
            throw new Error(`Invalid word(s): ${wordValidation.invalidWords.map(w => w.text).join(', ')}`);
        } else {
            // Strict Mode: Lose turn
            game.passCount = 0; // Reset pass count since they tried to play

            // Record penalty move
            game.moveHistory.push({
                playerId,
                tiles: placedTiles, // Keep record of what they tried
                words: wordValidation.invalidWords.map(w => w.text),
                score: 0,
                type: 'penalty',
                type: 'penalty',
                timestamp: Date.now()
            });

            // Log to user-facing history
            if (game.enableHistory) {
                game.historyLogs.push({
                    id: Date.now().toString(),
                    playerId,
                    playerName: currentPlayer.name,
                    action: 'penalty',
                    details: wordValidation.invalidWords.map(w => w.text).join(', '),
                    score: 0,
                    timeTaken: game.turnStartTime ? Math.round((Date.now() - game.turnStartTime) / 1000) : 0,
                    timestamp: Date.now()
                });
            }

            // Advance turn
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
            game.lastActivity = Date.now();

            return { score: 0, words: [], penalty: true, invalidWords: wordValidation.invalidWords.map(w => w.text) };
        }
    }

    // Calculate score
    const { score, words } = calculateScore(placedTiles, game.board, game.language);

    // Update board
    for (const tile of placedTiles) {
        game.board[tile.row][tile.col] = tile.letter;
    }

    // Update player score and tiles
    currentPlayer.score += score;

    // Remove used tiles from player's rack
    const usedLetters = placedTiles.map(t => t.letter);
    for (const letter of usedLetters) {
        const idx = currentPlayer.tiles.findIndex(t => t.letter === letter);
        if (idx !== -1) {
            currentPlayer.tiles.splice(idx, 1);
        }
    }

    // Draw new tiles
    const { drawn, remaining } = drawTiles(game.tileBag, placedTiles.length);
    currentPlayer.tiles.push(...drawn);
    game.tileBag = remaining;

    // Record move
    game.moveHistory.push({
        playerId,
        tiles: placedTiles,
        words: words.map(w => w.text),
        score,
        timestamp: Date.now()
    });

    // Log to user-facing history
    if (game.enableHistory) {
        game.historyLogs.push({
            id: Date.now().toString(),
            playerId,
            playerName: currentPlayer.name,
            action: 'move',
            details: words.map(w => w.text).join(', '),
            score,
            timeTaken: game.turnStartTime ? Math.round((Date.now() - game.turnStartTime) / 1000) : 0,
            timestamp: Date.now()
        });
    }

    // Reset pass count
    game.passCount = 0;

    // Check for game end
    if (currentPlayer.tiles.length === 0 && game.tileBag.length === 0) {
        endGame(game, currentPlayer.id);
    } else {
        // Next player's turn
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    }

    game.lastActivity = Date.now();
    game.turnStartTime = Date.now();
    return { score, words };
}

// Pass turn
export function passTurn(game, playerId) {
    if (game.status !== 'playing') {
        throw new Error('Game is not in progress');
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
        throw new Error('Not your turn');
    }

    game.passCount++;

    game.moveHistory.push({
        playerId,
        tiles: [],
        words: [],
        score: 0,
        type: 'pass',
        timestamp: Date.now()
    });

    // Log to user-facing history
    if (game.enableHistory) {
        game.historyLogs.push({
            id: Date.now().toString(),
            playerId,
            playerName: currentPlayer.name,
            action: 'pass',
            details: null,
            score: 0,
            timeTaken: game.turnStartTime ? Math.round((Date.now() - game.turnStartTime) / 1000) : 0,
            timestamp: Date.now()
        });
    }

    // End game if all players pass consecutively
    if (game.passCount >= game.players.length * 2) {
        endGame(game);
    } else {
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    }

    game.lastActivity = Date.now();
    game.turnStartTime = Date.now();
    return game;
}

// Exchange tiles
export function exchangeTiles(game, playerId, tilesToExchange) {
    if (game.status !== 'playing') {
        throw new Error('Game is not in progress');
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
        throw new Error('Not your turn');
    }

    if (game.tileBag.length < tilesToExchange.length) {
        throw new Error('Not enough tiles in bag');
    }

    // 1. First, draw NEW tiles from the bag (before returning old ones)
    const { drawn, remaining } = drawTiles(game.tileBag, tilesToExchange.length);
    game.tileBag = remaining;

    // 2. Remove the tiles to exchange from player's rack
    const removedTiles = [];
    for (const letter of tilesToExchange) {
        const idx = currentPlayer.tiles.findIndex(t => t.letter === letter);
        if (idx === -1) {
            throw new Error(`Tile not found: ${letter}`);
        }
        const [removed] = currentPlayer.tiles.splice(idx, 1);
        removedTiles.push(removed);
    }

    // 3. Add the new tiles to player's rack
    currentPlayer.tiles.push(...drawn);

    // 4. Return the discarded tiles to the bag
    game.tileBag.push(...removedTiles);

    // 5. Shuffle the bag
    for (let i = game.tileBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [game.tileBag[i], game.tileBag[j]] = [game.tileBag[j], game.tileBag[i]];
    }

    // Update turn timer if time limit is set
    if (game.timeLimit) {
        game.turnStartTime = Date.now();
    }

    game.moveHistory.push({
        playerId,
        tiles: [],
        words: [],
        score: 0,
        type: 'exchange',
        exchangeCount: tilesToExchange.length,
        timestamp: Date.now()
    });

    // Log to user-facing history
    if (game.enableHistory) {
        game.historyLogs.push({
            id: Date.now().toString(),
            playerId,
            playerName: currentPlayer.name,
            action: 'exchange',
            details: `${tilesToExchange.length} tiles`,
            score: 0,
            timeTaken: game.turnStartTime ? Math.round((Date.now() - game.turnStartTime) / 1000) : 0,
            timestamp: Date.now()
        });
    }

    // Pass turn to next player
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;

    return game;
}

// End the game
function endGame(game, finishingPlayerId = null) {
    game.status = 'finished';

    let totalDeductions = 0;

    // Subtract remaining tile values from each player
    for (const player of game.players) {
        const remainingValue = player.tiles.reduce((sum, t) => sum + t.value, 0);
        player.score -= remainingValue;
        totalDeductions += remainingValue;
    }

    // If a player finished by using all tiles, they get the sum of all deductions
    if (finishingPlayerId) {
        const finisher = game.players.find(p => p.id === finishingPlayerId);
        if (finisher) {
            finisher.score += totalDeductions;
        }
    }

    // Determine winner
    game.winner = game.players.reduce((max, p) => p.score > max.score ? p : max, game.players[0]);
}

// Validate tile placement rules
function validateTilePlacement(tiles, board, isFirstMove) {
    if (tiles.length === 0) {
        return { valid: false, error: 'No tiles placed' };
    }

    // Check all positions are empty
    for (const tile of tiles) {
        if (board[tile.row][tile.col] !== null) {
            return { valid: false, error: 'Cannot place tile on occupied square' };
        }
    }

    // Check tiles are in a line
    const rows = [...new Set(tiles.map(t => t.row))];
    const cols = [...new Set(tiles.map(t => t.col))];

    if (rows.length > 1 && cols.length > 1) {
        return { valid: false, error: 'Tiles must be placed in a straight line' };
    }

    // Check for gaps
    if (rows.length === 1) {
        const sortedCols = cols.sort((a, b) => a - b);
        for (let c = sortedCols[0]; c <= sortedCols[sortedCols.length - 1]; c++) {
            if (!tiles.some(t => t.col === c) && board[rows[0]][c] === null) {
                return { valid: false, error: 'Tiles must be contiguous' };
            }
        }
    } else {
        const sortedRows = rows.sort((a, b) => a - b);
        for (let r = sortedRows[0]; r <= sortedRows[sortedRows.length - 1]; r++) {
            if (!tiles.some(t => t.row === r) && board[r][cols[0]] === null) {
                return { valid: false, error: 'Tiles must be contiguous' };
            }
        }
    }

    // First move must cover center
    if (isFirstMove) {
        if (!tiles.some(t => t.row === 7 && t.col === 7)) {
            return { valid: false, error: 'First word must cover center square' };
        }
    } else {
        // Must connect to existing tiles
        let connected = false;
        for (const tile of tiles) {
            const { row, col } = tile;
            if (
                (row > 0 && board[row - 1][col]) ||
                (row < 14 && board[row + 1][col]) ||
                (col > 0 && board[row][col - 1]) ||
                (col < 14 && board[row][col + 1])
            ) {
                connected = true;
                break;
            }
        }
        if (!connected) {
            return { valid: false, error: 'Tiles must connect to existing words' };
        }
    }

    return { valid: true };
}

// Get game state for a specific player (hides other players' tiles)
export function getGameStateForPlayer(game, playerId) {
    return {
        ...game,
        tileBag: undefined, // Hide tile bag
        tileBagCount: game.tileBag.length,
        players: game.players.map(p => ({
            ...p,
            tiles: p.id === playerId ? p.tiles : p.tiles.map(() => ({ hidden: true }))
        }))
    };
}
