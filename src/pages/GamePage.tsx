import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import {
  fetchActiveRentals,
  fetchGameBySlug,
  subscribeToUpcoming,
} from '../lib/api';
import type { Game, RentalWithGame } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import { calculateDaysRemaining, formatDate, formatShortDate, isActiveRental } from '../utils/date';
import { useCheckout } from '../hooks/useCheckout';
import CheckoutModal from '../components/CheckoutModal';

import './GamePage.css';

const GamePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [game, setGame] = useState<Game | null>(null);
  const [rental, setRental] = useState<RentalWithGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const checkout = useCheckout();
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    fetchGameBySlug(slug)
      .then(async (data) => {
        if (mounted) setGame(data);
        if (data && user?.id) {
          const rentals = await fetchActiveRentals(user.id);
          const active = rentals.find((item) => item.gameId === data.id) ?? null;
          if (mounted) setRental(active);
        }
      })
      .catch((err) => setStatusMessage(err?.message ?? 'Falha ao carregar jogo.'))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [slug, user?.id]);

  useEffect(() => {
    if (checkout.error) {
      setStatusMessage(checkout.error);
    } else if (checkout.status === 'paid') {
      setStatusMessage('Pagamento confirmado! Atualizamos seu acesso em instantes.');
    } else if (checkout.status === 'expired') {
      setStatusMessage('Cobrança expirada. Gere uma nova cobrança se ainda quiser o jogo.');
    }
  }, [checkout.error, checkout.status]);

  useEffect(() => {
    if (!game || !checkout.rental) return;
    if (checkout.rental.gameId === game.id) {
      setRental(checkout.rental);
    }
  }, [checkout.rental, game]);

  const cover = useMemo(() => game?.assets.find((asset) => asset.kind === 'cover') ?? game?.assets[0], [game]);
  const screenshots = useMemo(
    () => (game?.assets.filter((asset) => asset.kind === 'screenshot') ?? []).slice(0, 4),
    [game],
  );

  const handleCheckout = useCallback(
    async (mode: 'rental' | 'lifetime') => {
      if (!game) return;
      if (!user?.email || !session?.access_token) {
        const destination = `/jogos/${game.slug}?checkout=1`;
        navigate(`/entrar?next=${encodeURIComponent(destination)}`);
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
        setStatusMessage('Geramos a sessão Pix. Escaneie o QR code e aguarde a confirmação.');
      } catch (err: any) {
        setStatusMessage(err?.message ?? 'Não foi possível gerar a cobrança.');
      }
    },
    [checkout, game, navigate, session?.access_token, user?.email, user?.id, user?.user_metadata?.full_name],
  );

  async function handleNotify() {
    if (!game) return;
    if (!user?.email) {
      navigate(`/entrar?next=${encodeURIComponent(`/jogos/${game.slug}`)}`);
      return;
    }

    try {
      await subscribeToUpcoming(game.id, user.email, session?.access_token);
      setStatusMessage('Avisaremos por e-mail assim que o jogo for lançado.');
    } catch (err: any) {
      const message = err?.message ?? 'Não foi possível registrar o alerta.';
      if (message.includes('Supabase')) {
        setStatusMessage('Configure SUPABASE_URL e SUPABASE_ANON_KEY para ativar os alertas de lançamento.');
      } else {
        setStatusMessage(message);
      }
    }
  }

  useEffect(() => {
    if (!game || autoCheckoutTriggered || !user?.id) return;
    const params = new URLSearchParams(location.search);
    const shouldCheckout = params.get('checkout') === '1';
    if (shouldCheckout && game.status === 'available') {
      setAutoCheckoutTriggered(true);
      void handleCheckout('rental');
      return;
    }

    const resume = async () => {
      const resumedRental = await checkout.resumeCheckout({ game, mode: 'rental', userId: user.id });
      if (!resumedRental && game.isLifetimeAvailable) {
        await checkout.resumeCheckout({ game, mode: 'lifetime', userId: user.id });
      }
    };

    void resume();
  }, [autoCheckoutTriggered, checkout, game, handleCheckout, location.search, user?.id]);

  if (loading) {
    return <div className="game__loading">Carregando jogo...</div>;
  }

  if (!game) {
    return <div className="game__loading">Jogo não encontrado.</div>;
  }

  const rentalActive = rental && isActiveRental(rental.expiresAt);
  const daysRemaining = rentalActive ? calculateDaysRemaining(rental!.expiresAt) : null;

  return (
    <div className="game">
      {statusMessage && <div className="game__status">{statusMessage}</div>}
      <header className="game__hero">
        <div className="game__cover" aria-hidden>
          {cover && <img src={cover.url} alt={game.title} />}
        </div>
        <div className="game__info">
          <p className="game__meta">{game.genres.join(' • ')}</p>
          <h1>{game.title}</h1>
          {game.shortDescription && <p className="game__summary">{game.shortDescription}</p>}
          <div className="game__pricing">
            <div>
              <strong>{formatCurrency(game.priceCents / 100)}</strong>
              <span>{game.rentalDurationDays} dias de acesso</span>
            </div>
            {game.isLifetimeAvailable && game.lifetimePriceCents && (
              <div>
                <strong>{formatCurrency(game.lifetimePriceCents / 100)}</strong>
                <span>Compra vitalícia</span>
              </div>
            )}
          </div>

          {game.status === 'coming_soon' ? (
            <button type="button" className="game__primary" onClick={handleNotify}>
              Quero ser avisado
            </button>
          ) : rentalActive ? (
            <div className="game__rental">
              <span>
                Aluguel ativo até {formatShortDate(rental!.expiresAt)}{' '}
                {typeof daysRemaining === 'number' && daysRemaining <= 5 && `(${daysRemaining} dias restantes)`}
              </span>
              <button type="button" onClick={() => handleCheckout('rental')} className="game__primary">
                Renovar aluguel
              </button>
            </div>
          ) : (
            <div className="game__actions">
              <button type="button" className="game__primary" onClick={() => handleCheckout('rental')}>
                Alugar agora
              </button>
              {game.isLifetimeAvailable && (
                <button type="button" className="game__secondary" onClick={() => handleCheckout('lifetime')}>
                  Comprar vitalício
                </button>
              )}
            </div>
          )}

          <div className="game__security">
            <span>🔐 Pagamento seguro via OpenPix</span>
            <span>🛡️ Proteção Cloudflare</span>
            <span>🔄 Renovação automática via webhook</span>
          </div>
        </div>
      </header>

      <section className="game__details">
        <div>
          <h2>Descrição</h2>
          <p>{game.description ?? 'Descrição será publicada em breve.'}</p>
          {game.tiktokNotes && (
            <div className="game__card">
              <h3>Compatível com TikTok</h3>
              <p>{game.tiktokNotes}</p>
              <a className="game__link" href="/guia-tiktok">
                Ver guia completo
              </a>
            </div>
          )}
          <div className="game__card">
            <h3>Notas de atualização</h3>
            <p>Atualizações contínuas garantem compatibilidade com os efeitos e desafios mais recentes.</p>
          </div>
        </div>

        <aside>
          <div className="game__card">
            <h3>Detalhes técnicos</h3>
            <ul>
              <li>Disponível em Windows e macOS</li>
              <li>Launcher Saturn com verificação automática</li>
              <li>Necessário conexão estável durante lives</li>
            </ul>
          </div>
          <div className="game__card">
            <h3>Próximo lançamento</h3>
            <p>{formatDate(game.releaseDate, 'Data a confirmar')}</p>
          </div>
        </aside>
      </section>

      {screenshots.length > 0 && (
        <section className="game__gallery" aria-label="Capturas de tela">
          {screenshots.map((shot) => (
            <img key={shot.id} src={shot.url} alt={`Screenshot de ${game.title}`} loading="lazy" />
          ))}
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

export default GamePage;
