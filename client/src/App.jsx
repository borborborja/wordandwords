import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGame } from './hooks/useGame';
import { useTranslation, LANGUAGES } from './i18n';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import Game from './components/Game';
import Admin from './components/Admin';
import './App.css';

const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function App() {
    const [uiLanguage, setUiLanguage] = useState(() => {
        const saved = localStorage.getItem('uiLanguage');
        if (saved) return saved;

        // Detect browser language
        const browserLang = navigator.language.split('-')[0];
        return LANGUAGES.some(l => l.code === browserLang) ? browserLang : 'en';
    });

    const [showAdmin, setShowAdmin] = useState(false);
    const [gameName, setGameName] = useState('WordAndWords');

    const { t } = useTranslation(uiLanguage);
    const socket = useSocket();
    const gameState = useGame(socket);

    // Fetch game config on mount
    useEffect(() => {
        fetch(`${API_URL}/api/config`)
            .then(res => res.json())
            .then(data => {
                if (data.gameName) {
                    setGameName(data.gameName);
                    document.title = `${data.gameName} - Multiplayer Word Game`;
                }
            })
            .catch(err => console.error('Failed to load config:', err));
    }, []);

    // Save UI language preference
    useEffect(() => {
        localStorage.setItem('uiLanguage', uiLanguage);
    }, [uiLanguage]);

    // Try to rejoin game on mount
    useEffect(() => {
        if (socket.connected) {
            gameState.rejoinGame();
        }
    }, [socket.connected]);

    // Connection status indicator
    const ConnectionStatus = () => (
        <div className={`connection-status ${socket.connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
                {socket.connected ? 'Connected' : 'Connecting...'}
            </span>
        </div>
    );

    // Render appropriate view
    const renderView = () => {
        // In game (playing or finished)
        if (gameState.game?.status === 'playing' || gameState.game?.status === 'finished') {
            return (
                <Game
                    game={gameState.game}
                    playerId={gameState.playerId}
                    currentPlayer={gameState.currentPlayer}
                    isMyTurn={gameState.isMyTurn}
                    onMakeMove={gameState.makeMove}
                    onPass={gameState.passTurn}
                    onExchange={gameState.exchangeTiles}
                    onLeave={gameState.leaveGame}
                    onSendMessage={gameState.sendMessage}
                    loading={gameState.loading}
                    error={gameState.error}
                    t={t}
                    gameName={gameName}
                    uiLanguage={uiLanguage}
                    onUiLanguageChange={setUiLanguage}
                />
            );
        }

        // Waiting room (game created, waiting for players)
        if (gameState.game?.status === 'waiting') {
            return (
                <WaitingRoom
                    gameId={gameState.game.id}
                    players={gameState.game.players}
                    playerId={gameState.playerId}
                    language={gameState.game.language}
                    onStart={gameState.startGame}
                    onLeave={gameState.leaveGame}
                    t={t}
                    gameName={gameName}
                />
            );
        }

        // Lobby (no game)
        return (
            <Lobby
                onCreateGame={gameState.createGame}
                onJoinGame={gameState.joinGame}
                playerName={gameState.playerName}
                onNameChange={gameState.setPlayerName}
                loading={gameState.loading}
                error={gameState.error}
                t={t}
                uiLanguage={uiLanguage}
                onUiLanguageChange={setUiLanguage}
                onOpenAdmin={() => setShowAdmin(true)}
                initialGameCode={new URLSearchParams(window.location.search).get('code')}
                gameName={gameName}
            />
        );
    };

    return (
        <div className="app">
            <ConnectionStatus />
            {renderView()}

            {showAdmin && (
                <Admin
                    onClose={() => setShowAdmin(false)}
                    t={t}
                />
            )}
        </div>
    );
}
