import { useState } from 'react';
import Tile from './Tile';
import { soundManager } from '../utils/SoundManager';
import './TileRack.css';

export default function TileRack({
    tiles = [],
    selectedTiles = [],
    onTileSelect,
    onTileDragStart,
    onTileDragEnd,
    onShuffle,
    disabled = false
}) {
    const [localTiles, setLocalTiles] = useState(tiles);

    // Sync with props only if content changes (ignore order to preserve shuffle)
    const tilesSignature = JSON.stringify(tiles.map(t => t.letter).sort());
    const localSignature = JSON.stringify(localTiles.map(t => t.letter).sort());

    if (tilesSignature !== localSignature || tiles.length !== localTiles.length) {
        setLocalTiles(tiles);
    }

    const handleShuffle = () => {
        const shuffled = [...localTiles];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setLocalTiles(shuffled);
        soundManager.playShuffle();
        onShuffle?.(shuffled);
    };

    return (
        <div className="tile-rack-container">
            <div className="tile-rack glass">
                <div className="tile-rack-tiles">
                    {localTiles.map((tile, index) => (
                        <div key={index} className="tile-rack-slot">
                            <Tile
                                letter={tile.letter}
                                value={tile.value}
                                isBlank={tile.isBlank}
                                isSelected={selectedTiles.includes(index)}
                                onClick={() => !disabled && onTileSelect?.(index, tile)}
                                onDragStart={() => onTileDragStart?.(index, tile)}
                                onDragEnd={onTileDragEnd}
                                draggable={!disabled}
                                size="large"
                            />
                        </div>
                    ))}
                    {/* Empty slots */}
                    {Array(7 - localTiles.length).fill(null).map((_, i) => (
                        <div key={`empty-${i}`} className="tile-rack-slot tile-rack-slot-empty" />
                    ))}
                </div>
            </div>
            <button
                className="btn-icon shuffle-btn"
                onClick={handleShuffle}
                disabled={disabled}
                title="Shuffle"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
            </button>
        </div>
    );
}
