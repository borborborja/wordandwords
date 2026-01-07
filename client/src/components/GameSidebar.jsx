import Scoreboard from './Scoreboard';
import ChatHistoryPanel from './ChatHistoryPanel';
import './GameSidebar.css';

export default function GameSidebar({
    game,
    currentPlayerId,
    lastMoveScore,
    chatMessages,
    historyLogs,
    onSendMessage,
    t
}) {
    return (
        <aside className="game-sidebar">
            <Scoreboard
                players={game.players}
                currentPlayerIndex={game.currentPlayerIndex}
                userPlayerId={currentPlayerId}
                lastMoveScore={lastMoveScore}
                tileBagCount={game.tileBagCount}
                t={t}
            />

            <ChatHistoryPanel
                game={game}
                currentPlayerId={currentPlayerId}
                chatMessages={chatMessages}
                historyLogs={historyLogs}
                onSendMessage={onSendMessage}
                t={t}
            />
        </aside>
    );
}
