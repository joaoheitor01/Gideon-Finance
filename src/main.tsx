import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// ✅ APENAS ISSO:
root.render(
  <React.StrictMode>
    <App /> {/* ← NÃO envolva com <BrowserRouter> aqui! */}
  </React.StrictMode>
);