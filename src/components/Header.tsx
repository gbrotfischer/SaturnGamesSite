import { FormEvent, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

import './Header.css';

const navLinks = [
  { to: '/', label: 'Início', end: true },
  { to: '/jogos', label: 'Catálogo' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contato', label: 'Contato' },
];

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('q') ?? '');
  }, [location.search]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/jogos?q=${encodeURIComponent(trimmed)}` : '/jogos');
  }

  return (
    <header className="sg-header">
      <div className="sg-header__inner">
        <Link to="/" className="sg-header__logo">
          <span aria-hidden className="sg-header__planet">
            🪐
          </span>
          <span>Saturn Games</span>
        </Link>

        <nav className="sg-header__nav" aria-label="Principal">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <form className="sg-header__search" role="search" onSubmit={handleSearch}>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogos"
            aria-label="Buscar jogos"
          />
          <button type="submit">Buscar</button>
        </form>

        <div className="sg-header__actions">
          {user ? (
            <>
              <Link to="/minha-conta" className="sg-header__account">
                <span className="sg-header__account-label">Minha conta</span>
                <span className="sg-header__account-meta">{user.email}</span>
              </Link>
              <button type="button" className="sg-header__signout" onClick={handleSignOut}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="sg-header__cta">
              Entrar / Criar conta
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
