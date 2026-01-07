import { useState, useEffect } from 'react';
import Board from './Board';
import './GameReplay.css';

const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function GameReplay({ gameId, onBack }) {
    const [game, setGame] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadGame();
    }, [gameId]);

    const loadGame = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/replay/${gameId}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to load game');
            }
            const data = await res.json();
            setGame(data);
            setCurrentStep(0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="replay-container">
                <div className="replay-loading">
                    <div className="spinner"></div>
                    <p>Cargando partida...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="replay-container">
                <div className="replay-error glass">
                    <h2>❌ Error</h2>
                    <p>{error}</p>
                    {onBack && <button className="btn btn-secondary" onClick={onBack}>Volver</button>}
                </div>
            </div>
        );
    }

    if (!game) return null;

    const history = game.historyLogs || [];
    const currentLog = history[currentStep];

    // Get board state at current step
    const boardState = currentLog?.boardSnapshot || game.board;

    // Get racks at current step
    const racksState = currentLog?.racksSnapshot || game.players;

    const formatTime = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'move': return '📝';
            case 'pass': return '⏭️';
            case 'exchange': return '🔄';
            case 'penalty': return '❌';
            default: return '•';
        }
    };

    const handleShare = () => {
        const url = window.location.href;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                alert('Enlace copiado al portapapeles!');
            });
        } else {
            prompt('Copia este enlace:', url);
        }
    };

    return (
        <div className="replay-container">
            <div className="replay-panel glass">
                {/* Header */}
                <div className="replay-header">
                    <div className="replay-title">
                        {onBack && (
                            <button className="btn-icon" onClick={onBack}>←</button>
                        )}
                        <div>
                            <h2>📽️ {game.title || 'Replay de Partida'}</h2>
                            <span className="replay-meta">
                                {game.players.map(p => p.name).join(' vs ')} • {game.language?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleShare}>
                        🔗 Compartir
                    </button>
                </div>

                {/* Main Content */}
                <div className="replay-content">
                    {/* Board Section */}
                    <div className="replay-board-section">
                        <div className="replay-board-wrapper">
                            <Board
                                boardState={boardState}
                                placedTiles={[]}
                                onCellClick={() => { }}
                                onCellDrop={() => { }}
                                onTileRemove={() => { }}
                                disabled={true}
                                t={(key) => key}
                            />
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="replay-info-section">
                        {/* Current Move Info */}
                        <div className="replay-move-info glass-dark">
                            <h4>Movimiento {currentStep + 1} de {history.length || 1}</h4>
                            {currentLog ? (
                                <div className="move-details">
                                    <div className="move-player">
                                        <span className="player-name">{currentLog.playerName}</span>
                                        <span className={`action-badge action-${currentLog.action}`}>
                                            {getActionIcon(currentLog.action)} {currentLog.action}
                                        </span>
                                    </div>
                                    {currentLog.action === 'move' && (
                                        <>
                                            <div className="move-words">{currentLog.details}</div>
                                            <div className="move-score">+{currentLog.score} puntos</div>
                                        </>
                                    )}
                                    {currentLog.action === 'penalty' && (
                                        <div className="move-penalty">
                                            Palabra inválida: {currentLog.details}
                                        </div>
                                    )}
                                    <div className="move-time">{formatTime(currentLog.timeTaken)}</div>
                                </div>
                            ) : (
                                <p className="no-moves">Estado final del tablero</p>
                            )}
                        </div>

                        {/* Racks */}
                        <div className="replay-racks">
                            <h4>Atriles</h4>
                            {racksState.map(p => (
                                <div key={p.id} className="replay-rack">
                                    <div className="rack-header">
                                        <span className="rack-name">{p.name}</span>
                                        <span className="rack-score">{p.score} pts</span>
                                    </div>
                                    <div className="rack-tiles">
                                        {(p.tiles || []).map((t, i) => (
                                            <span key={i} className="mini-tile">
                                                {typeof t === 'object' ? t.letter : t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Timeline */}
                        <div className="replay-timeline">
                            <h4>Historial</h4>
                            <div className="timeline-list">
                                {history.map((log, i) => (
                                    <button
                                        key={log.id}
                                        className={`timeline-item ${i === currentStep ? 'active' : ''}`}
                                        onClick={() => setCurrentStep(i)}
                                    >
                                        <span className="timeline-step">{i + 1}</span>
                                        <span className="timeline-icon">{getActionIcon(log.action)}</span>
                                        <span className="timeline-player">{log.playerName}</span>
                                        {log.action === 'move' && (
                                            <span className="timeline-score">+{log.score}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="replay-controls">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentStep(0)}
                        disabled={currentStep === 0}
                    >
                        ⏮️ Inicio
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                    >
                        ◀️ Anterior
                    </button>

                    <div className="step-indicator">
                        <input
                            type="range"
                            min="0"
                            max={Math.max(0, history.length - 1)}
                            value={currentStep}
                            onChange={e => setCurrentStep(parseInt(e.target.value))}
                            className="step-slider"
                        />
                        <span>{currentStep + 1} / {history.length || 1}</span>
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentStep(Math.min(history.length - 1, currentStep + 1))}
                        disabled={currentStep >= history.length - 1}
                    >
                        Siguiente ▶️
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentStep(history.length - 1)}
                        disabled={currentStep >= history.length - 1}
                    >
                        Final ⏭️
                    </button>
                </div>

                {/* Final Scores */}
                <div className="replay-final-scores">
                    <h4>Resultado Final</h4>
                    <div className="final-scores-grid">
                        {game.players.sort((a, b) => b.score - a.score).map((p, i) => (
                            <div key={p.id} className={`final-score-card ${i === 0 ? 'winner' : ''}`}>
                                {i === 0 && <span className="winner-badge">🏆</span>}
                                <span className="final-name">{p.name}</span>
                                <span className="final-pts">{p.score} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
