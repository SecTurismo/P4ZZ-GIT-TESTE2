import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let firestoreInfo = null;

      try {
        if (this.state.error?.message) {
          firestoreInfo = JSON.parse(this.state.error.message);
          if (firestoreInfo.error === 'Missing or insufficient permissions.') {
            errorMessage = 'Você não tem permissão para acessar este recurso. Por favor, faça login novamente.';
          }
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-white/10 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado</h1>
            <p className="text-slate-400 mb-8">{errorMessage}</p>
            
            {firestoreInfo && (
              <div className="text-left bg-black/20 rounded-xl p-4 mb-8 overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-2">Detalhes Técnicos:</p>
                <pre className="text-[10px] font-mono text-rose-400">
                  {JSON.stringify(firestoreInfo, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all active:scale-95"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
