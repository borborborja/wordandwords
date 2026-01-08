import { useState, useRef, useEffect } from 'react';
import './WaitingRoom.css';
import { urlBase64ToUint8Array, registerServiceWorker } from '../utils/push';

// Hardcoded public key for immediate functionality (matches server default)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BO6d-kaZ3rbflknBQKNGcUAz84HHZRKunuPhE0-gendQd_zovyZ3lO10LUxSq2jjQph5rJCVy_vmifSCCeki58s';

export default function WaitingRoom({
    gameId,
    players,
    playerId,
    onStart,
    onLeave,
    language,
    t,
    gameName = 'WordAndWords'
}) {
    const [copied, setCopied] = useState(false);

    // --- PUSH NOTIFICATION LOGIC ---
    const [notifyOnJoin, setNotifyOnJoin] = useState(() => {
        return localStorage.getItem('pushEnabled') === 'true';
    });

    const togglePushNotifications = async () => {
        if (!notifyOnJoin) {
            // Enable Push
            try {
                // 1. Register Service Worker
                const registration = await registerServiceWorker();
                if (!registration) {
                    alert('No se pudo registrar el Service Worker (necesario para notificaciones en 2º plano).');
                    return;
                }

                // 2. Subscribe to Push Manager
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });

                // 3. Send subscription to server
                const res = await fetch(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/subscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription, playerId })
                });

                if (res.ok) {
                    setNotifyOnJoin(true);
                    localStorage.setItem('pushEnabled', 'true');
                    new Notification('¡Web Push Activado!', {
                        body: 'Ahora recibirás avisos incluso con el navegador cerrado (si el sistema lo permite).',
                        icon: '/pwa-icon.png'
                    });
                } else {
                    alert('Error al guardar suscripción en el servidor.');
                }
            } catch (error) {
                console.error('Error enabling push:', error);
                alert(`Error activando notificaciones: ${error.message}`);
            }
        } else {
            // Disable Push (Simulated - purely local toggle for now, ideal would be to unsubscribe on server too)
            setNotifyOnJoin(false);
            localStorage.setItem('pushEnabled', 'false');
        }
    };

    const isHost = players[0]?.id === playerId;
    const canStart = players.length >= 2;

    const handleCopyLink = async () => {
        try {
            const url = `${window.location.origin}?code=${gameId}`;
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    return (
        <div className="waiting-room page">
            <div className="waiting-content container">
                <div className="waiting-card glass animate-fade-in">
                    <h2>{t('lobby.waiting')}</h2>

                    <div className="game-code-section">
                        <p className="code-label">{t('lobby.shareCode')}</p>
                        <div className="game-code-container">
                            <div className="game-code-display" onClick={() => handleCopyLink()} title="Click to copy link">
                                {gameId}
                            </div>

                            <div className="share-buttons">
                                <button
                                    className="btn-share whatsapp"
                                    onClick={() => {
                                        const url = `${window.location.origin}?code=${gameId}`;
                                        window.open(`https://wa.me/?text=${encodeURIComponent(t('lobby.joinGame') + ': ' + url)}`, '_blank');
                                    }}
                                    title="Compartir en WhatsApp"
                                >
                                    💬 WhatsApp
                                </button>
                                <button
                                    className="btn-share telegram"
                                    onClick={() => {
                                        const url = `${window.location.origin}?code=${gameId}`;
                                        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t('lobby.joinGame'))}`, '_blank');
                                    }}
                                    title="Compartir en Telegram"
                                >
                                    ✈️ Telegram
                                </button>
                                <button
                                    className="btn-share copy-link"
                                    onClick={handleCopyLink}
                                    title="Copiar Enlace"
                                >
                                    {copied ? '✅ Copiado' : '🔗 Copiar'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Host Notifications Toggle */}
                    {isHost && (
                        <div className="notification-toggle-section" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                <input
                                    type="checkbox"
                                    checked={notifyOnJoin}
                                    onChange={togglePushNotifications}
                                    style={{ width: '16px', height: '16px' }}
                                />
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    🔔 Avisarme al entrar alguien (Web Push)
                                </span>
                            </label>
                        </div>
                    )}

                    {isHost && (
                        <div className="admin-link-section">
                            <details>
                                <summary>🔑 Enlace de Administrador (Host)</summary>
                                <div className="admin-link-content">
                                    <p className="admin-link-warning">
                                        ⚠️ <strong>¡IMPORTANTE!</strong> Este enlace es <strong>PRIVADO</strong>.
                                        Úsalo para volver a entrar a esta sala como anfitrión si se desconecta.
                                        <strong>NO lo compartas con otros jugadores.</strong>
                                    </p>
                                    <button
                                        className="btn btn-outline btn-sm w-full"
                                        onClick={async () => {
                                            const recoveryLink = `${window.location.origin}/?game_id=${gameId}&recover_uid=${playerId}`;
                                            try {
                                                await navigator.clipboard.writeText(recoveryLink);
                                                alert('Enlace de administrador copiado.');
                                            } catch (err) { }
                                        }}
                                    >
                                        📋 Copiar Enlace de Host
                                    </button>
                                </div>
                            </details>
                        </div>
                    )}
                    {copied && <span className="copied-toast">{t('lobby.copied')}</span>}
                </div>

                <div className="players-section">
                    <h3>{t('lobby.players')} ({players.length}/4)</h3>
                    <div className="players-list">
                        {players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`player-item ${player.id === playerId ? 'is-me' : ''}`}
                            >
                                <span className="player-avatar">
                                    {index === 0 ? '👑' : '👤'}
                                </span>
                                <span className="player-name">
                                    {player.name}
                                    {player.id === playerId && <span className="you-tag">(you)</span>}
                                </span>
                                <span className={`player-status ${player.connected ? 'online' : 'offline'}`}>
                                    {player.connected ? '●' : '○'}
                                </span>
                            </div>
                        ))}

                        {/* Empty slots */}
                        {Array(4 - players.length).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} className="player-item empty">
                                <span className="player-avatar">➕</span>
                                <span className="player-name">Waiting...</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="waiting-actions">
                    {isHost ? (
                        <button
                            className="btn btn-primary"
                            onClick={onStart}
                            disabled={!canStart}
                        >
                            {canStart ? t('lobby.start') : t('lobby.minPlayers')}
                        </button>
                    ) : (
                        <p className="waiting-message">
                            Waiting for host to start the game...
                        </p>
                    )}

                    <button className="btn btn-secondary" onClick={onLeave}>
                        {t('game.leave')}
                    </button>
                </div>
            </div>
        </div>
    );
}
