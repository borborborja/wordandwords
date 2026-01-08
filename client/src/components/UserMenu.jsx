import { useState, useRef, useEffect } from 'react';
import './UserMenu.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function UserMenu({
    user,
    onLogout,
    t,
    onUpdateUser,
    profilesEnabled
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [showRecoveryCode, setShowRecoveryCode] = useState(false);
    const [copied, setCopied] = useState(false);

    // Email linking state
    const [linkEmail, setLinkEmail] = useState('');
    const [emailValidating, setEmailValidating] = useState(false);
    const [emailValidated, setEmailValidated] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [isChangingEmail, setIsChangingEmail] = useState(false);

    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!user) return null;

    const copyRecoveryCode = (e) => {
        e.stopPropagation();
        if (user?.recoveryCode) {
            navigator.clipboard.writeText(user.recoveryCode);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLinkEmail = async () => {
        if (!linkEmail.trim() || !linkEmail.includes('@')) return;
        setEmailValidating(true);
        setEmailError('');

        const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

        try {
            const res = await fetch(`${API_URL}/api/auth/init-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: linkEmail.trim() })
            });
            const data = await res.json();

            if (data.success) {
                const pollInterval = setInterval(async () => {
                    const checkRes = await fetch(`${API_URL}/api/auth/check-verification/${data.token}`);
                    const checkData = await checkRes.json();
                    if (checkData.verified) {
                        clearInterval(pollInterval);
                        setEmailValidated(true);
                        setEmailValidating(false);
                        if (user && onUpdateUser) {
                            await onUpdateUser(user.id, { email: linkEmail.trim() });
                            setIsChangingEmail(false);
                        }
                    }
                }, 2000);

                setTimeout(() => {
                    clearInterval(pollInterval);
                    if (!emailValidated) {
                        setEmailValidating(false);
                        setEmailError('Timeout');
                    }
                }, 120000); // 2 minutes timeout
            } else {
                setEmailError(data.error);
                setEmailValidating(false);
            }
        } catch (err) {
            setEmailError('Error');
            setEmailValidating(false);
        }
    };

    return (
        <div className="user-menu" ref={menuRef}>
            <div
                className="user-pill glass"
                onClick={() => setIsOpen(!isOpen)}
                title={user.email || user.name}
            >
                <span className="user-icon">👤</span>
                <span className="user-name">{user.name}</span>
                <span className="user-menu-arrow">▼</span>
            </div>

            {isOpen && (
                <div className="user-dropdown glass animate-fade-in">
                    <div className="menu-header">
                        <h3>{user.name}</h3>
                        <p className="menu-email">{user.email || t('dashboard.noEmail') || 'Sin email'}</p>
                    </div>

                    <div className="menu-section">
                        <h4>{t('dashboard.recoveryCode') || 'Código de recuperación'}</h4>
                        {showRecoveryCode ? (
                            <div className="recovery-display">
                                <span className="code-text">{user.recoveryCode}</span>
                                <button className="icon-btn" onClick={copyRecoveryCode} title="Copiar">
                                    {copied ? '✅' : '📋'}
                                </button>
                                <button className="icon-btn text-muted" onClick={(e) => { e.stopPropagation(); setShowRecoveryCode(false); }}>
                                    👁️
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn-text"
                                onClick={(e) => { e.stopPropagation(); setShowRecoveryCode(true); }}
                            >
                                👁️ {t('dashboard.showCode') || 'Mostrar código'}
                            </button>
                        )}
                    </div>

                    {profilesEnabled && (
                        <div className="menu-section">
                            <h4>Email</h4>
                            {user.email && !isChangingEmail ? (
                                <div className="email-display">
                                    <span className="verified-badge">✓ Validado</span>
                                    <button
                                        className="btn-link-sm"
                                        onClick={() => setIsChangingEmail(true)}
                                    >
                                        {t('dashboard.changeEmail') || 'Cambiar'}
                                    </button>
                                </div>
                            ) : (
                                <div className="email-link-form">
                                    <div className="input-group">
                                        <input
                                            type="email"
                                            placeholder={t('dashboard.linkEmail') || "Email..."}
                                            value={linkEmail}
                                            onChange={(e) => setLinkEmail(e.target.value)}
                                            disabled={emailValidating}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleLinkEmail(); }}
                                            disabled={emailValidating || !linkEmail.trim()}
                                            className="btn-primary-sm"
                                        >
                                            {emailValidating ? '...' : '🔗'}
                                        </button>
                                    </div>
                                    {emailError && <div className="error-text">{emailError}</div>}
                                    {isChangingEmail && (
                                        <button className="btn-cancel" onClick={() => setIsChangingEmail(false)}>
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="menu-footer">
                        <button className="btn-logout-full" onClick={onLogout}>
                            🚪 {t('dashboard.logout') || 'Cerrar Sesión'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
