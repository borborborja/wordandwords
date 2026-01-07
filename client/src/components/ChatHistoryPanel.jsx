import { useState } from 'react';
import GameChat from './GameChat';
import GameHistory from './GameHistory';
import './GameSidebar.css'; // Reuse sidebar styles for tabs

export default function ChatHistoryPanel({
    game,
    currentPlayerId,
    chatMessages,
    historyLogs,
    onSendMessage,
    t
}) {
    const [activeTab, setActiveTab] = useState('history'); // Default to history

    const showChat = game.enableChat;
    const showHistory = game.enableHistory;

    if (!showChat && !showHistory) return null;

    // Auto-select available tab if current is disabled
    if (activeTab === 'chat' && !showChat && showHistory) setActiveTab('history');
    if (activeTab === 'history' && !showHistory && showChat) setActiveTab('chat');

    return (
        <div className="sidebar-tabs-container glass">
            <div className="sidebar-tabs">
                {showHistory && (
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        {t('sidebar.history') || 'History'}
                    </button>
                )}
                {showChat && (
                    <button
                        className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        {t('sidebar.chat') || 'Chat'}
                    </button>
                )}
            </div>

            <div className="sidebar-content">
                {activeTab === 'history' && showHistory && (
                    <GameHistory history={historyLogs} t={t} />
                )}
                {activeTab === 'chat' && showChat && (
                    <GameChat
                        messages={chatMessages}
                        history={game.enableHistory ? historyLogs : []}
                        onSendMessage={onSendMessage}
                        currentUserId={currentPlayerId}
                        t={t}
                    />
                )}
            </div>
        </div>
    );
}
