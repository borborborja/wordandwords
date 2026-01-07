import { useState, useEffect } from 'react';
import { LANGUAGES } from '../i18n';
import './Settings.css';

export default function Settings({ isOpen, onClose, t, uiLanguage, onUiLanguageChange }) {
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('soundEnabled');
        return saved !== null ? saved === 'true' : true;
    });

    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const saved = localStorage.getItem('notificationsEnabled');
        return saved === 'true';
    });

    const [notificationPermission, setNotificationPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('soundEnabled', soundEnabled);
    }, [soundEnabled]);

    useEffect(() => {
        localStorage.setItem('notificationsEnabled', notificationsEnabled);
    }, [notificationsEnabled]);

    const requestNotificationPermission = async () => {
        if (typeof Notification === 'undefined') {
            alert('Tu navegador no soporta notificaciones');
            return;
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
            setNotificationsEnabled(true);
            // Show test notification
            new Notification('WordAndWords', {
                body: '¡Notificaciones activadas!',
                icon: '/pwa-icon.png'
            });
        }
    };

    const handleNotificationToggle = () => {
        if (!notificationsEnabled) {
            if (notificationPermission !== 'granted') {
                requestNotificationPermission();
            } else {
                setNotificationsEnabled(true);
            }
        } else {
            setNotificationsEnabled(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal glass" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>⚙️ {t('settings.title') || 'Ajustes'}</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <span className="settings-item-icon">🔊</span>
                            <div className="settings-item-text">
                                <span className="settings-item-label">
                                    {t('settings.sound') || 'Sonido'}
                                </span>
                                <span className="settings-item-desc">
                                    {t('settings.soundDesc') || 'Efectos de sonido del juego'}
                                </span>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={soundEnabled}
                                onChange={() => setSoundEnabled(!soundEnabled)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="settings-item">
                        <div className="settings-item-info">
                            <span className="settings-item-icon">🌐</span>
                            <div className="settings-item-text">
                                <span className="settings-item-label">
                                    {t('settings.language') || 'Idioma'}
                                </span>
                                <span className="settings-item-desc">
                                    {t('settings.languageDesc') || 'Cambiar idioma de la interfaz'}
                                </span>
                            </div>
                        </div>
                        <div className="settings-language-selector">
                            {LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`settings-lang-btn ${uiLanguage === lang.code ? 'active' : ''}`}
                                    onClick={() => onUiLanguageChange && onUiLanguageChange(lang.code)}
                                    title={lang.name}
                                >
                                    {lang.code.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="settings-item">
                        <div className="settings-item-info">
                            <span className="settings-item-icon">🔔</span>
                            <div className="settings-item-text">
                                <span className="settings-item-label">
                                    {t('settings.notifications') || 'Notificaciones'}
                                </span>
                                <span className="settings-item-desc">
                                    {t('settings.notificationsDesc') || 'Avisar cuando sea tu turno'}
                                </span>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={notificationsEnabled}
                                onChange={handleNotificationToggle}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="settings-item">
                        <div className="settings-item-info">
                            <span className="settings-item-icon">🔑</span>
                            <div className="settings-item-text">
                                <span className="settings-item-label">
                                    {t('settings.recovery') || 'Recuperar Sesión'}
                                </span>
                                <span className="settings-item-desc">
                                    {t('settings.recoveryDesc') || 'Copia este enlace para entrar desde otro dispositivo'}
                                </span>
                            </div>
                        </div>
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            style={{
                                background: 'var(--primary)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                            onClick={() => {
                                const playerId = localStorage.getItem('playerId');
                                const gameId = localStorage.getItem('gameId');
                                if (playerId && gameId) {
                                    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                                    const url = `${baseUrl}/?game_id=${gameId}&recover_uid=${playerId}`;

                                    // Try Clipboard API first
                                    if (navigator.clipboard && window.isSecureContext) {
                                        navigator.clipboard.writeText(url).then(() => {
                                            alert(t('settings.linkCopied') || 'Enlace copiado al portapapeles');
                                        }).catch(() => fallbackCopyTextToClipboard(url));
                                    } else {
                                        // Fallback
                                        fallbackCopyTextToClipboard(url);
                                    }

                                    function fallbackCopyTextToClipboard(text) {
                                        const textArea = document.createElement("textarea");
                                        textArea.value = text;
                                        textArea.style.position = "fixed";  // Avoid scrolling to bottom
                                        document.body.appendChild(textArea);
                                        textArea.focus();
                                        textArea.select();
                                        try {
                                            document.execCommand('copy');
                                            alert(t('settings.linkCopied') || 'Enlace copiado al portapapeles');
                                        } catch (err) {
                                            console.error('Fallback: Oops, unable to copy', err);
                                            prompt('Copia este enlace manualmente:', text);
                                        }
                                        document.body.removeChild(textArea);
                                    }
                                } else {
                                    alert(t('settings.noGame') || 'No tienes una partida activa para recuperar');
                                }
                            }}
                        >
                            🔗 {t('settings.copyLink') || 'Copiar Enlace'}
                        </button>
                    </div>

                    {notificationPermission === 'denied' && (
                        <div className="settings-warning">
                            ⚠️ {t('settings.notificationsDenied') || 'Las notificaciones están bloqueadas en tu navegador. Actívalas en la configuración del navegador.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper function to send a turn notification
export function sendTurnNotification(gameName = 'WordAndWords') {
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';

    if (!notificationsEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // Don't notify if tab is focused

    new Notification(gameName, {
        body: '¡Es tu turno!',
        icon: '/pwa-icon.png',
        tag: 'turn-notification', // Prevents duplicate notifications
        requireInteraction: false
    });
}

// Helper to check if sound is enabled
export function isSoundEnabled() {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
}
