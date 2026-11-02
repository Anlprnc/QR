import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import QrReport from './pages/QrReport';
import Login from './pages/Login';
import Panel from './pages/Panel';
import Machines from './pages/Machines';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/q/:token" element={<QrReport />} />
        <Route path="/giris" element={<Login />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/makineler" element={<Machines />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
