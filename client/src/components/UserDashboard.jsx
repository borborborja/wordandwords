import { useState } from 'react';
import './UserDashboard.css';

export default function UserDashboard({
    user,
    onEnterGame,
    onStartGame,
    onCreateGame,
    onJoinGame,
    onCancelGame,
    onDeleteGame,
    onRefreshUser,
    t,
    error // Receive error prop
}) {
    // Debug logging
    console.log('UserDashboard Rendered', { user, activeGames: user?.activeGames });
    const [expandedGame, setExpandedGame] = useState(null);
    const [copiedGameCode, setCopiedGameCode] = useState(null);

    // Safety check: if user is null/undefined, don't render
    if (!user) {
        return null;
    }

    // Safely access activeGames with fallback to empty array
    const activeGames = user.activeGames || [];

    const copyGameCode = (gameId, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(gameId);
        setCopiedGameCode(gameId);
        setTimeout(() => setCopiedGameCode(null), 2000);
    };

    const toggleExpanded = (gameId, e) => {
        e.stopPropagation();
        setExpandedGame(expandedGame === gameId ? null : gameId);
    };

    const handleDeleteClick = (game, e) => {
        e.stopPropagation();

        if (game.status === 'cancelled') {
            if (window.confirm(t('dashboard.confirmFinalDelete') || '¿Borrar definitivamente esta partida cancelada?')) {
                if (onDeleteGame) onDeleteGame(game.id);
            }
        } else {
            // Active game logic
            const canImmediateDelete = game.status === 'waiting' && game.players.length === 1;
            const message = canImmediateDelete
                ? (t('dashboard.confirmDelete') || '¿Borrar esta partida? (Estás solo, se borrará inmediatamente)')
                : (t('dashboard.confirmCancel') || '¿Cancelar esta partida? Los jugadores serán notificados.');

            if (window.confirm(message)) {
                if (onCancelGame) onCancelGame(game.id);
            }
        }
    };

    const formatTimeLimit = (seconds) => {
        if (!seconds) return t('lobby.timeInfinite') || 'Infinito';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    const getGameCardClass = (game) => {
        if (game.status === 'finished') return 'game-card game-card--finished';
        if (game.status === 'cancelled') return 'game-card game-card--cancelled';
        if (game.status === 'waiting') return 'game-card game-card--waiting';
        return 'game-card game-card--playing';
    };

    const renderGameCard = (game) => {
        const isWaiting = game.status === 'waiting';
        const isPlaying = game.status === 'playing';
        const isFinished = game.status === 'finished';
        const canStart = isWaiting && game.players.length >= 2;
        const isExpanded = expandedGame === game.id;

        return (
            <div key={game.id} className={`${getGameCardClass(game)} glass`}>
                {/* Header */}
                <div className="game-card__header">
                    <div className="game-card__status">
                        {isWaiting && !canStart && (
                            <>
                                <span className="status-icon status-icon--waiting">⏳</span>
                                <span className="status-text">{t('dashboard.waitingPlayers') || 'Esperant jugadors...'}</span>
                            </>
                        )}
                        {isWaiting && canStart && (
                            <>
                                <span className="status-icon status-icon--ready">✅</span>
                                <span className="status-text">{t('dashboard.readyToStart') || 'Llest per començar'}</span>
                            </>
                        )}
                        {isPlaying && (
                            <>
                                <span className="status-icon status-icon--playing">🎮</span>
                                <span className="status-text">
                                    {game.isMyTurn
                                        ? (t('game.yourTurn') || 'El teu torn')
                                        : (t('dashboard.waitingTurn') || 'Esperant...')}
                                </span>
                            </>
                        )}
                        {isFinished && (
                            <>
                                <span className="status-icon status-icon--finished">🏁</span>
                                <span className="status-text">{t('game.gameOver') || 'Terminada'}</span>
                            </>
                        )}
                        {game.status === 'cancelled' && (
                            <>
                                <span className="status-icon status-icon--cancelled">🚫</span>
                                <span className="status-text">{t('dashboard.cancelled') || 'Cancelada'}</span>
                            </>
                        )}
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div className="game-card__language">{game.language?.toUpperCase()}</div>
                        <button
                            className="btn-icon-sm delete-btn"
                            onClick={(e) => handleDeleteClick(game, e)}
                            title={t('dashboard.deleteGame') || 'Borrar/Cancelar'}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Players */}
                <div className="game-card__players">
                    {game.players.map((p, i) => (
                        <div key={i} className={`player-chip ${p.connected === false ? 'player-chip--offline' : ''}`}>
                            <span className="player-chip__name">{p.name}</span>
                            {(isPlaying || isFinished) && (
                                <span className="player-chip__score">{p.score}</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Game Code for waiting games */}
                {isWaiting && (
                    <div className="game-card__code">
                        <span className="code-label">{t('dashboard.gameCode') || 'Codi'}:</span>
                        <span className="code-value">{game.id}</span>
                        <button
                            className="copy-btn"
                            onClick={(e) => copyGameCode(game.id, e)}
                            title={t('lobby.shareCode') || 'Copiar código'}
                        >
                            {copiedGameCode === game.id ? '✅' : '📋'}
                        </button>
                    </div>
                )}

                {/* Expandable Settings */}
                <div className="game-card__settings-toggle" onClick={(e) => toggleExpanded(game.id, e)}>
                    <span>{isExpanded ? '▼' : '▶'} {t('dashboard.settings') || 'Opcions'}</span>
                </div>

                {isExpanded && (
                    <div className="game-card__settings">
                        <div className="setting-item">
                            <span className="setting-icon">🌍</span>
                            <span>{t('lobby.language') || 'Idioma'}: {game.language?.toUpperCase()}</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-icon">{game.strictMode ? '✅' : '❌'}</span>
                            <span>{t('lobby.strictMode') || 'Mode Estricte'}</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-icon">⏱️</span>
                            <span>{t('lobby.timeLimit') || 'Temps'}: {formatTimeLimit(game.timeLimit)}</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-icon">{game.enableChat ? '💬' : '🔇'}</span>
                            <span>{t('lobby.enableChat') || 'Chat'}</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-icon">{game.enableHistory ? '📜' : '📭'}</span>
                            <span>{t('lobby.enableHistory') || 'Historial'}</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="game-card__actions">
                    {isWaiting && !canStart && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('View Room clicked:', game.id);
                                onEnterGame(game.id);
                            }}
                        >
                            👁️ {t('dashboard.viewRoom') || 'Veure sala'}
                        </button>
                    )}
                    {isWaiting && canStart && (
                        <>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('View Room (Ready) clicked:', game.id);
                                    onEnterGame(game.id);
                                }}
                            >
                                👁️ {t('dashboard.viewRoom') || 'Veure sala'}
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    console.log('Start Game clicked:', game.id);
                                    // Join first to ensure socket scope
                                    await onEnterGame(game.id);
                                    if (onStartGame) {
                                        console.log('Calling onStartGame...');
                                        onStartGame();
                                    } else {
                                        console.error('onStartGame prop is missing!');
                                    }
                                }}
                            >
                                ▶️ {t('lobby.start') || 'Començar'}
                            </button>
                        </>
                    )}
                    {isPlaying && (
                        <button
                            className="btn btn-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('Play clicked:', game.id);
                                onEnterGame(game.id);
                            }}
                        >
                            🎮 {t('dashboard.play') || 'Jugar'}
                        </button>
                    )}
                    {isFinished && (
                        <button
                            className="btn btn-secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('View Result clicked:', game.id);
                                onEnterGame(game.id);
                            }}
                        >
                            👁️ {t('dashboard.viewResult') || 'Veure resultat'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="user-dashboard">
            <div className="dashboard-content">
                {error && (
                    <div className="error-alert animate-fade-in" style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: 'rgb(252, 165, 165)',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}
                <h3>📋 {t('dashboard.myGames') || 'Mis Partidas'}</h3>

                {activeGames.length === 0 ? (
                    <div className="empty-games glass">
                        <p>{t('dashboard.noGames') || 'No tienes partidas activas'}</p>
                    </div>
                ) : (
                    <div className="games-list">
                        {activeGames.map(game => renderGameCard(game))}
                    </div>
                )}
            </div>

            <div className="dashboard-actions">
                <button className="btn btn-primary" onClick={onCreateGame}>
                    ➕ {t('lobby.createGame') || 'Crear Partida'}
                </button>
                <button className="btn btn-secondary" onClick={onJoinGame}>
                    🔗 {t('lobby.joinGame') || 'Unirse'}
                </button>
            </div>
        </div>
    );
}
