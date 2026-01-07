import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory dictionaries for fast lookup
const dictionaries = new Map();

// Load a dictionary file into a Set for O(1) lookup
function loadDictionary(language) {
    const filePath = path.join(__dirname, '..', 'dictionaries', `${language}.txt`);

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const words = new Set(
            content
                .split('\n')
                .map(word => word.trim().toUpperCase())
                .filter(word => word.length > 0)
        );
        dictionaries.set(language, words);
        console.log(`Loaded ${words.size} words for language: ${language}`);
        return words;
    } catch (error) {
        console.warn(`Could not load dictionary for ${language}: ${error.message}`);
        dictionaries.set(language, new Set());
        return new Set();
    }
}

// Initialize all dictionaries
export function initializeDictionaries() {
    const languages = ['ca', 'en', 'es'];
    for (const lang of languages) {
        loadDictionary(lang);
    }
}

// Reload a specific dictionary
export function reloadDictionary(language) {
    return loadDictionary(language);
}

// Get all words from a dictionary
export function getDictionaryWords(language) {
    const dict = dictionaries.get(language);
    return dict ? Array.from(dict) : [];
}

// Check if a word is valid in a specific language
export function isValidWord(word, language) {
    const dictionary = dictionaries.get(language);
    if (!dictionary) {
        console.warn(`No dictionary loaded for language: ${language}`);
        return false;
    }
    return dictionary.has(word.toUpperCase());
}

// Get all valid words formed on the board (main word + cross words)
export function validateMove(tiles, board, language, options = {}) {
    // Extract words formed by the move
    const words = extractWordsFromMove(tiles, board, options.qAsQu);

    const validatedWords = [];
    const invalidWords = [];

    for (const word of words) {
        if (isValidWord(word.text, language)) {
            validatedWords.push(word);
        } else {
            invalidWords.push(word);
        }
    }

    return {
        isValid: invalidWords.length === 0,
        validWords: validatedWords,
        invalidWords
    };
}

// Extract all words formed by placing tiles
function extractWordsFromMove(placedTiles, board, qAsQu = false) {
    const words = [];

    if (placedTiles.length === 0) return words;

    // Determine if tiles are placed horizontally or vertically
    const rows = [...new Set(placedTiles.map(t => t.row))];
    const cols = [...new Set(placedTiles.map(t => t.col))];

    const isHorizontal = rows.length === 1;
    const isVertical = cols.length === 1;

    // Create a temporary board with the new tiles
    const tempBoard = board.map(row => [...row]);
    for (const tile of placedTiles) {
        tempBoard[tile.row][tile.col] = tile.letter;
    }

    // Extract the main word
    if (isHorizontal) {
        const word = extractHorizontalWord(placedTiles[0].row, Math.min(...cols), tempBoard, qAsQu);
        if (word.positions.length > 1) words.push(word);
    } else if (isVertical) {
        const word = extractVerticalWord(Math.min(...rows), placedTiles[0].col, tempBoard, qAsQu);
        if (word.positions.length > 1) words.push(word);
    }

    // Extract cross words for each placed tile
    for (const tile of placedTiles) {
        if (isHorizontal) {
            const crossWord = extractVerticalWord(tile.row, tile.col, tempBoard, qAsQu);
            if (crossWord.positions.length > 1) words.push(crossWord);
        } else {
            const crossWord = extractHorizontalWord(tile.row, tile.col, tempBoard, qAsQu);
            if (crossWord.positions.length > 1) words.push(crossWord);
        }
    }

    return words;
}

// Extract horizontal word starting from a position
function extractHorizontalWord(row, startCol, board, qAsQu = false) {
    // Find the start of the word
    let col = startCol;
    while (col > 0 && board[row][col - 1]) col--;

    let word = '';
    const positions = [];
    while (col < 15 && board[row][col]) {
        const cell = board[row][col];
        if (qAsQu && cell === 'Q') {
            word += 'QU';
        } else {
            word += cell;
        }
        positions.push({ row, col });
        col++;
    }

    return { text: word, positions, direction: 'horizontal' };
}

// Extract vertical word starting from a position
function extractVerticalWord(startRow, col, board, qAsQu = false) {
    // Find the start of the word
    let row = startRow;
    while (row > 0 && board[row - 1][col]) row--;

    let word = '';
    const positions = [];
    while (row < 15 && board[row][col]) {
        const cell = board[row][col];
        if (qAsQu && cell === 'Q') {
            word += 'QU';
        } else {
            word += cell;
        }
        positions.push({ row, col });
        row++;
    }

    return { text: word, positions, direction: 'vertical' };
}
