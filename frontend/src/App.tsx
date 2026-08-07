import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StructurePage from './features/structure';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './layouts/AppShell';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/mapa-da-unidade" element={<StructurePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/mapa-da-unidade" replace />} />
    </Routes>
  );
}
