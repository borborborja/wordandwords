import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import UserDashboard from './UserDashboard';
import './Lobby.css';
import { LANGUAGES } from '../i18n';

export default function Lobby({
    onCreateGame,
    onJoinGame,
    playerName,
    onNameChange,
    loading,
    error,
    t,
    uiLanguage,
    onUiLanguageChange,
    onOpenAdmin,
    initialGameCode,
    gameName = 'WordAndWords',
    user,
    userLoading,
    onCreateUser,
    onRecoverUser,
    onLogout,
    onRefreshUser,
    profilesEnabled = true
}) {
    const { isInstallable, install } = usePWAInstall();
    const [mode, setMode] = useState(initialGameCode ? 'join' : null); // null, 'create', 'join', 'login'
    const [gameLanguage, setGameLanguage] = useState('es');
    const [strictMode, setStrictMode] = useState(false);
    const [timeLimit, setTimeLimit] = useState(null);
    const [enableChat, setEnableChat] = useState(true);
    const [enableHistory, setEnableHistory] = useState(true);
    const [qAsQu, setQAsQu] = useState(false);
    const [showTileBagCount, setShowTileBagCount] = useState(true);
    const [showTileBagBreakdown, setShowTileBagBreakdown] = useState(false);
    const [gameCode, setGameCode] = useState(initialGameCode || '');
    const [localName, setLocalName] = useState(playerName || (user?.name || ''));
    const [localEmail, setLocalEmail] = useState('');
    const [emailValidating, setEmailValidating] = useState(false);
    const [emailValidated, setEmailValidated] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginSent, setLoginSent] = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [fallbackCode, setFallbackCode] = useState(null);

    const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

    // Handle email validation - send verification link and poll
    const handleValidateEmail = async () => {
        if (!localEmail.trim()) return;
        setEmailValidating(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/init-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localEmail.trim() })
            });
            const data = await res.json();

            if (data.success) {
                // Start polling
                const pollInterval = setInterval(async () => {
                    try {
                        const checkRes = await fetch(`${API_URL}/api/auth/check-status?email=${encodeURIComponent(localEmail.trim())}`);
                        const checkData = await checkRes.json();

                        if (checkData.verified) {
                            setEmailValidated(true);
                            setEmailValidating(false);
                            clearInterval(pollInterval);
                        }
                    } catch (err) {
                        // ignore poll errors
                    }
                }, 3000);

                // Cleanup after 5 minutes
                setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);

                // Keep "validating" state true to show UI feedback
            } else if (data.error) {
                alert(data.error);
                setEmailValidating(false);
            }
        } catch (err) {
            console.error('Validation error:', err);
            setEmailValidating(false);
        }
    };

    // Handle game creation - create user profile if needed
    const handleCreate = async () => {
        if (!localName.trim()) return;

        // If no user profile, create one first (with email)
        if (!user && onCreateUser) {
            try {
                await onCreateUser(localName.trim(), localEmail.trim() || null);
            } catch (err) {
                console.error('Failed to create user profile:', err);
            }
        } else if (user && localEmail.trim() && onUpdateUser) {
            // If user exists and provides email, update profile
            try {
                await onUpdateUser(user.id, { email: localEmail.trim() });
            } catch (err) {
                console.error('Failed to update user profile:', err);
            }
        }

        onCreateGame(gameLanguage, localName.trim(), {
            strictMode,
            timeLimit,
            enableChat,
            enableHistory,
            qAsQu: gameLanguage === 'ca' ? qAsQu : false,
            showTileBagCount,
            showTileBagBreakdown
        });
    };

    // Handle joining game
    const handleJoin = async () => {
        if (!localName.trim() || !gameCode.trim()) return;

        // If no user profile, create one first
        if (!user && onCreateUser) {
            try {
                await onCreateUser(localName.trim(), localEmail.trim() || null);
            } catch (err) {
                console.error('Failed to create user profile:', err);
            }
        } else if (user && localEmail.trim() && onUpdateUser) {
            // If user exists and provides email, update profile
            try {
                await onUpdateUser(user.id, { email: localEmail.trim() });
            } catch (err) {
                console.error('Failed to update user profile:', err);
            }
        }

        onJoinGame(gameCode.trim(), localName.trim());
    };

    // Handle login via email (send magic link)
    const handleSendLoginLink = async () => {
        if (!loginEmail.trim()) return;
        setLoginError(null);
        setFallbackCode(null);

        try {
            const res = await fetch(`${API_URL}/api/user/send-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail.trim() })
            });
            const data = await res.json();

            if (data.success) {
                setLoginSent(true);
            } else if (data.fallbackCode) {
                // SMTP not configured, show fallback code
                setFallbackCode(data.fallbackCode);
            } else {
                setLoginError(data.error || 'Error al enviar');
            }
        } catch (err) {
            setLoginError('Error de conexión');
        }
    };

    // If user is logged in and has active games, show dashboard
    if (user && user.activeGames?.length > 0 && !mode) {
        return (
            <div className="lobby page">
                <div className="lobby-header">
                    <button className="admin-btn" onClick={onOpenAdmin} title="Admin Panel">⚙️</button>
                    <div className="language-switcher">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${uiLanguage === lang.code ? 'active' : ''}`}
                                onClick={() => onUiLanguageChange(lang.code)}
                            >
                                {lang.code.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <UserDashboard
                    user={user}
                    onEnterGame={(gameId) => onJoinGame(gameId, user.name)}
                    onCreateGame={() => setMode('create')}
                    onJoinGame={() => setMode('join')}
                    onLogout={onLogout}
                    t={t}
                />
            </div>
        );
    }

    return (
        <div className="lobby page">
            <div className="lobby-header">
                <button
                    className="admin-btn"
                    onClick={onOpenAdmin}
                    title="Admin Panel"
                >
                    ⚙️
                </button>
                <div className="language-switcher">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            className={`lang-btn ${uiLanguage === lang.code ? 'active' : ''}`}
                            onClick={() => onUiLanguageChange(lang.code)}
                        >
                            {lang.code.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="lobby-content container">
                <div className="lobby-hero animate-fade-in">
                    <h1 className="lobby-title">{gameName}</h1>
                    <p className="lobby-subtitle">{t('lobby.subtitle')}</p>
                </div>

                {!mode && (
                    <div className="lobby-actions animate-fade-in">
                        <div className="lobby-card glass" onClick={() => setMode('create')}>
                            <div className="card-icon">🎮</div>
                            <h3>{t('lobby.createGame')}</h3>
                            <p>{t('lobby.createGameDesc')}</p>
                        </div>

                        <div className="lobby-card glass" onClick={() => setMode('join')}>
                            <div className="card-icon">🔗</div>
                            <h3>{t('lobby.joinGame')}</h3>
                            <p>{t('lobby.joinGameDesc')}</p>
                        </div>

                        {profilesEnabled && (
                            <div className="lobby-card glass login-card" onClick={() => setMode('login')}>
                                <div className="card-icon">📧</div>
                                <h3>{t('lobby.haveAccount') || '¿Ya tienes cuenta?'}</h3>
                                <p>{t('lobby.loginDesc') || 'Accede con tu email'}</p>
                            </div>
                        )}
                    </div>
                )}

                {mode && (
                    <div className="lobby-form glass animate-fade-in">
                        <button className="back-btn" onClick={() => { setMode(null); setLoginSent(false); setFallbackCode(null); }}>
                            ← {t('common.back') || 'Volver'}
                        </button>

                        <h2>
                            {mode === 'create' && t('lobby.createGame')}
                            {mode === 'join' && t('lobby.joinGame')}
                            {mode === 'login' && (t('lobby.login') || 'Acceder')}
                        </h2>

                        {/* Login Mode - just email */}
                        {mode === 'login' && (
                            <>
                                {loginSent ? (
                                    <div className="login-success">
                                        <div className="success-icon">✉️</div>
                                        <h3>{t('lobby.checkEmail') || '¡Revisa tu email!'}</h3>
                                        <p>{t('lobby.linkSent') || 'Te hemos enviado un enlace para acceder'}</p>
                                        <button
                                            className="btn-link"
                                            style={{ marginTop: '1rem' }}
                                            onClick={() => {
                                                setLoginSent(false);
                                                handleSendLoginLink();
                                            }}
                                        >
                                            {t('lobby.resendEmail') || 'Reenviar email'}
                                        </button>
                                    </div>
                                ) : fallbackCode ? (
                                    <div className="fallback-code-display">
                                        <p>{t('lobby.smtpNotConfigured') || 'Email no disponible. Usa este código:'}</p>
                                        <div className="code-box">{fallbackCode}</div>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="label">{t('lobby.enterEmail') || 'Tu email'}</label>
                                        <input
                                            type="email"
                                            className="input"
                                            value={loginEmail}
                                            onChange={(e) => setLoginEmail(e.target.value)}
                                            placeholder="tu@email.com"
                                        />
                                        {loginError && <div className="error-message">{loginError}</div>}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Create/Join Modes - name + optional email */}
                        {(mode === 'create' || mode === 'join') && (
                            <>
                                <div className="form-group">
                                    <label className="label">{t('lobby.enterName')}</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={localName}
                                        onChange={(e) => setLocalName(e.target.value)}
                                        placeholder="Tu nombre..."
                                        maxLength={20}
                                    />
                                </div>
                                {profilesEnabled && (
                                    <div className="form-group">
                                        <label className="label">{t('lobby.enterEmail') || 'Email'} <span className="optional">({t('common.optional') || 'opcional'})</span></label>
                                        <div className="email-input-group" style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="email"
                                                className="input"
                                                value={localEmail}
                                                onChange={(e) => setLocalEmail(e.target.value)}
                                                placeholder="tu@email.com"
                                                disabled={emailValidated || emailValidating}
                                                style={{ flex: 1 }}
                                            />
                                            {localEmail.trim() && !emailValidated && (
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={handleValidateEmail}
                                                    disabled={emailValidating}
                                                    style={{ minWidth: '80px' }}
                                                >
                                                    {emailValidating ? '...' : (t('lobby.validateEmail') || 'Validar')}
                                                </button>
                                            )}
                                            {emailValidated && (
                                                <div className="validated-check" style={{ display: 'flex', alignItems: 'center', color: '#48bb78', fontSize: '1.5rem' }}>
                                                    ✅
                                                </div>
                                            )}
                                        </div>
                                        <small className="form-hint">
                                            {emailValidating ? (
                                                <>
                                                    {t('lobby.checkEmail') || '¡Revisa tu email!'} {' '}
                                                    <button className="btn-link btn-link-sm" onClick={handleValidateEmail}>
                                                        ({t('lobby.resend') || 'reenviar'})
                                                    </button>
                                                </>
                                            ) :
                                                emailValidated ? (t('lobby.emailVerified') || 'Email verificado') :
                                                    (t('lobby.emailHint') || 'Para acceder desde otros dispositivos')}
                                        </small>
                                    </div>
                                )}
                            </>
                        )}

                        {mode === 'create' && (
                            <div className="form-group">
                                <label className="label">{t('lobby.selectLanguage')}</label>
                                <div className="language-selector">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            className={`language-option ${gameLanguage === lang.code ? 'selected' : ''}`}
                                            onClick={() => setGameLanguage(lang.code)}
                                        >

                                            <span className="lang-name">{lang.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="options-grid">
                                    <div className="option-item">
                                        <label className="switch-label custom-switch">
                                            <input
                                                type="checkbox"
                                                checked={strictMode}
                                                onChange={(e) => setStrictMode(e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                            <span className="switch-text">{t('lobby.strictMode')}</span>
                                        </label>
                                        <div className="option-desc">{t('lobby.strictModeDesc')}</div>
                                    </div>

                                    <div className="option-item">
                                        <label className="label-sm">{t('lobby.timeLimit')}</label>
                                        <div className="time-selector">
                                            <button
                                                className={`time-btn ${!timeLimit ? 'active' : ''}`}
                                                onClick={() => setTimeLimit(null)}
                                            >∞ {t('lobby.timeInfinite')}</button>
                                            <button
                                                className={`time-btn ${timeLimit === 900 ? 'active' : ''}`}
                                                onClick={() => setTimeLimit(900)}
                                            >15m</button>
                                            <button
                                                className={`time-btn ${timeLimit === 7200 ? 'active' : ''}`}
                                                onClick={() => setTimeLimit(7200)}
                                            >2h</button>
                                            <button
                                                className={`time-btn ${timeLimit === 86400 ? 'active' : ''}`}
                                                onClick={() => setTimeLimit(86400)}
                                            >1d</button>
                                        </div>
                                    </div>


                                    <div className="option-item checkbox-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={enableHistory}
                                                onChange={(e) => setEnableHistory(e.target.checked)}
                                            />
                                            {t('lobby.enableHistory')}
                                        </label>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={enableChat}
                                                onChange={(e) => setEnableChat(e.target.checked)}
                                            />
                                            {t('lobby.enableChat')}
                                        </label>

                                        {gameLanguage === 'ca' && (
                                            <label className="checkbox-label" title="La fitxa Q es juga com el dígraf QU">
                                                <input
                                                    type="checkbox"
                                                    checked={qAsQu}
                                                    onChange={(e) => setQAsQu(e.target.checked)}
                                                />
                                                Q = QU (Regla de clubs)
                                            </label>
                                        )}

                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={showTileBagCount}
                                                onChange={(e) => setShowTileBagCount(e.target.checked)}
                                            />
                                            {t('lobby.showTileBagCount') || 'Mostrar fichas restantes'}
                                        </label>

                                        {showTileBagCount && (
                                            <label className="checkbox-label sub-option">
                                                <input
                                                    type="checkbox"
                                                    checked={showTileBagBreakdown}
                                                    onChange={(e) => setShowTileBagBreakdown(e.target.checked)}
                                                />
                                                {t('lobby.showTileBagBreakdown') || 'Desglose por letra'}
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {mode === 'join' && (
                            <div className="form-group">
                                <label className="label">{t('lobby.enterCode')}</label>
                                <input
                                    type="text"
                                    className="input code-input"
                                    value={gameCode}
                                    onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                                    placeholder="ABCD1234"
                                    maxLength={8}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        {!(mode === 'login' && loginSent) && (
                            <button
                                className="btn btn-primary w-full"
                                onClick={mode === 'create' ? handleCreate : mode === 'join' ? handleJoin : handleSendLoginLink}
                                disabled={
                                    loading ||
                                    (mode === 'create' && !localName.trim()) ||
                                    (mode === 'join' && (!localName.trim() || !gameCode.trim())) ||
                                    (mode === 'login' && !loginEmail.trim()) ||
                                    // Block if email entered but not validated
                                    (localEmail.trim() && !emailValidated)
                                }
                            >
                                {loading ? 'Loading...' :
                                    mode === 'create' ? t('lobby.createGame') :
                                        mode === 'join' ? t('lobby.joinGame') :
                                            (t('lobby.sendLink') || 'Enviar enlace')}
                            </button>
                        )}
                    </div>
                )}

                <div className="lobby-footer" style={{ marginTop: '2rem', textAlign: 'center' }}>
                    {isInstallable && (
                        <button
                            className="btn btn-outline btn-sm animate-pulse"
                            onClick={install}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                fontSize: '0.9rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}
                        >
                            📲 Instalar App
                        </button>
                    )}
                </div>
            </div>

            {/* Decorative elements */}
            <div className="lobby-decoration">
                <div className="float-tile tile-1">W</div>
                <div className="float-tile tile-2">O</div>
                <div className="float-tile tile-3">R</div>
                <div className="float-tile tile-4">D</div>
            </div>
        </div >
    );
}
