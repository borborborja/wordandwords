import React, { memo } from 'react';
import Tile from './Tile';

const SPECIAL_NAMES = {
    'TW': 'TW',
    'DW': 'DW',
    'TL': 'TL',
    'DL': 'DL',
    'ST': '★'
};

const BoardCell = memo(function BoardCell({
    row,
    col,
    cellType, // 'TW', 'DW', etc. or ''
    boardLetter, // Letter existing on board (if any)
    placedTile, // Placed tile object (if any)
    isDragOver,
    onClick,
    onDrop,
    onDragOver,
    onDragLeave,
    onTileRemove,
    disabled
}) {
    // Determine CSS classes
    const getCellClass = () => {
        const classes = ['board-cell'];
        if (cellType) classes.push(`cell-${cellType.toLowerCase()}`);
        if (boardLetter) classes.push('cell-occupied');
        if (placedTile) classes.push('cell-placed');
        if (isDragOver) classes.push('cell-drag-over');
        return classes.join(' ');
    };

    // Render content
    const renderContent = () => {
        // 1. Current move placement
        if (placedTile) {
            return (
                <div
                    className="placed-tile-wrapper"
                    onClick={(e) => {
                        e.stopPropagation();
                        onTileRemove?.(row, col);
                    }}
                    title="Click to remove"
                >
                    <Tile
                        letter={placedTile.letter}
                        value={placedTile.value}
                        size="small"
                        isPlaced
                    />
                </div>
            );
        }

        // 2. Existing board tile
        if (boardLetter) {
            return (
                <Tile
                    letter={boardLetter}
                    value={0} // Value usually hidden or 0 on board for simplicity in this view
                    size="small"
                />
            );
        }

        // 3. Special square label
        if (cellType) {
            return <span className="cell-label">{SPECIAL_NAMES[cellType]}</span>;
        }

        return null;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            onDrop?.(row, col, data);
        } catch (err) {
            console.error('Drop error:', err);
        }
    };

    return (
        <div
            className={getCellClass()}
            onClick={() => !disabled && onClick?.(row, col)}
            onDragOver={(e) => onDragOver?.(e, row, col)}
            onDragLeave={onDragLeave}
            onDrop={handleDrop}
        >
            {renderContent()}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
        prevProps.cellType === nextProps.cellType &&
        prevProps.boardLetter === nextProps.boardLetter &&
        prevProps.placedTile === nextProps.placedTile && // Ref equality check for object
        prevProps.isDragOver === nextProps.isDragOver &&
        prevProps.disabled === nextProps.disabled
        // We assume functions (onClick, etc.) are stable references from useCallback
    );
});

export default BoardCell;
