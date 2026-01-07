import { useState, useRef, useCallback } from 'react';
import Tile from './Tile';
import BoardCell from './BoardCell';
import './Board.css';

// Board layout with special squares
const BOARD_LAYOUT = [
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


// Helper to calculate distance between two touch points
const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [t1, t2] = touches;
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
};

// Helper to get center point of two touches
const getTouchCenter = (touches) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    const [t1, t2] = touches;
    return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
    };
};

export default function Board({
    boardState = [],
    placedTiles = [],
    onCellClick,
    onCellDrop,
    onTileRemove,
    disabled = false,
    t
}) {
    const [dragOverCell, setDragOverCell] = useState(null);

    // Zoom state
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const [showZoomHint, setShowZoomHint] = useState(() => {
        // Only show hint on touch devices, once per session
        if (typeof window !== 'undefined' && 'ontouchstart' in window) {
            return !sessionStorage.getItem('zoomHintDismissed');
        }
        return false;
    });

    // Touch tracking refs
    const touchRef = useRef({
        initialDistance: 0,
        initialScale: 1,
        initialCenter: { x: 0, y: 0 },
        initialTranslate: { x: 0, y: 0 },
        isPinching: false
    });

    const wrapperRef = useRef(null);

    // Create a 15x15 empty board if not provided
    const board = boardState.length === 15 ? boardState :
        Array(15).fill(null).map(() => Array(15).fill(null));

    // Touch handlers for pinch-to-zoom
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches);

            touchRef.current = {
                initialDistance: distance,
                initialScale: scale,
                initialCenter: center,
                initialTranslate: { ...translate },
                isPinching: true
            };

            // Dismiss zoom hint on first pinch
            if (showZoomHint) {
                setShowZoomHint(false);
                sessionStorage.setItem('zoomHintDismissed', 'true');
            }
        }
    }, [scale, translate, showZoomHint]);

    const handleTouchMove = useCallback((e) => {
        if (e.touches.length === 2 && touchRef.current.isPinching) {
            e.preventDefault();

            const { initialDistance, initialScale, initialCenter, initialTranslate } = touchRef.current;

            // Calculate new scale
            const currentDistance = getTouchDistance(e.touches);
            const scaleRatio = currentDistance / initialDistance;
            const newScale = Math.min(3, Math.max(1, initialScale * scaleRatio));

            // Calculate pan (movement of center point)
            const currentCenter = getTouchCenter(e.touches);
            const deltaX = currentCenter.x - initialCenter.x;
            const deltaY = currentCenter.y - initialCenter.y;

            // Apply constraints to translate
            const maxTranslate = (newScale - 1) * 250; // Limit pan based on scale
            const newTranslateX = Math.min(maxTranslate, Math.max(-maxTranslate, initialTranslate.x + deltaX));
            const newTranslateY = Math.min(maxTranslate, Math.max(-maxTranslate, initialTranslate.y + deltaY));

            setScale(newScale);
            setTranslate({ x: newTranslateX, y: newTranslateY });
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        touchRef.current.isPinching = false;

        // Snap back to 1 if very close
        if (scale < 1.1) {
            setScale(1);
            setTranslate({ x: 0, y: 0 });
        }
    }, [scale]);

    const handleReset = useCallback(() => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    }, []);

    const handleDragOver = (e, row, col) => {
        e.preventDefault();
        if (!disabled && !board[row][col]) {
            setDragOverCell({ row, col });
        }
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = (e, row, col) => {
        e.preventDefault();
        setDragOverCell(null);

        if (disabled || board[row][col]) return;

        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            onCellDrop?.(row, col, data);
        } catch (err) {
            console.error('Drop error:', err);
        }
    };

    const isZoomed = scale > 1.05;

    return (
        <div
            className={`board-wrapper ${isZoomed ? 'is-zoomed' : ''}`}
            ref={wrapperRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div
                className="board glass"
                style={{
                    transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                    transformOrigin: 'center center'
                }}
            >
                <div
                    className="board-grid"
                    /* Ensure grid sits above potential background catchers */
                    style={{ zIndex: 10, position: 'relative' }}
                >
                    {board.map((rowArr, row) => (
                        rowArr.map((cellLetter, col) => (
                            <BoardCell
                                key={`${row}-${col}`}
                                row={row}
                                col={col}
                                cellType={BOARD_LAYOUT[row][col]}
                                boardLetter={cellLetter}
                                placedTile={placedTiles.find(t => t.row === row && t.col === col)}
                                isDragOver={dragOverCell?.row === row && dragOverCell?.col === col}
                                onClick={onCellClick}
                                onDrop={onCellDrop}
                                onTileRemove={onTileRemove}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                disabled={disabled}
                            />
                        ))
                    ))}
                </div>
            </div>

            {/* Reset zoom button - only visible when zoomed */}
            {isZoomed && (
                <button
                    className="zoom-reset-btn"
                    onClick={handleReset}
                    aria-label="Reset zoom"
                >
                    ↺
                </button>
            )}

            {/* Zoom hint for first-time mobile users */}
            {showZoomHint && !isZoomed && (
                <div
                    className="zoom-hint"
                    onClick={() => {
                        setShowZoomHint(false);
                        sessionStorage.setItem('zoomHintDismissed', 'true');
                    }}
                >
                    <span className="zoom-hint-icon">👆👆</span>
                    <span className="zoom-hint-text">Pellizca para hacer zoom</span>
                </div>
            )}
        </div>
    );
}
