import { useState } from 'react';
import './TileBagInfo.css';

export default function TileBagInfo({ count, breakdown, t }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="tile-bag-info">
            <div className="tile-bag-count" onClick={() => breakdown && setIsExpanded(!isExpanded)}>
                <span className="bag-icon">🎒</span>
                <span className="bag-count">{count}</span>
                <span className="bag-label">{t('game.tilesRemaining') || 'fichas'}</span>
                {breakdown && (
                    <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                )}
            </div>

            {breakdown && isExpanded && (
                <div className="tile-bag-breakdown">
                    {Object.entries(breakdown)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([letter, letterCount]) => (
                            <div key={letter} className="breakdown-item">
                                <span className="letter">{letter || '★'}</span>
                                <span className="letter-count">×{letterCount}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
