import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './components/AuthContext';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import GamePage from './pages/GamePage';
import AccountPage from './pages/AccountPage';
import SupportPage from './pages/SupportPage';
import AuthPage from './pages/AuthPage';
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

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/jogos" element={<LibraryPage />} />
    <Route path="/jogos/:slug" element={<GamePage />} />
    <Route
      path="/minha-conta/*"
      element={
        <ProtectedRoute>
          <AccountPage />
        </ProtectedRoute>
      }
    />
    <Route path="/sac" element={<SupportPage />} />
    <Route path="/entrar" element={<AuthPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

const App = () => {
  return (
    <AuthProvider>
      <div className="sg-app">
        <Header />
        <main className="sg-main">
          <ScrollToTop />
          <AppRoutes />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default App;
