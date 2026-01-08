import { useState, useEffect, useRef } from 'react';
import BoardCell from './BoardCell'; // For game preview
import Board from './Board'; // For beautiful board rendering
import GameHistory from './GameHistory';
import './Admin.css';

const API_URL = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function Admin({ onClose, t }) {
    const [password, setPassword] = useState('');
    const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Active Tab: 'stats', 'games', 'config'
    const [activeTab, setActiveTab] = useState('stats');

    // Sub-states
    const [stats, setStats] = useState(null);
    const [games, setGames] = useState([]);
    const [users, setUsers] = useState([]);
    const [config, setConfig] = useState({ gameName: '', serverUrl: '' });

    // View Game Modal State
    const [viewingGame, setViewingGame] = useState(null);

    // Check if already logged in
    useEffect(() => {
        if (token) verifyToken();
    }, [token]);

    const verifyToken = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setIsLoggedIn(true);
                loadAllData();
            } else {
                setToken('');
                localStorage.removeItem('adminToken');
            }
        } catch (err) {
            console.error('Verify error', err);
        }
    };

    const loadAllData = async () => {
        loadStats();
        loadGames();
        loadUsers();
        loadConfig();
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
                // Trigger effects will load data
                setTimeout(loadAllData, 100);
            } else {
                setError(data.error || 'Invalid password');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken('');
        setIsLoggedIn(false);
        localStorage.removeItem('adminToken');
    };

    const loadStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setStats(await res.json());
        } catch (e) { }
    };


    const loadUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setUsers(await res.json());
        } catch (e) { }
    };

    const loadGames = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/games`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setGames(data.games);
            }
        } catch (e) { }
    };

    const loadConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/config`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setConfig(await res.json());
        } catch (e) { }
    };

    // --- RENDERERS ---

    if (!isLoggedIn) {
        return (
            <div className="admin-overlay">
                <div className="admin-panel glass animate-fade-in login-panel">
                    <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>🔐 Admin Access</h2>
                        <button className="icon-close-btn" onClick={onClose}>✕</button>
                    </div>
                    <form onSubmit={handleLogin} className="login-form">
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Entra contraseña..."
                            autoFocus
                        />
                        {error && <div className="error-msg">{error}</div>}
                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? 'Verifying...' : 'Entrar'}
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
                    <div className="admin-tabs">
                        <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                            📊 Estadísticas
                        </button>
                        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                            👥 Usuarios
                        </button>
                        <button className={`tab-btn ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>
                            🎮 Gestión Partidas
                        </button>
                        <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
                            🛠️ Configuración
                        </button>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
                        <button className="icon-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="admin-content">
                    {activeTab === 'stats' && <StatsTab stats={stats} refresh={loadStats} />}
                    {activeTab === 'users' && <UsersTab users={users} refresh={loadUsers} token={token} />}
                    {activeTab === 'games' && <GamesTab games={games} refresh={loadGames} token={token} setViewingGame={setViewingGame} config={config} />}
                    {activeTab === 'config' && <ConfigTab config={config} setConfig={setConfig} token={token} />}
                </div>

                {viewingGame && (
                    <GamePreviewModal
                        gameId={viewingGame}
                        token={token}
                        onClose={() => setViewingGame(null)}
                    />
                )}
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function StatsTab({ stats, refresh }) {
    if (!stats) return <div className="loading">Cargando estadísticas...</div>;
    return (
        <div className="stats-tab">
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.totalGames}</span>
                    <span className="stat-label">Total Partidas</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.playingGames}</span>
                    <span className="stat-label">Jugando</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.connectedPlayers}</span>
                    <span className="stat-label">Jugadores Online</span>
                </div>
                <div className={`stat-card ${stats.ghostGames > 0 ? 'stat-warning' : ''}`}>
                    <span className="stat-value">{stats.ghostGames}</span>
                    <span className="stat-label">Partidas 'Fantasma'</span>
                </div>
            </div>

            <div className="stats-dictionaries">
                <h4>Diccionarios Cargados</h4>
                <div className="dict-stats">
                    <span>🇪🇸 {stats.dictionaries.es.toLocaleString()}</span>
                    <span>🇬🇧 {stats.dictionaries.en.toLocaleString()}</span>
                    <span>🏴 {stats.dictionaries.ca.toLocaleString()}</span>
                </div>
            </div>

            <button className="btn btn-secondary mt-4" onClick={refresh}>🔄 Actualizar Datos</button>
        </div>
    );
}

function GamesTab({ games, refresh, token, setViewingGame, config }) {
    const [archivedGames, setArchivedGames] = useState([]);
    const [showArchived, setShowArchived] = useState(false);
    const [editingTitle, setEditingTitle] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [selectedGames, setSelectedGames] = useState(new Set());
    const fileInputRef = useRef(null);

    // --- EXPORT / IMPORT LOGIC ---
    const handleExport = async (gameId) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/games/${gameId}/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Export failed');

            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game_backup_${gameId}_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(`Error exportando partida: ${error.message}`);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const gameData = JSON.parse(event.target.result);
                if (!gameData.id) throw new Error('Invalid backup file');

                // Check if game exists
                const existing = games.find(g => g.id === gameData.id) || archivedGames.find(g => g.id === gameData.id);

                if (existing) {
                    if (!confirm(`⚠ ¡ADVERTENCIA!\n\nLa partida con ID "${gameData.id}" YA EXISTE.\n\nSi importas este backup:\n1. Se SOBREESCRIBIRÁ el estado actual.\n2. Los jugadores podrían perder progresos recientes.\n3. Esta acción NO se puede deshacer.\n\n¿Estás seguro de continuar?`)) {
                        return;
                    }
                }

                const res = await fetch(`${API_URL}/api/admin/games/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(gameData)
                });

                if (res.ok) {
                    alert('✅ Partida restaurada correctamente.');
                    refresh();
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'Server error');
                }
            } catch (error) {
                alert(`Error importando backup: ${error.message}`);
            } finally {
                e.target.value = null; // Reset input
            }
        };
        reader.readAsText(file);
    };

    const loadArchivedGames = async () => {
        const res = await fetch(`${API_URL}/api/admin/archived-games`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            setArchivedGames(data.games || []);
        }
    };

    useEffect(() => {
        if (showArchived) {
            loadArchivedGames();
        }
    }, [showArchived]);

    // Clear selection when games list changes
    useEffect(() => {
        setSelectedGames(new Set());
    }, [games]);

    const handleCleanup = async () => {
        const ghostCount = games.filter(g => g.isGhost).length;
        if (!confirm(`¿Eliminar ${ghostCount} partidas inactivas sin jugadores conectados?`)) return;
        await fetch(`${API_URL}/api/admin/cleanup-ghosts`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        refresh();
    };

    const handleDelete = async (id) => {
        if (!confirm(`¿Borrar partida ${id}?`)) return;
        await fetch(`${API_URL}/api/admin/games/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        refresh();
    };

    const handleDeleteSelected = async () => {
        if (selectedGames.size === 0) return;
        if (!confirm(`¿Borrar ${selectedGames.size} partidas seleccionadas?`)) return;

        const idsToDelete = Array.from(selectedGames);

        await Promise.all(idsToDelete.map(id =>
            fetch(`${API_URL}/api/admin/games/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
        ));

        setSelectedGames(new Set());
        refresh();
    };

    const toggleSelectGame = (id) => {
        setSelectedGames(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedGames.size === games.length) {
            setSelectedGames(new Set());
        } else {
            setSelectedGames(new Set(games.map(g => g.id)));
        }
    };

    const handleArchive = async (id) => {
        const title = prompt('Título para la partida archivada:', `Partida del ${new Date().toLocaleDateString()}`);
        if (title === null) return;

        await fetch(`${API_URL}/api/admin/games/${id}/archive`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        refresh();
        loadArchivedGames();
    };

    const handleDeleteArchived = async (id) => {
        if (!confirm('¿Eliminar partida archivada permanentemente?')) return;
        await fetch(`${API_URL}/api/admin/archived-games/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        loadArchivedGames();
    };

    const handleUpdateTitle = async (id) => {
        await fetch(`${API_URL}/api/admin/archived-games/${id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        setEditingTitle(null);
        loadArchivedGames();
    };

    const handleCopyReplayLink = (gameId) => {
        const baseUrl = config.serverUrl || window.location.origin;
        const url = `${baseUrl}/replay/${gameId}`;
        copyToClipboard(url, 'Enlace de reproducción copiado!');
    };

    const handleCopyLink = (gameId, playerId) => {
        const baseUrl = config.serverUrl || window.location.origin;
        const url = `${baseUrl}/?game_id=${gameId}&recover_uid=${playerId}`;
        copyToClipboard(url, 'Enlace de recuperación copiado!');
    };

    const copyToClipboard = (text, successMsg) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                alert(successMsg);
            }).catch(() => fallbackCopy(text, successMsg));
        } else {
            fallbackCopy(text, successMsg);
        }

        function fallbackCopy(text, msg) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                alert(msg);
            } catch (err) {
                prompt('Copia manualmente:', text);
            }
            document.body.removeChild(textArea);
        }
    };

    return (
        <div className="games-tab">
            <div className="tab-actions">
                <button className="btn btn-primary btn-sm" onClick={refresh}>🔄 Refrescar</button>
                {games.some(g => g.isGhost) && (
                    <button className="btn btn-warning btn-sm" onClick={handleCleanup} title="Eliminar partidas sin jugadores conectados">
                        👻 Eliminar inactivas ({games.filter(g => g.isGhost).length})
                    </button>
                )}
            </div>

            <div className="tab-header">
                <h3>🎮 Partidas Activas ({games.length})</h3>
                <div className="tab-actions-right">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImportFile}
                    />
                    <button className="btn btn-outline btn-sm" onClick={handleImportClick}>
                        📥 Importar Backup
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={selectedGames.size === 0}>
                        🗑️ Borrar ({selectedGames.size})
                    </button>
                </div>
            </div>

            <div className="games-list-container">
                <table className="games-table">
                    <thead>
                        <tr>
                            <th className="th-checkbox">
                                <input
                                    type="checkbox"
                                    checked={games.length > 0 && selectedGames.size === games.length}
                                    onChange={toggleSelectAll}
                                    title="Seleccionar todas"
                                />
                            </th>
                            <th>ID</th>
                            <th>Estado</th>
                            <th>Jugadores (Online)</th>
                            <th>Inactivo</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {games.map(g => (
                            <tr key={g.id} className={`${g.isGhost ? 'row-ghost' : ''} ${selectedGames.has(g.id) ? 'row-selected' : ''}`}>
                                <td className="td-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedGames.has(g.id)}
                                        onChange={() => toggleSelectGame(g.id)}
                                    />
                                </td>
                                <td>
                                    <span className="mono-badge">{g.id}</span>
                                    {g.isGhost && <span className="ghost-tag">👻</span>}
                                </td>
                                <td><span className={`status-badge status-${g.status}`}>{g.status}</span></td>
                                <td>
                                    <div className="player-chips">
                                        {g.players.map(p => (
                                            <div key={p.id} className={`chip ${p.connected ? 'online' : 'offline'}`}
                                                title={p.connected ? 'Online' : 'Offline'}
                                                onClick={() => handleCopyLink(g.id, p.id)}>
                                                {p.name}
                                                <span className="link-icon">🔗</span>
                                            </div>
                                        ))}
                                        {/* Host Link Button for Waiting Games */}
                                        {g.status === 'waiting' && g.players.length > 0 && (
                                            <button
                                                className="chip btn-host-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyLink(g.id, g.players[0].id);
                                                }}
                                                title="Copiar Enlace de Host (Admin)"
                                            >
                                                🔑 Host Link
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td>{g.inactiveMinutes} min</td>
                                <td>
                                    <div className="row-actions">
                                        <button className="btn-icon" title="Ver" onClick={() => setViewingGame(g.id)}>👁️</button>
                                        <button className="btn-icon" title="Exportar Backup" onClick={() => handleExport(g.id)}>💾</button>
                                        {g.status === 'finished' && (
                                            <button className="btn-icon" title="Archivar" onClick={() => handleArchive(g.id)}>📦</button>
                                        )}
                                        <button className="btn-icon btn-delete" title="Borrar" onClick={() => handleDelete(g.id)}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {games.length === 0 && <p className="empty-msg">No hay partidas activas.</p>}
            </div>

            {/* Archived Games Section */}
            <div className="archived-section">
                <button
                    className="section-toggle"
                    onClick={() => setShowArchived(!showArchived)}
                >
                    📦 Partidas Archivadas ({archivedGames.length})
                    <span className="toggle-icon">{showArchived ? '▼' : '▶'}</span>
                </button>

                {showArchived && (
                    <div className="archived-list">
                        {archivedGames.length === 0 ? (
                            <p className="empty-msg">No hay partidas archivadas.</p>
                        ) : (
                            <table className="games-table archived-table">
                                <thead>
                                    <tr>
                                        <th>Título</th>
                                        <th>Jugadores</th>
                                        <th>Idioma</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {archivedGames.map(g => (
                                        <tr key={g.id}>
                                            <td>
                                                {editingTitle === g.id ? (
                                                    <div className="inline-edit">
                                                        <input
                                                            value={newTitle}
                                                            onChange={e => setNewTitle(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleUpdateTitle(g.id)}
                                                            autoFocus
                                                        />
                                                        <button className="btn-icon" onClick={() => handleUpdateTitle(g.id)}>✓</button>
                                                        <button className="btn-icon" onClick={() => setEditingTitle(null)}>✕</button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className="editable-title"
                                                        onClick={() => { setEditingTitle(g.id); setNewTitle(g.title || ''); }}
                                                        title="Click to edit"
                                                    >
                                                        {g.title || `Game ${g.id.substring(0, 8)}`}
                                                        <span className="edit-hint">✏️</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {g.players.map(p => p.name).join(' vs ')}
                                            </td>
                                            <td>{g.language?.toUpperCase()}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="btn-icon" title="Ver" onClick={() => setViewingGame(g.id)}>👁️</button>
                                                    <button className="btn-icon" title="Exportar Backup" onClick={() => handleExport(g.id)}>💾</button>
                                                    <button className="btn-icon" title="Enlace Replay" onClick={() => handleCopyReplayLink(g.id)}>🔗</button>
                                                    <button className="btn-icon btn-delete" title="Eliminar" onClick={() => handleDeleteArchived(g.id)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}



function UsersTab({ users, refresh, token }) {
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '' });
    const [sendingLink, setSendingLink] = useState(null);

    const handleEdit = (user) => {
        setEditingUser(user.id);
        setEditForm({ name: user.name, email: user.email || '' });
    };

    const handleSave = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                setEditingUser(null);
                refresh();
            } else {
                alert('Error al guardar');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendLink = async (email) => {
        if (!email) return alert('El usuario no tiene email');
        if (!confirm(`¿Enviar enlace de acceso a ${email}?`)) return;

        setSendingLink(email);
        try {
            const res = await fetch(`${API_URL}/api/user/send-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                alert('Enlace enviado correctamente');
            } else {
                alert(data.error || 'Error al enviar');
            }
        } catch (err) {
            alert('Error de conexión');
        } finally {
            setSendingLink(null);
        }
    };

    return (
        <div className="users-tab">
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Partidas</th>
                            <th>Última Actividad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>
                                    {editingUser === user.id ? (
                                        <input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="form-input"
                                        />
                                    ) : (
                                        user.name
                                    )}
                                </td>
                                <td>
                                    {editingUser === user.id ? (
                                        <input
                                            value={editForm.email}
                                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            className="form-input"
                                        />
                                    ) : (
                                        <span className={!user.email ? 'text-muted' : ''}>
                                            {user.email || 'Sin email'}
                                        </span>
                                    )}
                                </td>
                                <td>{user.gamesCount}</td>
                                <td>{new Date(user.lastSeen).toLocaleDateString()}</td>
                                <td>
                                    {editingUser === user.id ? (
                                        <div className="action-buttons">
                                            <button className="btn btn-sm btn-primary" onClick={() => handleSave(user.id)}>💾</button>
                                            <button className="btn btn-sm" onClick={() => setEditingUser(null)}>❌</button>
                                        </div>
                                    ) : (
                                        <div className="action-buttons">
                                            <button className="btn btn-sm" onClick={() => handleEdit(user)} title="Editar">✏️</button>
                                            {user.email && (
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleSendLink(user.email)}
                                                    disabled={sendingLink === user.email}
                                                    title="Enviar enlace login"
                                                >
                                                    {sendingLink === user.email ? '...' : '📧'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ConfigTab({ config, setConfig, token }) {
    // Dictionary State
    const [selectedLang, setSelectedLang] = useState('es');
    const [dictionary, setDictionary] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [newWords, setNewWords] = useState('');
    const [loadingDict, setLoadingDict] = useState(false);
    const [addingWords, setAddingWords] = useState(false);

    // Server Config State
    const [serverName, setServerName] = useState(config.gameName);
    const [serverUrl, setServerUrl] = useState(config.serverUrl);
    const [enableProfiles, setEnableProfiles] = useState(config.enableProfiles !== false);
    const [savingConfig, setSavingConfig] = useState(false);

    // SMTP Config State
    const smtpEnv = config.smtpEnv;
    const [smtpHost, setSmtpHost] = useState(config.smtp?.host || '');
    const [smtpPort, setSmtpPort] = useState(config.smtp?.port || '587');
    const [smtpUser, setSmtpUser] = useState(config.smtp?.user || '');
    const [smtpPass, setSmtpPass] = useState(config.smtp?.pass || '');
    const [smtpFrom, setSmtpFrom] = useState(config.smtp?.from || '');

    // SMTP Test State
    const [testEmail, setTestEmail] = useState('');
    const [testingSmtp, setTestingSmtp] = useState(false);
    const [smtpTestResult, setSmtpTestResult] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadDictionary(selectedLang);
    }, [selectedLang]);

    const handleTestSmtp = async () => {
        setTestingSmtp(true);
        setSmtpTestResult(null);
        try {
            const res = await fetch(`${API_URL}/api/admin/smtp/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ to: testEmail })
            });
            const data = await res.json();
            setSmtpTestResult({
                success: data.success,
                message: data.success ? 'Email enviado correctamente' : (data.error || 'Error al enviar')
            });
        } catch (err) {
            setSmtpTestResult({ success: false, message: 'Error de conexión' });
        } finally {
            setTestingSmtp(false);
        }
    };

    const loadDictionary = async (lang) => {
        setLoadingDict(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/dictionary/${lang}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDictionary(data.words || []);
            }
        } finally {
            setLoadingDict(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    gameName: serverName,
                    serverUrl,
                    enableProfiles,
                    smtp: smtpEnv?.isEnvConfigured ? undefined : {
                        host: smtpHost,
                        port: smtpPort,
                        user: smtpUser,
                        pass: smtpPass,
                        from: smtpFrom
                    }
                })
            });
            if (res.ok) {
                alert('Configuración guardada!');
            }
        } finally {
            setSavingConfig(false);
        }
    };

    const handleAddWords = async () => {
        if (!newWords.trim()) return;

        setAddingWords(true);
        try {
            const wordsArray = newWords.split(/[\n,]+/).map(w => w.trim().toUpperCase()).filter(w => w);
            const res = await fetch(`${API_URL}/api/admin/dictionary/${selectedLang}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ words: wordsArray })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Añadidas ${data.added} palabras nuevas. Total: ${data.total}`);
                setNewWords('');
                loadDictionary(selectedLang);
            } else {
                alert('Error al añadir palabras');
            }
        } finally {
            setAddingWords(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoadingDict(true);
        try {
            const text = await file.text();
            const words = text.split(/[\n\r]+/).map(w => w.trim().toUpperCase()).filter(w => w);

            const res = await fetch(`${API_URL}/api/admin/dictionary/${selectedLang}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ words })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Diccionario ${selectedLang.toUpperCase()} reemplazado con ${data.wordCount} palabras.`);
                loadDictionary(selectedLang);
            } else {
                alert('Error al cargar archivo');
            }
        } catch (err) {
            alert('Error al procesar archivo: ' + err.message);
        } finally {
            setLoadingDict(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredWords = dictionary.filter(w => w.includes(searchTerm.toUpperCase()));

    return (
        <div className="config-tab">
            <div className="config-section">
                <h3>⚙️ Configuración Servidor</h3>
                <div className="form-row">
                    <label>Título del Servidor:</label>
                    <input value={serverName} onChange={e => setServerName(e.target.value)} className="input" />
                </div>
                <div className="form-row">
                    <label>URL Pública (para enlaces):</label>
                    {config.serverUrlEnv?.isSet && (
                        <div className="env-notice mb-1">
                            ✅ URL configurada via variable de entorno (solo lectura)
                        </div>
                    )}
                    <input
                        value={config.serverUrlEnv?.isSet ? config.serverUrlEnv.url : serverUrl}
                        onChange={e => setServerUrl(e.target.value)}
                        className="input"
                        placeholder="https://mi-juego.com"
                        disabled={config.serverUrlEnv?.isSet}
                    />
                </div>
                <button className="btn btn-primary mt-2" onClick={handleSaveConfig} disabled={savingConfig}>
                    {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                </button>

                <div className="form-row mt-3">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={enableProfiles}
                            onChange={(e) => setEnableProfiles(e.target.checked)}
                        />
                        Perfiles Persistentes (permite recuperar sesión desde otro dispositivo)
                    </label>
                </div>
            </div>

            <div className="config-section">
                <h3>📧 Configuración SMTP (Email)</h3>
                {smtpEnv?.isEnvConfigured && (
                    <div className="env-notice">
                        ✅ SMTP configurado via variables de entorno (solo lectura)
                    </div>
                )}
                {!smtpEnv?.isEnvConfigured && !smtpHost && (
                    <div className="info-notice">
                        ℹ️ SMTP no configurado - la recuperación por email no estará disponible
                    </div>
                )}
                <div className="form-row">
                    <label>Host SMTP:</label>
                    <input
                        value={smtpEnv?.isEnvConfigured ? smtpEnv.host : smtpHost}
                        onChange={e => setSmtpHost(e.target.value)}
                        className="input"
                        placeholder="smtp.gmail.com"
                        disabled={smtpEnv?.isEnvConfigured}
                    />
                </div>
                <div className="form-row">
                    <label>Puerto:</label>
                    <input
                        value={smtpEnv?.isEnvConfigured ? smtpEnv.port : smtpPort}
                        onChange={e => setSmtpPort(e.target.value)}
                        className="input"
                        placeholder="587"
                        disabled={smtpEnv?.isEnvConfigured}
                    />
                </div>
                <div className="form-row">
                    <label>Usuario:</label>
                    <input
                        value={smtpEnv?.isEnvConfigured ? smtpEnv.user : smtpUser}
                        onChange={e => setSmtpUser(e.target.value)}
                        className="input"
                        placeholder="tu@email.com"
                        disabled={smtpEnv?.isEnvConfigured}
                    />
                </div>
                <div className="form-row">
                    <label>Contraseña:</label>
                    <input
                        type="password"
                        value={smtpEnv?.isEnvConfigured ? smtpEnv.pass : smtpPass}
                        onChange={e => setSmtpPass(e.target.value)}
                        className="input"
                        placeholder="••••••••"
                        disabled={smtpEnv?.isEnvConfigured}
                    />
                </div>
                <div className="form-row">
                    <label>Email Remitente:</label>
                    <input
                        value={smtpEnv?.isEnvConfigured ? smtpEnv.from : smtpFrom}
                        onChange={e => setSmtpFrom(e.target.value)}
                        className="input"
                        placeholder="noreply@midominio.com"
                        disabled={smtpEnv?.isEnvConfigured}
                    />
                </div>

                <div className="smtp-test-section">
                    <h4>🧪 Probar Configuración</h4>
                    <div className="form-row inline">
                        <input
                            type="email"
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            className="input"
                            placeholder="email@destino.com"
                        />
                        <button
                            className="btn btn-secondary"
                            onClick={handleTestSmtp}
                            disabled={testingSmtp || !testEmail}
                        >
                            {testingSmtp ? 'Enviando...' : '📧 Enviar Test'}
                        </button>
                    </div>
                    {smtpTestResult && (
                        <div className={`test-result ${smtpTestResult.success ? 'success' : 'error'}`}>
                            {smtpTestResult.success ? '✅' : '❌'} {smtpTestResult.message}
                        </div>
                    )}
                </div>
            </div>

            <div className="config-section">
                <h3>📚 Diccionarios</h3>
                <div className="lang-selector">
                    {['es', 'en', 'ca'].map(l => (
                        <button key={l} className={`lang-btn ${selectedLang === l ? 'active' : ''}`}
                            onClick={() => setSelectedLang(l)}>
                            {l.toUpperCase()} <small>({l === selectedLang ? filteredWords.length : '...'})</small>
                        </button>
                    ))}
                </div>

                <div className="dict-management">
                    <div className="dict-add-section">
                        <h4>➕ Añadir Palabras</h4>
                        <textarea
                            className="input"
                            placeholder="Una palabra por línea o separadas por comas..."
                            value={newWords}
                            onChange={e => setNewWords(e.target.value)}
                            rows={4}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAddWords} disabled={addingWords || !newWords.trim()}>
                            {addingWords ? 'Añadiendo...' : 'Añadir Palabras'}
                        </button>

                        <div className="divider">o</div>

                        <input
                            type="file"
                            accept=".txt"
                            className="file-input"
                            id="dict-file-upload"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="dict-file-upload" className="btn btn-secondary btn-sm file-label">
                            📁 Subir Archivo .txt (Reemplaza todo)
                        </label>
                    </div>

                    <div className="dict-view-section">
                        <h4>🔍 Buscar en Diccionario</h4>
                        <div className="dict-tools">
                            <input
                                placeholder="Buscar palabra..."
                                className="input"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <div className="word-count-badge">{filteredWords.length} palabras</div>
                        </div>

                        <div className="dict-list narrow-scroll">
                            {loadingDict ? <p>Cargando...</p> : (
                                filteredWords.slice(0, 200).map(w => <span key={w} className="word-tag">{w}</span>)
                            )}
                            {filteredWords.length > 200 && <span className="more-hint">... y {filteredWords.length - 200} más</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GamePreviewModal({ gameId, token, onClose }) {
    const [game, setGame] = useState(null);
    const [viewingSnapshot, setViewingSnapshot] = useState(null); // { board, racks }

    useEffect(() => {
        fetch(`${API_URL}/api/admin/games/${gameId}/details`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(setGame);
    }, [gameId]);

    // Reset snapshot view when closing or changing game
    useEffect(() => {
        setViewingSnapshot(null);
    }, [gameId]);

    const handleViewSnapshot = (historyLog) => {
        // historyLog contains boardSnapshot and optionally racksSnapshot
        setViewingSnapshot({
            board: historyLog.boardSnapshot || historyLog, // Support old format (just board)
            racks: historyLog.racksSnapshot || null,
            timestamp: historyLog.timestamp,
            playerName: historyLog.playerName,
            action: historyLog.action
        });
    };

    if (!game) return <div className="modal-overlay glass">Cargando partida...</div>;

    const displayBoard = viewingSnapshot?.board || game.board;
    const displayRacks = viewingSnapshot?.racks || game.players;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="modal-content glass admin-game-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        Vista Partida: {gameId}
                        {viewingSnapshot && (
                            <span className="snapshot-badge">
                                📸 {viewingSnapshot.playerName} - {viewingSnapshot.action}
                            </span>
                        )}
                    </h3>
                    <div className="header-actions">
                        {viewingSnapshot && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewingSnapshot(null)}>
                                Volver al actual
                            </button>
                        )}
                        <button className="icon-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>
                <div className="game-preview-body">
                    <div className="preview-board-section">
                        <div className="admin-board-wrapper">
                            <Board
                                boardState={displayBoard}
                                placedTiles={[]}
                                onCellClick={() => { }}
                                onCellDrop={() => { }}
                                onTileRemove={() => { }}
                                disabled={true}
                                t={(key) => key}
                            />
                        </div>
                    </div>

                    <div className="preview-info-section">
                        <div className="preview-players">
                            <h4>
                                {viewingSnapshot ? '📸 Atriles (Snapshot)' : 'Atriles'}
                            </h4>
                            <div className="racks-list">
                                {displayRacks.map(p => (
                                    <div key={p.id} className="preview-rack">
                                        <div className="rack-header">
                                            <strong>{p.name}</strong>
                                            <span className="rack-score">{p.score} pts</span>
                                        </div>
                                        <div className="rack-tiles">
                                            {(p.tiles || []).map((t, i) => (
                                                <span key={i} className="mini-tile">
                                                    {typeof t === 'object' ? t.letter : t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="preview-history">
                            <h4>Historial</h4>
                            <div className="history-wrapper">
                                <GameHistory
                                    history={game.historyLogs || []}
                                    t={(key) => key} // Dummy translator
                                    onViewSnapshot={handleViewSnapshot}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
