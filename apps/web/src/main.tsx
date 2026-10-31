import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isHealthResponse } from '@training/shared';
import './styles/global.css';
function App() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    setState('loading');
    let active = true;
    void fetch('/api/health', { signal: controller.signal }).then(async (response) => {
      if (!response.ok || !isHealthResponse(await response.json())) throw new Error('Invalid health response');
      if (active) setState('ok');
    }).catch(() => { if (active) setState('error'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt]);
  return <main><h1>Training platform admin</h1><p>Project initialized. No application features are configured.</p>
    <p role="status">{state === 'loading' ? 'Checking API connection…' : state === 'ok' ? 'API connection available.' : 'API connection unavailable.'}</p>
    {state === 'error' && <button onClick={() => setAttempt((value) => value + 1)}>Retry connection</button>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
