import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './components/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SubscribePage from './pages/SubscribePage';
import FaqPage from './pages/FaqPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';

type ProtectedRouteProps = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="sg-center">Carregando…</div>;
  }

  if (!user) {
    return <Navigate to="/entrar" replace />;
  }

  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/entrar" element={<AuthPage />} />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/assine"
      element={
        <ProtectedRoute>
          <SubscribePage />
        </ProtectedRoute>
      }
    />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

const App = () => {
  return (
    <AuthProvider>
      <div className="sg-app">
        <Header />
        <main className="sg-main">
          <AppRoutes />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default App;
