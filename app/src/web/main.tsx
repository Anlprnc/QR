import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import QrReport from './pages/QrReport';
import Login from './pages/Login';
import Panel from './pages/Panel';
import Machines from './pages/Machines';
import Reports from './pages/Reports';
import MachineDetail from './pages/MachineDetail';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';
import Tv from './pages/Tv';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/q/:token" element={<QrReport />} />
        <Route path="/giris" element={<Login />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/makineler" element={<Machines />} />
        <Route path="/makineler/:id" element={<MachineDetail />} />
        <Route path="/bakim" element={<Maintenance />} />
        <Route path="/raporlar" element={<Reports />} />
        <Route path="/ayarlar" element={<Settings />} />
        <Route path="/tv" element={<Tv />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
