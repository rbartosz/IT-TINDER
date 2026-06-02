// tu startuje reacta, montuje App do diva o id=root
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles.css';

// StrictMode robi dwa razy renderowanie w devie zeby wykryc bugi
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
