import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import GameCard from '../components/GameCard';
import { useAuth } from '../components/AuthContext';
import { fetchActiveRentals, fetchCatalog, subscribeToUpcoming } from '../lib/api';
import type { Game, RentalWithGame } from '../types';
import { useCheckout } from '../hooks/useCheckout';
import CheckoutModal from '../components/CheckoutModal';

import './LibraryPage.css';

const LibraryPage = () => {
  const { user, session } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [rentals, setRentals] = useState<RentalWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const checkout = useCheckout();

  const searchQuery = searchParams.get('q')?.toLowerCase() ?? '';
  const genreFilter = searchParams.get('genre') ?? 'todos';
  const availability = searchParams.get('availability') ?? 'todos';
  const sort = searchParams.get('sort') ?? 'popularidade';

  useEffect(() => {
    let mounted = true;
    fetchCatalog()
      .then((catalog) => {
        if (mounted) setGames(catalog);
      })
      .catch((err) => setError(err.message ?? 'Falha ao carregar catálogo.'))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || games.length === 0) return;

    const resume = async () => {
      for (const game of games) {
        const resumed = await checkout.resumeCheckout({ game, mode: 'rental', userId: user.id });
        if (resumed) {
          return;
        }
        if (game.isLifetimeAvailable) {
          const lifetime = await checkout.resumeCheckout({
            game,
            mode: 'lifetime',
            userId: user.id,
          });
          if (lifetime) {
            return;
          }
        }
      }
    };

    void resume();
  }, [checkout, games, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setRentals([]);
      return;
    }

    fetchActiveRentals(user.id)
      .then((records) => setRentals(records))
      .catch((err) => console.error('Erro ao carregar aluguéis', err));
  }, [user?.id, checkout.status]);

  useEffect(() => {
    if (checkout.error) {
      setStatusMessage(checkout.error);
    } else if (checkout.status === 'paid') {
      setStatusMessage('Pagamento confirmado! Aguarde alguns instantes para o acesso ser liberado.');
    } else if (checkout.status === 'expired') {
      setStatusMessage('Cobrança expirada. Gere uma nova cobrança para tentar novamente.');
    }
  }, [checkout.error, checkout.status]);

  useEffect(() => {
    if (!checkout.rental || !user?.id) return;
    setRentals((current) => {
      const existing = current.filter((item) => item.id !== checkout.rental!.id);
      return [checkout.rental!, ...existing];
    });
  }, [checkout.rental, user?.id]);

  const genres = useMemo(() => {
    const values = new Set<string>();
    games.forEach((game) => game.genres.forEach((genre) => values.add(genre)));
    return ['todos', ...Array.from(values)];
  }, [games]);

  const filteredGames = useMemo(() => {
    const base = games.filter((game) => {
      const matchesSearch = searchQuery
        ? game.title.toLowerCase().includes(searchQuery) ||
          game.shortDescription?.toLowerCase().includes(searchQuery) ||
          game.tags.some((tag) => tag.toLowerCase().includes(searchQuery))
        : true;
      const matchesGenre = genreFilter === 'todos' || game.genres.includes(genreFilter);
      const matchesAvailability =
        availability === 'todos' ||
        (availability === 'disponiveis' && game.status === 'available') ||
        (availability === 'embreve' && game.status === 'coming_soon');
      return matchesSearch && matchesGenre && matchesAvailability;
    });

    return base.sort((a, b) => {
      switch (sort) {
        case 'lancamento':
          return new Date(b.releaseDate ?? b.createdAt).getTime() - new Date(a.releaseDate ?? a.createdAt).getTime();
        case 'preco-desc':
          return b.priceCents - a.priceCents;
        case 'preco-asc':
          return a.priceCents - b.priceCents;
        case 'popularidade':
        default:
          return b.popularityScore - a.popularityScore;
      }
    });
  }, [games, searchQuery, genreFilter, availability, sort]);

  const upcomingGames = filteredGames.filter((game) => game.status === 'coming_soon');
  const availableGames = filteredGames.filter((game) => game.status === 'available');

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(location.search);
    if (!value || value === 'todos') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  async function handleCheckout(game: Game, mode: 'rental' | 'lifetime') {
    if (!user?.email || !user?.id) {
      navigate('/entrar');
      return;
    }

    try {
      await checkout.startCheckout({
        game,
        mode,
        user: {
          id: user.id,
          email: user.email,
          fullName:
            typeof user.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : undefined,
        },
      });
      setStatusMessage('Geramos a sessão Pix. Conclua o pagamento no seu banco.');
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Não foi possível iniciar o checkout.');
    }
  }

  async function handleNotify(game: Game) {
    if (!user?.email) {
      setStatusMessage('Entre com sua conta para receber alertas.');
      navigate('/entrar');
      return;
    }

    try {
      await subscribeToUpcoming(game.id, user.email, session?.access_token);
      setStatusMessage('Pronto! Avisaremos por e-mail assim que o jogo estiver disponível.');
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Não foi possível registrar seu interesse.');
    }
  }

  const rentalMap = new Map(rentals.map((rental) => [rental.gameId, rental]));

  return (
    <div className="library">
      <header className="library__header">
        <h1>Catálogo completo</h1>
        <p>
          Filtre por gênero, disponibilidade ou data de lançamento para descobrir o jogo perfeito para sua próxima
          live.
        </p>
        {statusMessage && <p className="library__status">{statusMessage}</p>}
      </header>

      <section className="library__filters" aria-label="Filtros do catálogo">
        <div>
          <label htmlFor="filter-genre">Gênero</label>
          <select id="filter-genre" value={genreFilter} onChange={(event) => updateFilter('genre', event.target.value)}>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre === 'todos' ? 'Todos' : genre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-availability">Disponibilidade</label>
          <select
            id="filter-availability"
            value={availability}
            onChange={(event) => updateFilter('availability', event.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="disponiveis">Somente disponíveis</option>
            <option value="embreve">Somente em breve</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-sort">Ordenar por</label>
          <select id="filter-sort" value={sort} onChange={(event) => updateFilter('sort', event.target.value)}>
            <option value="popularidade">Popularidade</option>
            <option value="lancamento">Data de lançamento</option>
            <option value="preco-desc">Maior preço</option>
            <option value="preco-asc">Menor preço</option>
          </select>
        </div>
      </section>

      {error && <p className="library__error">{error}</p>}

      {searchQuery && <p className="library__results">Resultados para “{searchQuery}”</p>}

      <section className="library__section">
        <h2>Disponíveis para aluguel</h2>
        <div className="library__grid">
          {availableGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              rental={rentalMap.get(game.id) ?? null}
              onPrimaryAction={() => handleCheckout(game, 'rental')}
              showLifetimeOption
              onLifetimeAction={() => handleCheckout(game, 'lifetime')}
            />
          ))}
          {!loading && availableGames.length === 0 && <p>Nenhum jogo encontrado com esses filtros.</p>}
        </div>
      </section>

      {upcomingGames.length > 0 && (
        <section className="library__section">
          <h2>Em breve</h2>
          <div className="library__grid">
            {upcomingGames.map((game) => (
              <div key={game.id} className="library__upcoming-card">
                <GameCard game={game} disabled onPrimaryAction={() => handleNotify(game)} primaryLabel="Quero ser avisado" />
                <button type="button" onClick={() => handleNotify(game)} className="library__notify">
                  Quero ser avisado
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <CheckoutModal
        open={checkout.isOpen}
        onClose={checkout.closeCheckout}
        onRefresh={checkout.refreshCheckout}
        status={checkout.status}
        session={checkout.session}
        game={checkout.activeGame}
        rental={checkout.rental}
        error={checkout.error}
      />
    </div>
  );
};

export default LibraryPage;
