import { useState } from 'react';
import './WaitingRoom.css';

export default function WaitingRoom({
    gameId,
    players,
    playerId,
    onStart,
    onLeave,
    language,
    t,
    gameName = 'WordAndWords'
}) {
    const [copied, setCopied] = useState(false);

    const isHost = players[0]?.id === playerId;
    const canStart = players.length >= 2;

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(gameId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="waiting-room page">
            <div className="waiting-content container">
                <div className="waiting-card glass animate-fade-in">
                    <h2>{t('lobby.waiting')}</h2>

                    <div className="game-code-section">
                        <p className="code-label">{t('lobby.shareCode')}</p>
                        <div className="game-code-container">
                            <div className="game-code" onClick={copyCode}>
                                <span className="code-text">{gameId}</span>
                                <button className="copy-btn">
                                    {copied ? '✓' : '📋'}
                                </button>
                            </div>
                            <button className="btn btn-secondary share-btn" onClick={async () => {
                                const url = `${window.location.origin}?code=${gameId}`;
                                if (navigator.share) {
                                    try {
                                        await navigator.share({
                                            title: gameName,
                                            text: `Join my game! Code: ${gameId}`,
                                            url: url
                                        });
                                    } catch (err) {
                                        // Ignore abort
                                    }
                                } else {
                                    try {
                                        await navigator.clipboard.writeText(url);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    } catch (err) { }
                                }
                            }}>
                                🔗 Share Link
                            </button>
                        </div>
                        {copied && <span className="copied-toast">{t('lobby.copied')}</span>}
                    </div>

                    <div className="players-section">
                        <h3>{t('lobby.players')} ({players.length}/4)</h3>
                        <div className="players-list">
                            {players.map((player, index) => (
                                <div
                                    key={player.id}
                                    className={`player-item ${player.id === playerId ? 'is-me' : ''}`}
                                >
                                    <span className="player-avatar">
                                        {index === 0 ? '👑' : '👤'}
                                    </span>
                                    <span className="player-name">
                                        {player.name}
                                        {player.id === playerId && <span className="you-tag">(you)</span>}
                                    </span>
                                    <span className={`player-status ${player.connected ? 'online' : 'offline'}`}>
                                        {player.connected ? '●' : '○'}
                                    </span>
                                </div>
                            ))}

                            {/* Empty slots */}
                            {Array(4 - players.length).fill(null).map((_, i) => (
                                <div key={`empty-${i}`} className="player-item empty">
                                    <span className="player-avatar">➕</span>
                                    <span className="player-name">Waiting...</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="waiting-actions">
                        {isHost ? (
                            <button
                                className="btn btn-primary"
                                onClick={onStart}
                                disabled={!canStart}
                            >
                                {canStart ? t('lobby.start') : t('lobby.minPlayers')}
                            </button>
                        ) : (
                            <p className="waiting-message">
                                Waiting for host to start the game...
                            </p>
                        )}

                        <button className="btn btn-secondary" onClick={onLeave}>
                            {t('game.leave')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
