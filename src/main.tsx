import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './design-system/tokens.css';
import './design-system/base.css';
const root = document.getElementById('root');
if (!root) throw new Error('Elemento root assente.');
ReactDOM.createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
