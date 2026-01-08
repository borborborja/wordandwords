import React, { useState, useCallback, useEffect, useRef } from 'react';

export function useGame(socket) {
    const [game, setGame] = useState(null);
    const [playerId, setPlayerId] = useState(() => localStorage.getItem('playerId'));
    const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Use ref to store callback without triggering re-renders or dependency loops
    const gameRef = React.useRef({
        onRefreshUser: null
    });

    // Listen for game updates
    useEffect(() => {
        if (!socket.connected) return;

        const handleGameUpdate = ({ game: updatedGame }) => {
            setGame(updatedGame);
        };

        const handlePlayerJoined = ({ player, playerCount }) => {
            // Update players list when someone joins
            setGame(prev => {
                if (!prev) return prev;
                // Check if player already exists
                const exists = prev.players.some(p => p.id === player.id);
                if (exists) return prev;
                return {
                    ...prev,
                    players: [...prev.players, { ...player, connected: true }]
                };
            });
        };

        const handlePlayerReconnected = ({ playerId: reconnectedId }) => {
            setGame(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map(p =>
                        p.id === reconnectedId ? { ...p, connected: true } : p
                    )
                };
            });
        };

        const handlePlayerDisconnected = ({ playerId: disconnectedId }) => {
            setGame(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map(p =>
                        p.id === disconnectedId ? { ...p, connected: false } : p
                    )
                };
            });
        };

        const handleGameStarted = ({ game: updatedGame }) => {
            setGame(updatedGame);
        };

        const handleGameEnded = ({ winner, players }) => {
            setGame(prev => prev ? { ...prev, status: 'finished', winner, players } : null);
        };

        const unsubUpdate = socket.on('gameUpdate', handleGameUpdate);
        const unsubJoined = socket.on('playerJoined', handlePlayerJoined);
        const unsubReconnected = socket.on('playerReconnected', handlePlayerReconnected);
        const unsubDisconnected = socket.on('playerDisconnected', handlePlayerDisconnected);
        const unsubStarted = socket.on('gameStarted', handleGameStarted);
        const unsubEnded = socket.on('gameEnded', handleGameEnded);

        return () => {
            unsubUpdate?.();
            unsubJoined?.();
            unsubReconnected?.();
            unsubDisconnected?.();
            unsubStarted?.();
            unsubEnded?.();
        };
    }, [socket]);

    const createGame = useCallback(async (language, name, options = {}, userId = null) => {
        setLoading(true);
        setError(null);

        const { strictMode = false, timeLimit = null, enableChat = true, enableHistory = true, qAsQu = false } = options;

        try {
            const response = await socket.emit('createGame', {
                language,
                playerName: name,
                strictMode,
                timeLimit,
                enableChat,
                enableHistory,
                qAsQu,
                userId
            });
            setGame(response.game);
            setPlayerId(response.game.players[0].id);
            localStorage.setItem('playerId', response.game.players[0].id);
            localStorage.setItem('playerName', name);
            localStorage.setItem('gameId', response.gameId);
            setPlayerName(name);

            // Trigger global user refresh to show new game in dashboard
            if (gameRef.current.onRefreshUser) gameRef.current.onRefreshUser();

            return response.gameId;
        } catch (err) {
            setError(err.message);
            // Also refresh in case of partial failure
            if (gameRef.current.onRefreshUser) gameRef.current.onRefreshUser();
            throw err;
        } finally {
            setLoading(false);
        }
    }, [socket]);

    const joinGame = useCallback(async (gameId, name, userId = null) => {
        console.log('CLIENT: joinGame called with:', { gameId, name, userId });
        setLoading(true);
        setError(null);

        try {
            const response = await socket.emit('joinGame', { gameId, playerName: name, userId });
            console.log('CLIENT: joinGame response:', response);
            setGame(response.game);
            const player = response.game.players.find(p => p.name === name);
            if (player) {
                setPlayerId(player.id);
                localStorage.setItem('playerId', player.id);
            }
            localStorage.setItem('playerName', name);
            localStorage.setItem('gameId', gameId);
            setPlayerName(name);
            return true;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [socket]);

    const startGame = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await socket.emit('startGame');
            if (response && response.game) {
                setGame(response.game);
            }
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [socket]);

    const makeMove = useCallback(async (tiles) => {
        setLoading(true);
        setError(null);

        try {
            const response = await socket.emit('makeMove', { tiles });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [socket]);

    const passTurn = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            await socket.emit('passTurn');
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [socket]);

    const exchangeTiles = useCallback((tiles) => {
        return new Promise((resolve, reject) => {
            socket.emit('exchangeTiles', { tiles }, (response) => {
                if (response.success) resolve();
                else reject(new Error(response.error));
            });
        });
    }, [socket]);

    const sendMessage = useCallback((text) => {
        return new Promise((resolve, reject) => {
            socket.emit('sendMessage', { text }, (response) => {
                if (response.success) resolve();
                else reject(new Error(response.error));
            });
        });
    }, [socket]);

    const rejoinGame = useCallback(async (userId = null) => {
        const savedGameId = localStorage.getItem('gameId');
        const savedPlayerId = localStorage.getItem('playerId');

        if (!savedGameId || !savedPlayerId) return false;

        try {
            const response = await socket.emit('rejoinGame', {
                gameId: savedGameId,
                playerId: savedPlayerId,
                userId
            });
            setGame(response.game);
            setPlayerId(savedPlayerId);
            return true;
        } catch (err) {
            localStorage.removeItem('gameId');
            localStorage.removeItem('playerId');
            return false;
        }
    }, [socket]);

    const leaveGame = useCallback(() => {
        localStorage.removeItem('gameId');
        setGame(null);
    }, []);

    const cancelGame = useCallback(async (gameId, userId) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/games/${gameId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to cancel game');
            }
            return await res.json();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteGame = useCallback(async (gameId, userId) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/games/${gameId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete game');
            }
            return await res.json();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const currentPlayer = game?.players?.find(p => p.id === playerId);
    const isMyTurn = game?.status === 'playing' &&
        game?.players[game?.currentPlayerIndex]?.id === playerId;

    return {
        game,
        playerId,
        playerName,
        currentPlayer,
        isMyTurn,
        error,
        loading,
        createGame,
        joinGame,
        startGame,
        makeMove,
        passTurn,
        exchangeTiles,
        sendMessage,
        rejoinGame,
        leaveGame,
        cancelGame,
        deleteGame,
        setPlayerName,
        setRefreshUserCallback: (cb) => { gameRef.current.onRefreshUser = cb; },
        clearError: () => setError(null)
    };
}
