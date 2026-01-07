import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGame } from './hooks/useGame';
import { useTranslation, LANGUAGES } from './i18n';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import Game from './components/Game';
import Admin from './components/Admin';
import GameReplay from './components/GameReplay';
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
    const [replayGameId, setReplayGameId] = useState(null);

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

    // Handle initial Magic Link / Recovery URL / Replay URL
    useEffect(() => {
        // Check for replay URL first
        const pathMatch = window.location.pathname.match(/^\/replay\/([a-zA-Z0-9-]+)/);
        if (pathMatch) {
            setReplayGameId(pathMatch[1]);
            return; // Don't process other URL params for replay
        }

        const params = new URLSearchParams(window.location.search);
        const recoverUid = params.get('recover_uid');
        const recoverGameId = params.get('game_id');

        if (recoverUid && recoverGameId) {
            // Overwrite local credentials with recovery ones
            localStorage.setItem('playerId', recoverUid);
            localStorage.setItem('gameId', recoverGameId);

            // Clean URL without reloading
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
    }, []);

    // Try to rejoin game on mount and on reconnection
    useEffect(() => {
        if (socket.connected) {
            gameState.rejoinGame();
        }

        // Also rejoin when socket reconnects after a disconnect
        const unsubReconnect = socket.onReconnect?.(() => {
            console.log('Socket reconnected - attempting to rejoin game');
            gameState.rejoinGame();
        });

        return () => {
            unsubReconnect?.();
        };
    }, [socket.connected, socket.onReconnect]);

    // Sync game state when tab/app becomes visible again (critical for mobile/async games)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                console.log('Tab became visible - syncing game state');
                gameState.rejoinGame();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Also handle when window regains focus (desktop browsers)
        const handleFocus = () => {
            if (socket.connected && localStorage.getItem('gameId')) {
                console.log('Window focused - syncing game state');
                gameState.rejoinGame();
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [socket.connected, gameState.rejoinGame]);

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

    // If in replay mode, show the replay component
    if (replayGameId) {
        return (
            <GameReplay
                gameId={replayGameId}
                onBack={() => {
                    setReplayGameId(null);
                    window.history.pushState({}, '', '/');
                }}
            />
        );
    }

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
