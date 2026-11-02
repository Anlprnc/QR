import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import QrReport from './pages/QrReport';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/q/:token" element={<QrReport />} />
        <Route path="*" element={<p className="p-6">ArızaQR</p>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
