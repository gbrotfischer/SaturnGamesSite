import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { fetchCatalog, subscribeToUpcoming } from '../lib/api';
import { formatCurrency } from '../utils/formatCurrency';
import type { Game } from '../types';

import './HomePage.css';

const spotlightOrder = ['game-bubbles-tiktok', 'game-saturn-plinko', 'game-saturn-cleaner'];

const HomePage = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then((catalog) => {
        if (active) {
          setGames(catalog);
        }
      })
      .catch((err) => {
        if (active) setError(err?.message ?? 'Não foi possível carregar os jogos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const spotlight = useMemo(
    () =>
      spotlightOrder
        .map((id) => games.find((game) => game.id === id) ?? null)
        .filter((game): game is Game => Boolean(game)),
    [games],
  );

  const availableTotal = useMemo(() => games.filter((game) => game.status === 'available').length, [games]);
  const comingSoonTotal = useMemo(() => games.filter((game) => game.status === 'coming_soon').length, [games]);

  function handlePlay(game: Game) {
    setFeedback(null);
    if (game.status === 'coming_soon') {
      navigate(`/jogos/${game.slug}`);
      return;
    }

    const destination = `/jogos/${game.slug}?checkout=1`;
    if (!user) {
      navigate(`/entrar?next=${encodeURIComponent(destination)}`);
      return;
    }
    navigate(destination);
  }

  async function handleNotify(game: Game) {
    setFeedback(null);
    if (!user?.email) {
      navigate(`/entrar?next=${encodeURIComponent(`/jogos/${game.slug}`)}`);
      return;
    }

    try {
      await subscribeToUpcoming(game.id, user.email, session?.access_token);
      setFeedback('Tudo certo! Você será avisado por e-mail assim que o jogo for lançado.');
    } catch (err: any) {
      const message = err?.message ?? 'Não foi possível registrar seu interesse agora.';
      if (message.includes('API base URL')) {
        setFeedback('Configure a API (VITE_API_BASE_URL) para ativar os alertas de lançamento.');
      } else {
        setFeedback(message);
      }
    }
  }

  return (
    <div className="dashboard">
      <section className="dashboard__hero">
        <div className="dashboard__intro">
          <span className="dashboard__badge">Saturn Games</span>
          <h1>Experiências gamer para dominar o TikTok</h1>
          <p>
            Alugue jogos interativos individuais, conecte com o launcher oficial e transforme engajamento em performance nas suas
            lives.
          </p>
          <div className="dashboard__cta">
            <button type="button" onClick={() => navigate('/jogos')}>
              Explorar catálogo
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/minha-conta')}>
              Minha conta
            </button>
          </div>
          <ul className="dashboard__metrics">
            <li>
              <strong>{availableTotal}</strong>
              <span>Jogos disponíveis</span>
            </li>
            <li>
              <strong>{comingSoonTotal}</strong>
              <span>Lançamentos em breve</span>
            </li>
            <li>
              <strong>Pix instantâneo</strong>
              <span>Pagamento seguro com OpenPix</span>
            </li>
          </ul>
          {feedback && <p className="dashboard__feedback">{feedback}</p>}
        </div>
        <div className="dashboard__cards">
          {loading && <div className="dashboard__state">Carregando catálogo...</div>}
          {error && <div className="dashboard__state is-error">{error}</div>}
          {!loading && !error && spotlight.length === 0 && (
            <div className="dashboard__state">Catálogo em preparação. Volte em breve!</div>
          )}
          {!loading && !error &&
            spotlight.map((game) => {
              const cover = game.assets.find((asset) => asset.kind === 'cover') ?? game.assets[0];
              const isAvailable = game.status === 'available';
              return (
                <article key={game.id} className={`dashboard-card ${isAvailable ? 'is-available' : 'is-soon'}`}>
                  <header>
                    <span>{isAvailable ? 'Disponível agora' : 'Lançamento em breve'}</span>
                    <h2>{game.title}</h2>
                    <p>{game.shortDescription}</p>
                  </header>
                  {cover && (
                    <div className="dashboard-card__art">
                      <img src={cover.url} alt={`Arte de ${game.title}`} loading="lazy" />
                    </div>
                  )}
                  <footer>
                    {isAvailable ? (
                      <>
                        <div className="dashboard-card__price">
                          <strong>{formatCurrency(game.priceCents / 100)}</strong>
                          <span>{game.rentalDurationDays} dias de acesso</span>
                        </div>
                        <button type="button" onClick={() => handlePlay(game)}>
                          Jogar agora
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="dashboard-card__soon">
                          <span>Assine o alerta para receber o convite do beta fechado.</span>
                        </div>
                        <div className="dashboard-card__actions">
                          <button type="button" onClick={() => handleNotify(game)}>
                            Quero ser avisado
                          </button>
                          <button type="button" className="ghost" onClick={() => navigate(`/jogos/${game.slug}`)}>
                            Ver detalhes
                          </button>
                        </div>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
