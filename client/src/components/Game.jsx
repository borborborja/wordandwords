import { useState, useEffect, useCallback, useRef } from 'react';
import Board from './Board';
import TileRack from './TileRack';
// Scoreboard is now handled by GameSidebar
import GameSidebar from './GameSidebar';
import MobileChatModal from './MobileChatModal';
import Scoreboard from './Scoreboard';
import GameHistory from './GameHistory';
import Settings, { sendTurnNotification } from './Settings';
import { soundManager } from '../utils/SoundManager';
import TileBagInfo from './TileBagInfo';
import './Game.css';

export default function Game({
    game,
    playerId,
    currentPlayer,
    isMyTurn,
    onMakeMove,
    onPass,
    onExchange,
    onLeave,
    onSendMessage,
    loading,
    error,
    t,
    gameName = 'WordAndWords',
    uiLanguage,
    onUiLanguageChange
}) {
    const [placedTiles, setPlacedTiles] = useState([]);
    const [selectedTileIndex, setSelectedTileIndex] = useState(null);
    const [exchangeMode, setExchangeMode] = useState(false);
    const [tilesToExchange, setTilesToExchange] = useState([]);
    const [lastMoveScore, setLastMoveScore] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [viewingSnapshot, setViewingSnapshot] = useState(null);

    // Track previous turn state for notifications
    const wasMyTurnRef = useRef(isMyTurn);

    // Timer logic
    const { timeLimit, turnStartTime, currentPlayerIndex, players } = game || {};
    const currentPlayerId = players?.[currentPlayerIndex]?.id;
    const isMyTurnNow = currentPlayerId === playerId;

    // Turn notification effect
    useEffect(() => {
        if (isMyTurn && !wasMyTurnRef.current) {
            sendTurnNotification(gameName);
        }
        wasMyTurnRef.current = isMyTurn;
    }, [isMyTurn, gameName]);

    // Timer logic
    useEffect(() => {
        if (!timeLimit || !turnStartTime) {
            setTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const elapsed = (Date.now() - turnStartTime) / 1000;
            const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
            setTimeLeft(remaining);

            if (remaining === 0 && isMyTurnNow) {
                // Auto pass
                onPass();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [timeLimit, turnStartTime, isMyTurnNow, onPass]);

    // Format time
    const formatTime = (seconds) => {
        if (seconds === null) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const availableTiles = currentPlayer?.tiles?.filter((_, idx) =>
        !placedTiles.some(p => p.rackIndex === idx) && !tilesToExchange.includes(idx)
    ) || [];

    const handleTileSelect = useCallback((index) => {
        if (exchangeMode) {
            setTilesToExchange(prev =>
                prev.includes(index)
                    ? prev.filter(i => i !== index)
                    : [...prev, index]
            );
        } else {
            setSelectedTileIndex(prev => prev === index ? null : index);
        }
    }, [exchangeMode]);

    const handleCellClick = useCallback((row, col) => {
        if (!isMyTurn || selectedTileIndex === null) return;

        // Check if cell is already occupied
        if (game.board[row][col]) return;
        if (placedTiles.some(t => t.row === row && t.col === col)) return;

        const tile = currentPlayer.tiles[selectedTileIndex];
        soundManager.playClick();
        setPlacedTiles(prev => [...prev, {
            row,
            col,
            letter: tile.letter,
            value: tile.value,
            rackIndex: selectedTileIndex
        }]);

        setSelectedTileIndex(null);
    }, [isMyTurn, selectedTileIndex, game?.board, currentPlayer?.tiles, placedTiles]);

    const handleRemovePlacedTile = useCallback((row, col) => {
        setPlacedTiles(prev => prev.filter(t => !(t.row === row && t.col === col)));
    }, []);

    const handleCellDrop = useCallback((row, col, tileData) => {
        if (!isMyTurn) return;
        if (game.board[row][col]) return;
        if (placedTiles.some(t => t.row === row && t.col === col)) return;

        // Find the tile index in the rack
        const rackIndex = currentPlayer.tiles.findIndex(t =>
            t.letter === tileData.letter &&
            !placedTiles.some(p => p.rackIndex === currentPlayer.tiles.indexOf(t))
        );

        if (rackIndex === -1) return;

        setPlacedTiles(prev => [...prev, {
            row,
            col,
            letter: tileData.letter,
            value: tileData.value,
            rackIndex
        }]);
    }, [isMyTurn, game?.board, currentPlayer?.tiles, placedTiles]);

    const handleSubmit = async () => {
        if (placedTiles.length === 0) return;

        try {
            const result = await onMakeMove(placedTiles.map(({ row, col, letter, value }) => ({
                row, col, letter, value
            })));

            if (result.penalty) {
                soundManager.playError(); // Use error sound for penalty
                setLastMoveScore({ score: 0, words: ['🚫 INVALID WORD', 'TURN LOST'], isPenalty: true });
            } else {
                soundManager.playSuccess();
                setLastMoveScore({ score: result.score, words: result.words });
            }

            setTimeout(() => setLastMoveScore(null), 3000);

            setPlacedTiles([]);
            setSelectedTileIndex(null);
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleCancelPlacement = () => {
        setPlacedTiles([]);
        setSelectedTileIndex(null);
    };

    const handlePass = async () => {
        try {
            await onPass();
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleExchangeSubmit = async () => {
        if (tilesToExchange.length === 0) return;

        try {
            const letters = tilesToExchange.map(idx => currentPlayer.tiles[idx].letter);
            await onExchange(letters);
            setTilesToExchange([]);
            setExchangeMode(false);
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleCancelExchange = () => {
        setTilesToExchange([]);
        setExchangeMode(false);
    };

    // Get the tiles to show in the rack (excluding placed ones)
    const rackTiles = currentPlayer?.tiles?.map((tile, idx) => ({
        ...tile,
        originalIndex: idx
    })).filter(t => !placedTiles.some(p => p.rackIndex === t.originalIndex)) || [];

    const currentTurnPlayer = game?.players?.[game?.currentPlayerIndex];

    // Snapshot Modal Renderer
    const renderSnapshotModal = () => {
        if (!viewingSnapshot) return null;

        // viewingSnapshot can be a log object or the old format (just board)
        const boardToShow = viewingSnapshot.boardSnapshot || viewingSnapshot;
        const snapshotInfo = viewingSnapshot.playerName
            ? `${viewingSnapshot.playerName} - ${viewingSnapshot.action}`
            : 'Historical State';

        return (
            <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setViewingSnapshot(null)}>
                <div className="modal glass animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '600px' }}>
                    <div className="modal-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                        <h3>📸 {snapshotInfo}</h3>
                        <button className="icon-close-btn" onClick={() => setViewingSnapshot(null)}>✕</button>
                    </div>
                    <div className="board-container pointer-events-none">
                        <Board
                            boardState={boardToShow}
                            placedTiles={[]}
                            onCellClick={() => { }}
                            onCellDrop={() => { }}
                            onTileRemove={() => { }}
                            disabled={true}
                            t={t}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="game-page">
            <header className="game-header glass">
                <div className="game-info">
                    <h1 className="game-title desktop-only">{gameName}</h1>
                    <span className="game-language">{game?.language?.toUpperCase()}</span>
                </div>

                <div className="turn-indicator-container">
                    <div className="turn-indicator-wrapper">
                        {isMyTurn ? (
                            <span className="turn-badge your-turn">{t('game.yourTurn')}</span>
                        ) : (
                            <span className="turn-badge waiting">
                                {t('game.waitingTurn', { name: currentTurnPlayer?.name })}
                            </span>
                        )}
                        {timeLeft !== null && (
                            <div className={`timer-badge ${timeLeft < 10 ? 'urgent' : ''}`}>
                                {timeLeft < 30 ? '⏳' : '🕒'} {formatTime(timeLeft)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="game-header-actions">
                    {(game.enableChat || game.enableHistory) && (
                        <button
                            className="btn-icon chat-btn mobile-only"
                            onClick={() => setIsChatOpen(true)}
                            title={t('sidebar.chat')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>
                    )}
                    <button
                        className="btn-icon settings-btn"
                        onClick={() => setShowSettings(true)}
                        title={t('settings.title') || 'Ajustes'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button className="btn-icon leave-btn" onClick={onLeave} aria-label={t('game.leave')} title={t('game.leave')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </header>

            <main className="game-main">
                <div className="game-content">
                    <GameSidebar
                        game={game}
                        currentPlayerId={playerId}
                        lastMoveScore={lastMoveScore}
                        chatMessages={game.chatMessages || []}
                        historyLogs={game.historyLogs || []}
                        onSendMessage={onSendMessage}
                        t={t}
                    />

                    <div className="game-board-section">
                        <div className="board-container">
                            <Board
                                boardState={game?.board || []}
                                placedTiles={placedTiles}
                                onCellClick={handleCellClick}
                                onCellDrop={handleCellDrop}
                                onTileRemove={handleRemovePlacedTile}
                                disabled={!isMyTurn}
                                t={t}
                            />
                        </div>

                        {/* Board legend */}
                        <div className="board-legend">
                            <div className="legend-item">
                                <div className="legend-color legend-tw"></div>
                                <span>Triple Word</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-color legend-dw"></div>
                                <span>Double Word</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-color legend-tl"></div>
                                <span>Triple Letter</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-color legend-dl"></div>
                                <span>Double Letter</span>
                            </div>
                        </div>

                        {/* Tile Bag Info */}
                        {game.tileBagCount !== undefined && (
                            <TileBagInfo
                                count={game.tileBagCount}
                                breakdown={game.tileBagBreakdown}
                                t={t}
                            />
                        )}
                    </div>
                </div>
            </main>

            <footer className="game-footer">
                {error && (
                    <div className="game-error animate-fade-in">
                        {error}
                    </div>
                )}

                {lastMoveScore && (
                    <div className="score-popup animate-fade-in">
                        <span className="score-value">+{lastMoveScore.score}</span>
                        <span className="score-words">{lastMoveScore.words?.join(', ')}</span>
                    </div>
                )}

                {/* Mobile Scoreboard (anchored to top of footer) */}
                <div className="mobile-scoreboard-container mobile-only">
                    <Scoreboard
                        players={game.players}
                        currentPlayerIndex={game.currentPlayerIndex}
                        userPlayerId={playerId}
                        lastMoveScore={lastMoveScore}
                        tileBagCount={game.tileBagCount}
                        t={t}
                        compact={true}
                    />
                </div>

                <div className="tile-rack-section">
                    <TileRack
                        tiles={rackTiles}
                        selectedTiles={exchangeMode ? tilesToExchange : (selectedTileIndex !== null ? [selectedTileIndex] : [])}
                        onTileSelect={(_, tile) => handleTileSelect(tile.originalIndex)}
                        disabled={!isMyTurn}
                    />
                </div>

                <div className="game-actions">
                    {exchangeMode ? (
                        <>
                            <button
                                className="btn btn-primary"
                                onClick={handleExchangeSubmit}
                                disabled={loading || tilesToExchange.length === 0}
                            >
                                {t('game.exchange')} ({tilesToExchange.length})
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleCancelExchange}
                            >
                                {t('game.cancel')}
                            </button>
                        </>
                    ) : placedTiles.length > 0 ? (
                        <>
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {t('game.submit')}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleCancelPlacement}
                            >
                                {t('game.cancel')}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setExchangeMode(true)}
                                disabled={!isMyTurn || loading || game?.tileBagCount < 7}
                            >
                                {t('game.exchange')}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handlePass}
                                disabled={!isMyTurn || loading}
                            >
                                {t('game.pass')}
                            </button>
                        </>
                    )}
                </div>
            </footer>

            {/* Game Over Modal */}
            {game?.status === 'finished' && (
                <div className="modal-overlay">
                    <div className="modal glass animate-fade-in">
                        <h2>{t('game.gameOver')}</h2>

                        <div className="winner-section">
                            <span className="winner-crown">👑</span>
                            <h3>{t('game.winner')}: {game?.winner?.name}</h3>
                            <p className="winner-score">{game?.winner?.score} {t('game.points')}</p>
                        </div>

                        <div className="final-scores">
                            {game?.players?.sort((a, b) => b.score - a.score).map((player, idx) => (
                                <div key={player.id} className="final-score-item">
                                    <span className="rank">#{idx + 1}</span>
                                    <span className="name">{player.name}</span>
                                    <span className="score">{player.score}</span>
                                </div>
                            ))}
                        </div>

                        <div className="game-over-history" style={{
                            marginTop: '2rem',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            paddingTop: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '300px'
                        }}>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Full Game History</h4>
                            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                                <GameHistory
                                    history={game.historyLogs || []}
                                    t={t}
                                    onViewSnapshot={setViewingSnapshot}
                                />
                            </div>
                        </div>

                        <button className="btn btn-primary" onClick={onLeave} style={{ marginTop: '1.5rem' }}>
                            {t('game.playAgain')}
                        </button>
                    </div>
                </div>
            )}
            {renderSnapshotModal()}
            {/* Settings Modal */}
            <Settings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                t={t}
                uiLanguage={uiLanguage}
                onUiLanguageChange={onUiLanguageChange}
            />

            <MobileChatModal
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                game={game}
                currentPlayerId={playerId}
                chatMessages={game.chatMessages || []}
                historyLogs={game.historyLogs || []}
                onSendMessage={onSendMessage}
                t={t}
            />
        </div>
    );
}
