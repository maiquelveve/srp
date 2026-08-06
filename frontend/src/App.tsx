import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StructurePage from './features/structure';
import ProtectedRoute from './components/ProtectedRoute';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/structure" element={<StructurePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/structure" replace />} />
    </Routes>
  );
}
