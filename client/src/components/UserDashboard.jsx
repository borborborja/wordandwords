import { useState } from 'react';
import './UserDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function UserDashboard({
    user,
    onEnterGame,
    onCreateGame,
    onJoinGame,
    onLogout,
    t
}) {
    const [showRecoveryCode, setShowRecoveryCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyRecoveryCode = () => {
        navigator.clipboard.writeText(user.recoveryCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getGameStatusEmoji = (game) => {
        if (game.status === 'finished') return '🏁';
        if (game.isMyTurn) return '🟢';
        return '🟡';
    };

    const getGameStatusText = (game) => {
        if (game.status === 'finished') return t('game.gameOver') || 'Terminada';
        if (game.status === 'waiting') return t('lobby.waiting') || 'Esperando...';
        if (game.isMyTurn) return t('game.yourTurn') || 'Tu turno';
        return t('dashboard.waitingTurn') || 'Esperando...';
    };

    return (
        <div className="user-dashboard">
            <div className="dashboard-header glass">
                <div className="user-info">
                    <div className="user-avatar">👤</div>
                    <div className="user-details">
                        <h2>{user.name}</h2>
                        <button
                            className="recovery-toggle"
                            onClick={() => setShowRecoveryCode(!showRecoveryCode)}
                        >
                            {showRecoveryCode ? '🔒 Ocultar código' : '🔑 Código de recuperación'}
                        </button>
                    </div>
                </div>

                {showRecoveryCode && (
                    <div className="recovery-code-box">
                        <span className="recovery-code">{user.recoveryCode}</span>
                        <button className="copy-btn" onClick={copyRecoveryCode}>
                            {copied ? '✅' : '📋'}
                        </button>
                        <p className="recovery-hint">
                            {t('dashboard.recoveryHint') || 'Guarda este código para recuperar tu perfil desde otro dispositivo'}
                        </p>
                    </div>
                )}
            </div>

            <div className="dashboard-content">
                <h3>📋 {t('dashboard.myGames') || 'Mis Partidas'}</h3>

                {user.activeGames.length === 0 ? (
                    <div className="empty-games glass">
                        <p>{t('dashboard.noGames') || 'No tienes partidas activas'}</p>
                    </div>
                ) : (
                    <div className="games-list">
                        {user.activeGames.map(game => (
                            <div key={game.id} className="game-card glass" onClick={() => onEnterGame(game.id)}>
                                <div className="game-status">
                                    <span className="status-emoji">{getGameStatusEmoji(game)}</span>
                                    <span className="status-text">{getGameStatusText(game)}</span>
                                </div>
                                <div className="game-info">
                                    <div className="game-players">
                                        {game.players.map(p => p.name).join(' vs ')}
                                    </div>
                                    <div className="game-language">{game.language?.toUpperCase()}</div>
                                </div>
                                <div className="game-scores">
                                    {game.players.map((p, i) => (
                                        <span key={i} className="player-score">
                                            {p.name}: {p.score}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
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

            <button className="btn-logout" onClick={onLogout}>
                🚪 {t('dashboard.logout') || 'Cerrar Sesión'}
            </button>
        </div>
    );
}
