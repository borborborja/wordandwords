import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGame } from './hooks/useGame';
import { useTranslation, LANGUAGES } from './i18n';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import Game from './components/Game';
import Admin from './components/Admin';
import GameReplay from './components/GameReplay';
import UserDashboard from './components/UserDashboard';
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
    const [profilesEnabled, setProfilesEnabled] = useState(true);
    const [replayGameId, setReplayGameId] = useState(null);
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);

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
                if (data.enableProfiles !== undefined) {
                    setProfilesEnabled(data.enableProfiles);
                }
            })
            .catch(err => console.error('Failed to load config:', err));
    }, []);

    // Load user profile from localStorage OR from auth_token in URL (magic link)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authToken = urlParams.get('auth_token');

        // If auth_token in URL, verify it and auto-login
        if (authToken) {
            fetch(`${API_URL}/api/auth/verify?token=${authToken}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.user) {
                        setUser(data.user);
                        localStorage.setItem('userId', data.user.id);
                        // Clean URL
                        window.history.replaceState({}, '', '/');
                    }
                })
                .catch(err => console.error('Failed to verify auth token:', err))
                .finally(() => setUserLoading(false));
            return;
        }

        // Otherwise load from localStorage
        const savedUserId = localStorage.getItem('userId');
        if (savedUserId) {
            fetch(`${API_URL}/api/user/${savedUserId}`)
                .then(res => res.ok ? res.json() : null)
                .then(userData => {
                    if (userData) {
                        setUser(userData);
                    } else {
                        // User no longer exists, clear localStorage
                        localStorage.removeItem('userId');
                    }
                })
                .catch(err => console.error('Failed to load user:', err))
                .finally(() => setUserLoading(false));
        } else {
            setUserLoading(false);
        }
    }, []);

    // Create user profile
    const createUserProfile = useCallback(async (name, email = null) => {
        try {
            const res = await fetch(`${API_URL}/api/user/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
                localStorage.setItem('userId', data.user.id);
                return data.user;
            }
            throw new Error(data.error);
        } catch (err) {
            console.error('Failed to create user:', err);
            throw err;
        }
    }, []);

    // Recover user profile by code
    const recoverUserProfile = useCallback(async (code) => {
        try {
            const res = await fetch(`${API_URL}/api/user/recover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
                localStorage.setItem('userId', data.user.id);
                return data.user;
            }
            throw new Error(data.error || 'User not found');
        } catch (err) {
            console.error('Failed to recover user:', err);
            throw err;
        }
    }, []);

    // Update user profile
    const updateUserProfile = useCallback(async (userId, data) => {
        try {
            const res = await fetch(`${API_URL}/api/user/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const updatedUser = await res.json();
            if (updatedUser.success && updatedUser.user) {
                setUser(updatedUser.user);
                return updatedUser.user;
            }
        } catch (err) {
            console.error('Failed to update user:', err);
        }
        return null;
    }, []);

    // Refresh user data (after game actions)
    const refreshUser = useCallback(async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        try {
            const res = await fetch(`${API_URL}/api/user/${userId}`);
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            }
        } catch (err) {
            console.error('Failed to refresh user:', err);
        }
    }, []);

    // Logout
    const logoutUser = useCallback(() => {
        setUser(null);
        localStorage.removeItem('userId');
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
        const attemptRejoin = async () => {
            if (socket.connected) {
                const success = await gameState.rejoinGame(user?.id);
                if (success && user) {
                    refreshUser();
                }
            }
        };

        attemptRejoin();

        // Also rejoin when socket reconnects after a disconnect
        const unsubReconnect = socket.onReconnect?.(() => {
            console.log('Socket reconnected - attempting to rejoin game');
            attemptRejoin();
        });

        return () => {
            unsubReconnect?.();
        };
    }, [socket.connected, socket.onReconnect, user?.id, refreshUser]);

    // Sync game state when tab/app becomes visible again (critical for mobile/async games)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                console.log('Tab became visible - syncing game state');
                const success = await gameState.rejoinGame(user?.id);
                if (success && user) {
                    refreshUser();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Also handle when window regains focus (desktop browsers)
        const handleFocus = async () => {
            if (socket.connected && localStorage.getItem('gameId')) {
                console.log('Window focused - syncing game state');
                const success = await gameState.rejoinGame(user?.id);
                if (success && user) {
                    refreshUser();
                }
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [socket.connected, gameState.rejoinGame, user?.id, refreshUser]);

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
                    initialGameCode={new URLSearchParams(window.location.search).get('code')}
                    user={user}
                    userLoading={userLoading}
                    onCreateUser={createUserProfile}
                    onRecoverUser={recoverUserProfile}
                    onLogout={logoutUser}
                    onRefreshUser={refreshUser}
                    onUpdateUser={updateUserProfile}
                    profilesEnabled={profilesEnabled}
                    onOpenAdmin={() => setShowAdmin(true)}
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
                onCreateGame={(lang, name, opts) => gameState.createGame(lang, name, opts, user?.id)}
                onJoinGame={(gameId, name) => gameState.joinGame(gameId, name, user?.id)}
                loading={gameState.loading}
                error={gameState.error}
                t={t}
                uiLanguage={uiLanguage}
                onUiLanguageChange={setUiLanguage}
                onOpenAdmin={() => setShowAdmin(true)}
                initialGameCode={new URLSearchParams(window.location.search).get('code')}
                gameName={gameName}
                user={user}
                userLoading={userLoading}
                onCreateUser={createUserProfile}
                onRecoverUser={recoverUserProfile}
                onLogout={logoutUser}
                onRefreshUser={refreshUser}
                onUpdateUser={updateUserProfile}
                profilesEnabled={profilesEnabled}
                onEnterGame={(gameId) => gameState.joinGame(gameId, user?.name, user?.id)}
                onStartGame={gameState.startGame}
                onCancelGame={(gameId) => gameState.cancelGame(gameId, user?.id)}
                onDeleteGame={(gameId) => gameState.deleteGame(gameId, user?.id)}
            />
        );
    };

    return (
        <div className="app">
            <ConnectionStatus />

            {/* If in replay mode, show replay component, else show main view */}
            {replayGameId ? (
                <GameReplay
                    gameId={replayGameId}
                    onBack={() => {
                        setReplayGameId(null);
                        window.history.pushState({}, '', '/');
                    }}
                />
            ) : renderView()}

            {showAdmin && (
                <Admin
                    onClose={() => setShowAdmin(false)}
                    t={t}
                />
            )}
        </div>
    );
}
