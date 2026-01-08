import './Scoreboard.css';

export default function Scoreboard({
    players = [],
    currentPlayerIndex = 0,
    tileBagCount = 0,
    playerId,
    t,
    showMobileTiles = false
}) {
    return (
        <div className="scoreboard glass">
            <h3 className="scoreboard-title">{t('game.score')}</h3>

            <div className="scoreboard-players">
                {players.map((player, index) => (
                    <div
                        key={player.id}
                        className={`scoreboard-player ${index === currentPlayerIndex ? 'active' : ''} ${player.id === playerId ? 'is-me' : ''}`}
                    >
                        <div className="player-info">
                            <span className="player-indicator">
                                {index === currentPlayerIndex && (
                                    <span className="turn-indicator">▶</span>
                                )}
                            </span>
                            <span className="player-name">
                                {player.name}
                                {player.id === playerId && <span className="you-badge">(you)</span>}
                            </span>
                            {!player.connected && (
                                <span className="offline-badge">offline</span>
                            )}
                        </div>
                        <span className="player-score">{player.score}</span>
                    </div>
                ))}

                {showMobileTiles && (
                    <div className="mobile-tiles-btn" title={t('game.tilesLeft')}>
                        <span className="tiles-icon">🔠</span>
                        <span className="tiles-count">{tileBagCount}</span>
                    </div>
                )}
            </div>

            <div className="scoreboard-info">
                <div className="info-item">
                    <span className="info-label">{t('game.tilesLeft')}</span>
                    <span className="info-value">{tileBagCount}</span>
                </div>
            </div>
        </div>
    );
}
