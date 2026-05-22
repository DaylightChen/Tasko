import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ApiError } from '../api/client';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render() {
    const { error } = this.state;
    if (error !== null) {
      const isHealthError =
        error instanceof ApiError && (error.code === 'INTERNAL' || error.code === 'ITEM_NOT_FOUND');
      const isNetworkError =
        error instanceof TypeError && typeof error.message === 'string' && error.message.includes('fetch');
      const showServiceError = isHealthError || isNetworkError;

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          {showServiceError ? (
            <>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tasko service is not running.</h1>
              <p>
                Run <code>pnpm start</code> and refresh.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong.</h1>
              <p>
                <button type="button" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
                  Reload.
                </button>
              </p>
            </>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
