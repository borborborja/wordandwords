// Tile definitions for each supported language
// Each letter has: count (how many in bag), value (point value)

export const TILE_SETS = {
  // Catalan tile set (100 tiles)
  ca: {
    'A': { count: 12, value: 1 },
    'B': { count: 2, value: 3 },
    'C': { count: 3, value: 2 },
    'Ç': { count: 1, value: 6 },
    'D': { count: 3, value: 2 },
    'E': { count: 13, value: 1 },
    'F': { count: 1, value: 4 },
    'G': { count: 2, value: 3 },
    'H': { count: 1, value: 8 },
    'I': { count: 8, value: 1 },
    'J': { count: 1, value: 8 },
    'L': { count: 4, value: 1 },
    'L·L': { count: 1, value: 8 },
    'M': { count: 3, value: 2 },
    'N': { count: 6, value: 1 },
    'NY': { count: 1, value: 8 },
    'O': { count: 5, value: 1 },
    'P': { count: 2, value: 3 },
    'Q': { count: 1, value: 8 },
    'R': { count: 8, value: 1 },
    'S': { count: 8, value: 1 },
    'T': { count: 5, value: 1 },
    'U': { count: 4, value: 1 },
    'V': { count: 1, value: 4 },
    'X': { count: 1, value: 8 },
    'Z': { count: 1, value: 10 },
    '': { count: 2, value: 0 } // Blanks
  },

  // English tile set (100 tiles)
  en: {
    'A': { count: 9, value: 1 },
    'B': { count: 2, value: 3 },
    'C': { count: 2, value: 3 },
    'D': { count: 4, value: 2 },
    'E': { count: 12, value: 1 },
    'F': { count: 2, value: 4 },
    'G': { count: 3, value: 2 },
    'H': { count: 2, value: 4 },
    'I': { count: 9, value: 1 },
    'J': { count: 1, value: 8 },
    'K': { count: 1, value: 5 },
    'L': { count: 4, value: 1 },
    'M': { count: 2, value: 3 },
    'N': { count: 6, value: 1 },
    'O': { count: 8, value: 1 },
    'P': { count: 2, value: 3 },
    'Q': { count: 1, value: 10 },
    'R': { count: 6, value: 1 },
    'S': { count: 4, value: 1 },
    'T': { count: 6, value: 1 },
    'U': { count: 4, value: 1 },
    'V': { count: 2, value: 4 },
    'W': { count: 2, value: 4 },
    'X': { count: 1, value: 8 },
    'Y': { count: 2, value: 4 },
    'Z': { count: 1, value: 10 },
    '': { count: 2, value: 0 } // Blanks
  },

  // Spanish tile set (100 tiles)
  es: {
    'A': { count: 12, value: 1 },
    'B': { count: 2, value: 3 },
    'C': { count: 4, value: 3 },
    'CH': { count: 1, value: 5 },
    'D': { count: 5, value: 2 },
    'E': { count: 12, value: 1 },
    'F': { count: 1, value: 4 },
    'G': { count: 2, value: 2 },
    'H': { count: 2, value: 4 },
    'I': { count: 6, value: 1 },
    'J': { count: 1, value: 8 },
    'L': { count: 4, value: 1 },
    'LL': { count: 1, value: 8 },
    'M': { count: 2, value: 3 },
    'N': { count: 5, value: 1 },
    'Ñ': { count: 1, value: 8 },
    'O': { count: 9, value: 1 },
    'P': { count: 2, value: 3 },
    'Q': { count: 1, value: 5 },
    'R': { count: 5, value: 1 },
    'RR': { count: 1, value: 8 },
    'S': { count: 6, value: 1 },
    'T': { count: 4, value: 1 },
    'U': { count: 5, value: 1 },
    'V': { count: 1, value: 4 },
    'X': { count: 1, value: 8 },
    'Y': { count: 1, value: 4 },
    'Z': { count: 1, value: 10 },
    '': { count: 2, value: 0 } // Blanks
  }
};

// Create a shuffled tile bag for a language
export function createTileBag(language) {
  const tiles = [];
  const tileSet = TILE_SETS[language];
  
  if (!tileSet) {
    throw new Error(`Unknown language: ${language}`);
  }
  
  for (const [letter, config] of Object.entries(tileSet)) {
    for (let i = 0; i < config.count; i++) {
      tiles.push({
        letter,
        value: config.value,
        isBlank: letter === ''
      });
    }
  }
  
  // Fisher-Yates shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  
  return tiles;
}

// Draw tiles from the bag
export function drawTiles(bag, count) {
  const drawn = [];
  const remaining = [...bag];
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    drawn.push(remaining.pop());
  }
  
  return { drawn, remaining };
}

// Get the value of a letter in a specific language
export function getLetterValue(letter, language) {
  const tileSet = TILE_SETS[language];
  return tileSet[letter]?.value ?? 0;
}
