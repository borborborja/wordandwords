import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LANGUAGES } from '../i18n';
import './Settings.css';

export default function Settings({ isOpen, onClose, t, uiLanguage, onUiLanguageChange, user, onUpdateUser, profilesEnabled }) {
    const { isInstallable, install } = usePWAInstall();
    // Email linking state
    const [linkEmail, setLinkEmail] = useState('');
    const [emailValidating, setEmailValidating] = useState(false);
    const [emailValidated, setEmailValidated] = useState(false);
    const [emailError, setEmailError] = useState('');

    const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

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

    // Handle email linking validation
    const handleLinkEmail = async () => {
        if (!linkEmail.trim() || !linkEmail.includes('@')) return;
        setEmailValidating(true);
        setEmailError('');

        try {
            const res = await fetch(`${API_URL}/api/auth/init-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: linkEmail.trim() })
            });
            const data = await res.json();

            if (data.success) {
                // Poll for verification
                const pollInterval = setInterval(async () => {
                    const checkRes = await fetch(`${API_URL}/api/auth/check-verification/${data.token}`);
                    const checkData = await checkRes.json();
                    if (checkData.verified) {
                        clearInterval(pollInterval);
                        setEmailValidated(true);
                        setEmailValidating(false);
                        // Update user with email
                        if (user && onUpdateUser) {
                            await onUpdateUser(user.id, { email: linkEmail.trim() });
                        }
                    }
                }, 2000);

                // Timeout after 2 minutes
                setTimeout(() => {
                    clearInterval(pollInterval);
                    if (!emailValidated) {
                        setEmailValidating(false);
                        setEmailError('Timeout');
                    }
                }, 120000);
            } else {
                setEmailError(data.error);
                setEmailValidating(false);
            }
        } catch (err) {
            setEmailError('Error');
            setEmailValidating(false);
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

                    {/* Email Linking Section */}
                    {profilesEnabled && user && !user.email && (
                        <div className="settings-item">
                            <div className="settings-item-info">
                                <span className="settings-item-icon">📧</span>
                                <div className="settings-item-text">
                                    <span className="settings-item-label">
                                        {t('settings.linkEmail') || 'Vincular Email'}
                                    </span>
                                    <span className="settings-item-desc">
                                        {t('settings.linkEmailDesc') || 'Añade un email para recuperar tu cuenta fácilmente'}
                                    </span>
                                </div>
                            </div>
                            <div className="settings-email-input-group" style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '250px' }}>
                                <input
                                    type="email"
                                    className="settings-input"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        color: 'white',
                                        flex: 1,
                                        fontSize: '0.9rem'
                                    }}
                                    value={linkEmail}
                                    onChange={(e) => setLinkEmail(e.target.value)}
                                    placeholder={t('settings.enterEmailToLink') || "tu@email.com"}
                                    disabled={emailValidated || emailValidating}
                                />
                                {linkEmail.trim() && !emailValidated && (
                                    <button
                                        className="settings-btn-action"
                                        style={{
                                            background: emailValidating ? '#718096' : 'var(--primary)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => {
                                            if (emailValidating) {
                                                setEmailValidating(false);
                                                setEmailError('');
                                            } else {
                                                handleLinkEmail();
                                            }
                                        }}
                                        disabled={false}
                                    >
                                        {emailValidating ? (t('settings.changeEmail') || 'Cambiar') : (t('lobby.validateEmail') || 'Validar')}
                                    </button>
                                )}
                                {emailValidated && (
                                    <div style={{ color: '#48bb78', alignSelf: 'center' }}>✅</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* User Profile Recovery Code */}
                    {(user?.id || localStorage.getItem('userId')) && (
                        <UserRecoveryCodeSection t={t} userProps={user} />
                    )}

                    {isInstallable && (
                        <div className="settings-item">
                            <div className="settings-item-info">
                                <span className="settings-item-icon">📲</span>
                                <div className="settings-item-text">
                                    <span className="settings-item-label">
                                        Instalar App
                                    </span>
                                    <span className="settings-item-desc">
                                        Añadir a la pantalla de inicio
                                    </span>
                                </div>
                            </div>
                            <button
                                className="settings-btn-primary"
                                onClick={install}
                                style={{
                                    background: 'var(--accent-primary)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Instalar
                            </button>
                        </div>
                    )}

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

// User Recovery Code Section Component
function UserRecoveryCodeSection({ t, userProps }) {
    const [user, setUser] = useState(userProps || null);
    const [loading, setLoading] = useState(!userProps);
    const [copied, setCopied] = useState(false);

    const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

    useEffect(() => {
        if (userProps) {
            setUser(userProps);
            setLoading(false);
            return;
        }

        const userId = localStorage.getItem('userId');
        if (userId) {
            fetch(`${API_URL}/api/user/${userId}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    setUser(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [userProps]);

    const copyCode = () => {
        if (user?.recoveryCode) {
            navigator.clipboard.writeText(user.recoveryCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading || !user?.recoveryCode) return null;

    return (
        <div className="settings-item recovery-code-section">
            <div className="settings-item-info">
                <span className="settings-item-icon">🔐</span>
                <div className="settings-item-text">
                    <span className="settings-item-label">
                        {t('settings.profileCode') || 'Código de Perfil'}
                    </span>
                    <span className="settings-item-desc">
                        {t('settings.profileCodeDesc') || 'Usa este código para acceder desde otro dispositivo'}
                    </span>
                </div>
            </div>
            <div className="recovery-code-display">
                <span className="recovery-code-value">{user.recoveryCode}</span>
                <button
                    className="copy-code-btn"
                    onClick={copyCode}
                >
                    {copied ? '✅' : '📋'}
                </button>
            </div>
        </div>
    );
}
