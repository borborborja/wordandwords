import { useState, useEffect, useRef } from 'react';
import './Admin.css';

const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function Admin({ onClose, t }) {
    const [password, setPassword] = useState('');
    const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const [stats, setStats] = useState(null);
    const [selectedLang, setSelectedLang] = useState('es');
    const [dictionary, setDictionary] = useState([]);
    const [newWords, setNewWords] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [games, setGames] = useState([]);
    const [activeTab, setActiveTab] = useState('stats'); // stats, games, dictionary

    const fileInputRef = useRef(null);

    // Check if already logged in
    useEffect(() => {
        if (token) {
            verifyToken();
        }
    }, [token]);

    const verifyToken = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setIsLoggedIn(true);
                const data = await res.json();
                setStats(data);
            } else {
                setToken('');
                localStorage.removeItem('adminToken');
            }
        } catch (err) {
            setError('Connection error');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (data.success) {
                setToken(data.token);
                localStorage.setItem('adminToken', data.token);
                setIsLoggedIn(true);
                loadStats();
            } else {
                setError(data.error || 'Invalid password');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setStats(await res.json());
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    };

    const loadDictionary = async (lang) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/admin/dictionary/${lang}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDictionary(data.words);
                setSelectedLang(lang);
            }
        } catch (err) {
            setError('Failed to load dictionary');
        } finally {
            setLoading(false);
        }
    };

    const handleAddWords = async () => {
        if (!newWords.trim()) return;

        setLoading(true);
        setError('');
        try {
            const words = newWords.split(/[\n,]/).map(w => w.trim()).filter(w => w);

            const res = await fetch(`${API_URL}/api/admin/dictionary/${selectedLang}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ words })
            });

            const data = await res.json();

            if (data.success) {
                setNewWords('');
                loadDictionary(selectedLang);
                loadStats();
                setSuccessMsg(`Added ${data.added} new words!`);
                setTimeout(() => setSuccessMsg(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to add words');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');
        setSuccessMsg(`Reading file... (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

        try {
            // Read file
            const text = await file.text();
            setSuccessMsg('Processing words...');

            // Process words - filter empty lines, duplicates, and invalid lengths
            const wordSet = new Set();
            const lines = text.split(/[\n\r]+/);

            for (const line of lines) {
                const word = line.trim().toUpperCase();
                // Only accept words between 2-15 characters (Scrabble standard)
                if (word && word.length >= 2 && word.length <= 15) {
                    wordSet.add(word);
                }
            }

            const words = Array.from(wordSet);

            if (words.length === 0) {
                setError('No valid words found in file');
                setSuccessMsg('');
                setLoading(false);
                return;
            }

            setSuccessMsg(`Uploading ${words.length.toLocaleString()} words...`);

            // Replace entire dictionary with file contents
            const res = await fetch(`${API_URL}/api/admin/dictionary/${selectedLang}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ words })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `HTTP ${res.status}`);
            }

            const data = await res.json();

            if (data.success) {
                loadDictionary(selectedLang);
                loadStats();
                setSuccessMsg(`✅ Dictionary updated: ${data.wordCount.toLocaleString()} words!`);
                setTimeout(() => setSuccessMsg(''), 5000);
            } else {
                setError(data.error || 'Unknown error');
                setSuccessMsg('');
            }
        } catch (err) {
            console.error('File upload error:', err);
            setError(`Failed: ${err.message}`);
            setSuccessMsg('');
        } finally {
            setLoading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleLogout = () => {
        setToken('');
        setIsLoggedIn(false);
        localStorage.removeItem('adminToken');
    };

    const loadGames = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/games`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setGames(data.games);
            }
        } catch (err) {
            console.error('Failed to load games:', err);
        }
    };

    const handleDeleteGame = async (gameId) => {
        if (!confirm(`Delete game ${gameId}?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/games/${gameId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setGames(prev => prev.filter(g => g.id !== gameId));
                loadStats();
                setSuccessMsg('Game deleted');
                setTimeout(() => setSuccessMsg(''), 2000);
            }
        } catch (err) {
            setError('Failed to delete game');
        }
    };

    const handleCleanupGhosts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/cleanup-ghosts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ maxInactiveMinutes: 30 })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(`Cleaned up ${data.cleaned} ghost games`);
                setTimeout(() => setSuccessMsg(''), 3000);
                loadGames();
                loadStats();
            }
        } catch (err) {
            setError('Failed to cleanup');
        }
    };

    const filteredWords = dictionary.filter(w =>
        w.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isLoggedIn) {
        return (
            <div className="admin-overlay">
                <div className="admin-panel glass animate-fade-in">
                    <button className="close-btn" onClick={onClose}>✕</button>

                    <h2>🔐 Admin Access</h2>

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="form-group">
                            <label>Admin Password</label>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password..."
                                autoFocus
                            />
                        </div>

                        {error && <div className="error-msg">{error}</div>}

                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? 'Verifying...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-overlay">
            <div className="admin-panel admin-panel-large glass animate-fade-in">
                <div className="admin-header">
                    <h2>⚙️ Admin Panel</h2>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
                        <button className="close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Stats Section */}
                {stats && (
                    <div className="stats-section">
                        <h3>📊 Statistics</h3>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <span className="stat-value">{stats.totalGames}</span>
                                <span className="stat-label">Total Games</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{stats.playingGames}</span>
                                <span className="stat-label">Active Games</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{stats.connectedPlayers}</span>
                                <span className="stat-label">Connected Players</span>
                            </div>
                            <div className={`stat-card ${stats.ghostGames > 0 ? 'stat-warning' : ''}`}>
                                <span className="stat-value">{stats.ghostGames || 0}</span>
                                <span className="stat-label">Ghost Games</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Management Section */}
                <div className="games-section">
                    <div className="section-header">
                        <h3>🎮 Game Management</h3>
                        <div className="section-actions">
                            <button className="btn btn-secondary btn-sm" onClick={loadGames}>
                                🔄 Refresh
                            </button>
                            {stats?.ghostGames > 0 && (
                                <button className="btn btn-danger btn-sm" onClick={handleCleanupGhosts}>
                                    🗑️ Cleanup {stats.ghostGames} ghosts
                                </button>
                            )}
                        </div>
                    </div>

                    {games.length === 0 ? (
                        <p className="placeholder-text">Click "Refresh" to load games</p>
                    ) : (
                        <div className="games-list">
                            {games.map(game => (
                                <div key={game.id} className={`game-item ${game.isGhost ? 'ghost' : ''}`}>
                                    <div className="game-info">
                                        <span className="game-id">{game.id}</span>
                                        <span className={`game-status status-${game.status}`}>
                                            {game.status}
                                        </span>
                                        <span className="game-lang">{game.language.toUpperCase()}</span>
                                    </div>
                                    <div className="game-players">
                                        {game.players.map(p => (
                                            <span
                                                key={p.id}
                                                className={`player-badge ${p.connected ? 'online' : 'offline'}`}
                                            >
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="game-meta">
                                        <span className="inactive-time">
                                            {game.inactiveMinutes === 0 ? 'Active now' : `${game.inactiveMinutes}m ago`}
                                        </span>
                                        {game.isGhost && <span className="ghost-badge">👻 Ghost</span>}
                                    </div>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleDeleteGame(game.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Dictionary Section */}
                <div className="dictionary-section">
                    <h3>📚 Dictionary Management</h3>

                    <div className="lang-tabs">
                        {[
                            { code: 'ca', name: 'Català', count: stats?.dictionaries?.ca },
                            { code: 'en', name: 'English', count: stats?.dictionaries?.en },
                            { code: 'es', name: 'Español', count: stats?.dictionaries?.es }
                        ].map(lang => (
                            <button
                                key={lang.code}
                                className={`lang-tab ${selectedLang === lang.code ? 'active' : ''}`}
                                onClick={() => loadDictionary(lang.code)}
                            >
                                {lang.name}
                                <span className="word-count">{lang.count?.toLocaleString() || 0}</span>
                            </button>
                        ))}
                    </div>

                    <div className="dictionary-content">
                        <div className="add-words-section">
                            <h4>📄 Upload Dictionary File</h4>
                            <p className="help-text">
                                Upload a .txt file with one word per line to replace the entire dictionary
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                onChange={handleFileUpload}
                                className="file-input"
                                id="dict-file-input"
                            />
                            <label htmlFor="dict-file-input" className="file-input-label btn btn-secondary">
                                {loading ? 'Uploading...' : '📁 Choose .txt File'}
                            </label>

                            <div className="divider">
                                <span>or</span>
                            </div>

                            <h4>✏️ Add Words Manually</h4>
                            <textarea
                                className="input words-input"
                                value={newWords}
                                onChange={(e) => setNewWords(e.target.value)}
                                placeholder="Enter words (one per line or comma-separated)..."
                                rows={4}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleAddWords}
                                disabled={loading || !newWords.trim()}
                            >
                                {loading ? 'Adding...' : 'Add Words'}
                            </button>
                        </div>

                        <div className="word-list-section">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Search words..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <span className="results-count">{filteredWords.length.toLocaleString()} words</span>
                            </div>

                            <div className="word-list">
                                {dictionary.length === 0 ? (
                                    <p className="placeholder-text">
                                        Select a language to view its dictionary
                                    </p>
                                ) : (
                                    filteredWords.slice(0, 500).map((word, idx) => (
                                        <span key={idx} className="word-tag">{word}</span>
                                    ))
                                )}
                                {filteredWords.length > 500 && (
                                    <p className="more-words">...and {(filteredWords.length - 500).toLocaleString()} more</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {successMsg && <div className="success-msg">{successMsg}</div>}
                {error && <div className="error-msg">{error}</div>}
            </div>
        </div>
    );
}
