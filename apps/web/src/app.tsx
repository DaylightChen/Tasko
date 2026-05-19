import { useEffect, useState } from 'react';

export function App() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main id="main" style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--text-h1-size)' }}>Tasko</h1>
      <p>
        {status === 'loading'
          ? 'Checking server…'
          : status === 'ok'
            ? 'Tasko service: OK'
            : 'Tasko service: not running. Start the server and refresh.'}
      </p>
    </main>
  );
}
