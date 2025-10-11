import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

import './Header.css';

const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="sg-header">
      <div className="sg-header__inner">
        <Link to="/" className="sg-header__logo">
          <span className="sg-header__planet" aria-hidden>🪐</span>
          <span>Saturn Games</span>
        </Link>
        <nav className="sg-header__nav">
          <Link to="/assine">Planos</Link>
          <Link to="/faq">FAQ</Link>
          {user ? (
            <>
              <Link to="/dashboard">Minha conta</Link>
              <button className="sg-header__signout" onClick={() => signOut()}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="sg-header__cta">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
