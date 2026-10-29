import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { exitUrl, goExit } from './core/exit';

const skip = document.getElementById('campus-skip') as HTMLAnchorElement | null;
if (skip) {
  skip.href = exitUrl();
  skip.addEventListener('click', event => { event.preventDefault(); goExit('skip-button'); });
}
const query = new URLSearchParams(location.search);
const skipRequested = (query.has('skip') && query.get('skip') !== '0') || location.hash.toLowerCase() === '#skip';
if (skipRequested) goExit('skip-param');
else ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
