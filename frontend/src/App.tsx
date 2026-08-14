import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import StructurePage from './features/structure';
import SettingsPage from './features/settings';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './layouts/AppShell';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/mapa-da-unidade" element={<StructurePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
