import { useState, useRef, useEffect, useMemo } from 'react';
import './GameChat.css';

export default function GameChat({ messages = [], history = [], onSendMessage, t, currentUserId }) {
    const [inputText, setInputText] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const scrollRef = useRef(null);

    // Combine and sort messages and history if toggle is on
    const items = useMemo(() => {
        let combined = [...messages];
        if (showHistory) {
            // Map history items to a compatible format or handle in render
            const historyItems = history.map(h => ({
                ...h,
                type: 'history'
            }));
            combined = [...combined, ...historyItems];
        }
        return combined.sort((a, b) => a.timestamp - b.timestamp);
    }, [messages, history, showHistory]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [items]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText);
            setInputText('');
        }
    };

    const formatTime = (ts) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="game-chat glass">
            <div className="chat-header">
                <span className="chat-title">{t('chat.title') || 'Chat'}</span>
                <label className="chat-toggle">
                    <input
                        type="checkbox"
                        checked={showHistory}
                        onChange={(e) => setShowHistory(e.target.checked)}
                    />
                    <span className="toggle-label">{t('chat.showHistory') || 'Show History'}</span>
                </label>
            </div>

            <div className="chat-messages" ref={scrollRef}>
                {items.length === 0 ? (
                    <div className="chat-empty">{t('chat.empty') || 'Start the conversation!'}</div>
                ) : (
                    items.map(item => {
                        if (item.type === 'history') {
                            return (
                                <div key={`hist-${item.id}`} className="chat-item history-event">
                                    <span className="event-icon">
                                        {item.action === 'move' ? '🎯' :
                                            item.action === 'pass' ? '⏩' :
                                                item.action === 'exchange' ? '🔄' : '📝'}
                                    </span>
                                    <span className="event-text">
                                        <b>{item.playerName}</b>
                                        {item.action === 'move' && ` played ${item.details} (+${item.score})`}
                                        {item.action === 'pass' && ` passed`}
                                        {item.action === 'exchange' && ` exchanged tiles`}
                                    </span>
                                </div>
                            );
                        }

                        const isMe = item.senderId === currentUserId;
                        return (
                            <div key={`msg-${item.id}`} className={`chat-item message ${isMe ? 'me' : 'other'}`}>
                                {!isMe && <div className="message-sender">{item.senderName}</div>}
                                <div className="message-bubble">
                                    {item.text}
                                </div>
                                <div className="message-time">{formatTime(item.timestamp)}</div>
                            </div>
                        );
                    })
                )}
            </div>

            <form className="chat-input-area" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t('chat.placeholder') || 'Type a message...'}
                    maxLength={200}
                />
                <button type="submit" disabled={!inputText.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
}
