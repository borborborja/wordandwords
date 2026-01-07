import './Tile.css';

export default function Tile({
    letter,
    value,
    isBlank = false,
    isDragging = false,
    isSelected = false,
    isPlaced = false,
    size = 'medium',
    onClick,
    onDragStart,
    onDragEnd,
    draggable = false
}) {
    const displayLetter = isBlank && !letter ? '' : letter;

    return (
        <div
            className={`tile tile-${size} ${isDragging ? 'tile-dragging' : ''} ${isSelected ? 'tile-selected' : ''} ${isPlaced ? 'tile-placed' : ''}`}
            onClick={onClick}
            draggable={draggable}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ letter, value, isBlank }));
                onDragStart?.();
            }}
            onDragEnd={onDragEnd}
        >
            <span className="tile-letter">{displayLetter}</span>
            {value > 0 && <span className="tile-value">{value}</span>}
            <div className="tile-shine"></div>
        </div>
    );
}
