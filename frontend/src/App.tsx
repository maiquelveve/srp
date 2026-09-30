import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import StructurePage from './features/structure';
import UsersPage from './features/users';
import RoutinesPage from './features/routines';
import DefinitiveSituationsPage from './features/definitive-situations';
import StaffPage from './features/staff';
import MinimumStaffingConfigPage from './features/staff/minimum-staffing';
import PostsPage from './features/staff/posts';
import ReportsPage from './features/reports';
import AuditPage from './features/reports/audit';
import ProfilePage from './features/profile';
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
          <Route path="/administracao-de-usuarios" element={<UsersPage />} />
          <Route path="/rotinas" element={<RoutinesPage />} />
          <Route path="/situacoes-definitivas" element={<DefinitiveSituationsPage />} />
          <Route path="/efetivo" element={<StaffPage />} />
          <Route path="/efetivo/postos" element={<PostsPage />} />
          <Route path="/efetivo/configuracao-minima" element={<MinimumStaffingConfigPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/auditoria" element={<AuditPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
