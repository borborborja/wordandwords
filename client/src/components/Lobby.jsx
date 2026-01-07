import { useState } from 'react';
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
    gameName = 'WordAndWords'
}) {
    const [mode, setMode] = useState(initialGameCode ? 'join' : null); // null, 'create', 'join'
    const [gameLanguage, setGameLanguage] = useState('es');
    const [strictMode, setStrictMode] = useState(false);
    const [timeLimit, setTimeLimit] = useState(null);
    const [enableChat, setEnableChat] = useState(true);
    const [enableHistory, setEnableHistory] = useState(true);
    const [gameCode, setGameCode] = useState(initialGameCode || '');
    const [localName, setLocalName] = useState(playerName);

    const handleCreate = () => {
        if (!localName.trim()) {
            return;
        }
        onCreateGame(gameLanguage, localName.trim(), {
            strictMode,
            timeLimit,
            enableChat,
            enableHistory
        });
    };

    const handleJoin = () => {
        if (!localName.trim() || !gameCode.trim()) return;
        onNameChange(localName.trim());
        onJoinGame(gameCode.trim().toUpperCase(), localName.trim());
    };

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
                            <p>Start a new game and invite friends</p>
                        </div>

                        <div className="lobby-card glass" onClick={() => setMode('join')}>
                            <div className="card-icon">🔗</div>
                            <h3>{t('lobby.joinGame')}</h3>
                            <p>Join an existing game with a code</p>
                        </div>
                    </div>
                )}

                {mode && (
                    <div className="lobby-form glass animate-fade-in">
                        <button className="back-btn" onClick={() => setMode(null)}>
                            ← Back
                        </button>

                        <h2>{mode === 'create' ? t('lobby.createGame') : t('lobby.joinGame')}</h2>

                        <div className="form-group">
                            <label className="label">{t('lobby.enterName')}</label>
                            <input
                                type="text"
                                className="input"
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                placeholder="Player name..."
                                maxLength={20}
                            />
                        </div>

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

                        <button
                            className="btn btn-primary w-full"
                            onClick={mode === 'create' ? handleCreate : handleJoin}
                            disabled={loading || !localName.trim() || (mode === 'join' && !gameCode.trim())}
                        >
                            {loading ? 'Loading...' : mode === 'create' ? t('lobby.createGame') : t('lobby.joinGame')}
                        </button>
                    </div>
                )}
            </div>

            {/* Decorative elements */}
            <div className="lobby-decoration">
                <div className="float-tile tile-1">W</div>
                <div className="float-tile tile-2">O</div>
                <div className="float-tile tile-3">R</div>
                <div className="float-tile tile-4">D</div>
            </div>
        </div>
    );
}
