import React from 'react';

/**
 * Error Boundary component to catch JavaScript errors and prevent blank screens.
 * Shows a friendly error message with option to clear data and reload.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleClearAndReload = () => {
        // Clear all localStorage to remove potentially corrupted data
        localStorage.clear();
        // Reload the page
        window.location.reload();
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    background: '#0f0f1a',
                    color: 'white',
                    fontFamily: 'Outfit, sans-serif',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '1rem',
                        padding: '2rem',
                        maxWidth: '400px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😵</div>
                        <h2 style={{ marginBottom: '1rem' }}>¡Algo ha fallado!</h2>
                        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
                            Ha ocurrido un error inesperado. Puedes intentar recargar la página o limpiar los datos guardados.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit'
                                }}
                            >
                                🔄 Recargar
                            </button>
                            <button
                                onClick={this.handleClearAndReload}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit'
                                }}
                            >
                                🧹 Limpiar datos y recargar
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                                <summary style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.5)' }}>
                                    Detalles técnicos
                                </summary>
                                <pre style={{
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                    overflow: 'auto',
                                    fontSize: '0.75rem',
                                    marginTop: '0.5rem'
                                }}>
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
