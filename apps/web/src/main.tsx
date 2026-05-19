import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/theme.css';
import { App } from './app';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
const root = createRoot(rootEl);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
