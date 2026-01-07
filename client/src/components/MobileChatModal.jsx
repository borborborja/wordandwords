import ChatHistoryPanel from './ChatHistoryPanel';

export default function MobileChatModal({
    isOpen,
    onClose,
    game,
    currentPlayerId,
    chatMessages,
    historyLogs,
    onSendMessage,
    t
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
            <div className="modal-content glass chat-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('sidebar.chat') || 'Chat'} / {t('sidebar.history') || 'History'}</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <div className="chat-modal-body">
                    <ChatHistoryPanel
                        game={game}
                        currentPlayerId={currentPlayerId}
                        chatMessages={chatMessages}
                        historyLogs={historyLogs}
                        onSendMessage={onSendMessage}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
}
