import { useRef, useEffect } from 'react';
import './GameHistory.css';

export default function GameHistory({ history = [], t }) {
    const scrollRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const formatTime = (seconds) => {
        if (!seconds) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'move': return '🎯';
            case 'pass': return '⏩';
            case 'exchange': return '🔄';
            case 'penalty': return '🚫';
            default: return '📝';
        }
    };

    return (
        <div className="game-history glass" ref={scrollRef}>
            {history.length === 0 ? (
                <div className="history-empty">
                    {t('history.empty') || 'No hstory yet'}
                </div>
            ) : (
                history.map(log => (
                    <div key={log.id} className={`history-item history-${log.action}`}>
                        <div className="history-header">
                            <span className="history-player">{log.playerName}</span>
                            <span className="history-time">{formatTime(log.timeTaken)}</span>
                        </div>
                        <div className="history-content">
                            <span className="history-icon">{getActionIcon(log.action)}</span>
                            <div className="history-details">
                                {log.action === 'move' && (
                                    <>
                                        <span className="history-words">{log.details}</span>
                                        <span className="history-score">+{log.score}</span>
                                    </>
                                )}
                                {log.action === 'pass' && (
                                    <span className="history-text">{t('history.passed') || 'Passed turn'}</span>
                                )}
                                {log.action === 'exchange' && (
                                    <span className="history-text">
                                        {t('history.exchanged', { count: parseInt(log.details) }) || `Exchanged ${log.details}`}
                                    </span>
                                )}
                                {log.action === 'penalty' && (
                                    <span className="history-penalty">
                                        {t('history.penalty') || 'Invalid word! Lost turn.'}
                                        <br />
                                        <small>({log.details})</small>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
