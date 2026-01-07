import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export function useSocket() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current.on('connect', () => {
            setConnected(true);
            setError(null);
        });

        socketRef.current.on('disconnect', () => {
            setConnected(false);
        });

        socketRef.current.on('connect_error', (err) => {
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

    return {
        socket: socketRef.current,
        connected,
        error,
        emit,
        on,
        off
    };
}
