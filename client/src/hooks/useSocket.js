import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export function useSocket() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const reconnectCallbacksRef = useRef([]);

    useEffect(() => {
        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity, // Never give up for async games
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000, // Cap at 30 seconds
            randomizationFactor: 0.5
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            setConnected(true);
            setError(null);
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setConnected(false);
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            // Call all registered reconnect callbacks
            reconnectCallbacksRef.current.forEach(cb => cb());
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            setError(err.message);
            setConnected(false);
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    const emit = useCallback((event, data) => {
        return new Promise((resolve, reject) => {
            if (!socketRef.current?.connected) {
                reject(new Error('Not connected'));
                return;
            }

            socketRef.current.emit(event, data, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }, []);

    const on = useCallback((event, callback) => {
        socketRef.current?.on(event, callback);
        return () => socketRef.current?.off(event, callback);
    }, []);

    const off = useCallback((event, callback) => {
        socketRef.current?.off(event, callback);
    }, []);

    // Register a callback to be called on reconnection
    const onReconnect = useCallback((callback) => {
        reconnectCallbacksRef.current.push(callback);
        return () => {
            reconnectCallbacksRef.current = reconnectCallbacksRef.current.filter(cb => cb !== callback);
        };
    }, []);

    return {
        socket: socketRef.current,
        connected,
        error,
        emit,
        on,
        off,
        onReconnect
    };
}
