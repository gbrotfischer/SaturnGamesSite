import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameCard from '../components/GameCard';
import { useAuth } from '../components/AuthContext';
import { fetchCatalog } from '../lib/api';
import { formatCurrency } from '../utils/formatCurrency';
import type { Game } from '../types';

import './HomePage.css';

const HomePage = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('todos');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchCatalog()
      .then((catalog) => {
        if (mounted) {
          setGames(catalog);
        }
      })
      .catch((err) => {
        setError(err.message ?? 'Falha ao carregar catálogo.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const featured = useMemo(() => games.filter((game) => game.featured).slice(0, 3), [games]);
  const availableGames = useMemo(() => games.filter((game) => game.status === 'available'), [games]);
  const tags = useMemo(() => {
    const values = new Set<string>();
    games.forEach((game) => game.tags.forEach((tag) => values.add(tag)));
    return ['todos', ...Array.from(values)];
  }, [games]);

  const filteredTrending = useMemo(() => {
    if (selectedTag === 'todos') return availableGames.slice(0, 6);
    return availableGames.filter((game) => game.tags.includes(selectedTag)).slice(0, 6);
  }, [availableGames, selectedTag]);

  const upcoming = useMemo(() => games.filter((game) => game.status === 'coming_soon').slice(0, 4), [games]);

  return (
    <div className="home">
      <section className="home__dashboard">
        <div className="home__panel">
          <span className="home__badge">Portal Saturn Games</span>
          <h1>
            Bem-vindo {user?.email ? <strong>{user.email}</strong> : <strong>streamer</strong>}!
          </h1>
          <p>
            Gerencie seus aluguéis, descubra novidades e mantenha sua audiência presa na live com experiências
            interativas pensadas para o TikTok.
          </p>
          <div className="home__panel-actions">
            <button type="button" onClick={() => navigate('/jogos')}>
              Explorar catálogo
            </button>
            <button type="button" onClick={() => navigate('/minha-conta')} className="secondary">
              Minha conta
            </button>
          </div>
          <dl className="home__metrics">
            <div>
              <dt>Integração segura</dt>
              <dd>OpenPix + Supabase</dd>
            </div>
            <div>
              <dt>Modo TikTok</dt>
              <dd>Compatível com lives</dd>
            </div>
            <div>
              <dt>Suporte</dt>
              <dd>Equipe Saturn Games</dd>
            </div>
          </dl>
        </div>
        <div className="home__spotlight" aria-live="polite">
          <header>
            <h2>Jogos em destaque</h2>
            <p>Escolha um título e gere a cobrança Pix em segundos.</p>
          </header>
          <div className="home__spotlight-grid">
            {loading && <div className="home__loading">Carregando catálogo...</div>}
            {error && <div className="home__error">{error}</div>}
            {!loading && !error &&
              featured.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className="home__tile"
                  onClick={() => navigate(`/jogos/${game.slug}`)}
                >
                  <span className="home__tile-status">{game.status === 'available' ? 'Disponível' : 'Em breve'}</span>
                  <strong>{game.title}</strong>
                  <span>{game.shortDescription ?? 'Saiba tudo na página do jogo.'}</span>
                  <footer>
                    <span>
                      {game.status === 'available'
                        ? formatCurrency(game.priceCents / 100)
                        : 'Aguardando lançamento'}
                    </span>
                    <span>{game.rentalDurationDays} dias</span>
                  </footer>
                </button>
              ))}
            {!loading && !error && featured.length === 0 && (
              <p className="home__empty">Nenhum jogo em destaque no momento. Explore o catálogo completo.</p>
            )}
          </div>
        </div>
      </section>

      <section className="home__trending">
        <div className="home__section-header">
          <h2>Populares entre criadores</h2>
          <div className="home__filters">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={selectedTag === tag ? 'active' : ''}
                onClick={() => setSelectedTag(tag)}
              >
                {tag === 'todos' ? 'Todos' : tag}
              </button>
            ))}
          </div>
        </div>
        <div className="home__grid">
          {filteredTrending.map((game) => (
            <GameCard key={game.id} game={game} onPrimaryAction={() => navigate(`/jogos/${game.slug}`)} />
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="home__upcoming">
          <div className="home__section-header">
            <h2>Em breve no portal</h2>
            <p>Ative alertas para ser o primeiro a testar quando lançarmos.</p>
          </div>
          <div className="home__grid">
            {upcoming.map((game) => (
              <GameCard key={game.id} game={game} onPrimaryAction={() => navigate(`/jogos/${game.slug}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;
