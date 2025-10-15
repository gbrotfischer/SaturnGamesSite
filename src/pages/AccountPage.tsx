import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import {
  fetchActiveRentals,
  fetchCatalog,
  fetchNotificationPreferences,
  fetchPurchases,
  updateNotificationPreferences,
} from '../lib/api';
import type { Game, NotificationPreferences, PurchaseWithGame, RentalWithGame } from '../types';
import { formatShortDate, isActiveRental } from '../utils/date';
import { useCheckout } from '../hooks/useCheckout';

import './AccountPage.css';

const AccountDashboard = () => {
  const { user, session, signOut } = useAuth();
  const [rentals, setRentals] = useState<RentalWithGame[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithGame[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkout = useCheckout();

  const loadCollections = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [rentalsData, purchasesData, prefsData, catalogData] = await Promise.all([
        fetchActiveRentals(user.id),
        fetchPurchases(user.id),
        fetchNotificationPreferences(user.id),
        fetchCatalog(),
      ]);
      setRentals(rentalsData);
      setPurchases(purchasesData);
      setPrefs(prefsData);
      setGames(catalogData);
    } catch (err) {
      console.error('Erro ao carregar dados da conta', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    if (checkout.error) {
      setMessage(checkout.error);
      return;
    }

    if (checkout.status === 'processing') {
      setMessage('Preparando checkout seguro do Stripe...');
    } else if (checkout.status === 'redirecting') {
      setMessage('Redirecionando para o Stripe. Você voltará automaticamente após o pagamento.');
    }
  }, [checkout.error, checkout.status]);

  async function handleRenewal(rental: RentalWithGame) {
    if (!rental.game || !user?.id || !user?.email) return;
    const priceId =
      rental.mode === 'lifetime'
        ? rental.game.stripePriceIdLifetime
        : rental.game.stripePriceIdRental;

    if (!priceId) {
      setMessage('Plano de pagamento não configurado. Fale com o suporte.');
      return;
    }

    try {
      await checkout.startCheckout({
        game: rental.game,
        mode: rental.mode,
        priceId,
        user: {
          id: user.id,
          email: user.email,
          fullName:
            typeof user?.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : undefined,
        },
        accessToken: session?.access_token,
      });
      setMessage('Abrindo checkout do Stripe para concluir a renovação.');
    } catch (err: any) {
      setMessage(err?.message ?? 'Falha ao iniciar renovação.');
    }
  }

  async function handlePreferencesUpdate(update: Partial<NotificationPreferences>) {
    if (!prefs || !session?.access_token) return;
    const next = { ...prefs, ...update };
    setPrefs(next);
    setSaving(true);
    try {
      await updateNotificationPreferences(next, session.access_token);
      setMessage('Preferências atualizadas com sucesso.');
    } catch (err: any) {
      setMessage(err?.message ?? 'Não foi possível salvar as preferências.');
    } finally {
      setSaving(false);
    }
  }

  const activeRentals = rentals.filter((rental) => isActiveRental(rental.expiresAt));
  const expiredRentals = rentals.filter((rental) => !isActiveRental(rental.expiresAt));

  const library = useMemo(() => {
    const ids = new Set<string>();
    activeRentals.forEach((rental) => rental.game && ids.add(rental.game.id));
    purchases.forEach((purchase) => purchase.game && ids.add(purchase.game.id));
    return games.filter((game) => ids.has(game.id));
  }, [activeRentals, purchases, games]);

  return (
    <div className="account">
      <header className="account__header">
        <div>
          <h1>Minha conta</h1>
          <p>Gerencie seus dados, aluguéis e preferências de notificação.</p>
        </div>
        <button type="button" className="account__signout" onClick={() => signOut()}>
          Sair da conta
        </button>
      </header>

      {message && <div className="account__message">{message}</div>}

      <section className="account__card">
        <h2>Perfil</h2>
        <dl className="account__profile">
          <div>
            <dt>Nome</dt>
            <dd>{user?.user_metadata?.full_name ?? '—'}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>2FA</dt>
            <dd>Configuração opcional via Supabase Auth (em breve na interface).</dd>
          </div>
        </dl>
      </section>

      <section className="account__card">
        <h2>Aluguéis ativos</h2>
        {activeRentals.length === 0 ? (
          <p>Você não possui aluguéis ativos no momento.</p>
        ) : (
          <ul className="account__list">
            {activeRentals.map((rental) => (
              <li key={rental.id}>
                <div>
                  <strong>{rental.game?.title ?? 'Jogo removido'}</strong>
                  <span>Expira em {formatShortDate(rental.expiresAt)}</span>
                </div>
                <button
                  type="button"
                  className="checkout-button"
                  onClick={() => handleRenewal(rental)}
                  data-game-id={rental.game?.id ?? ''}
                  data-price-id={
                    rental.mode === 'lifetime'
                      ? rental.game?.stripePriceIdLifetime ?? ''
                      : rental.game?.stripePriceIdRental ?? ''
                  }
                >
                  Renovar
                </button>
              </li>
            ))}
          </ul>
        )}

        {expiredRentals.length > 0 && (
          <details className="account__accordion">
            <summary>Histórico de aluguéis</summary>
            <ul className="account__list is-compact">
              {expiredRentals.map((rental) => (
                <li key={rental.id}>
                  <div>
                    <strong>{rental.game?.title ?? 'Jogo removido'}</strong>
                    <span>Expirou em {formatShortDate(rental.expiresAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="account__card">
        <h2>Compras vitalícias</h2>
        {purchases.length === 0 ? (
          <p>Você ainda não possui compras vitalícias.</p>
        ) : (
          <ul className="account__list">
            {purchases.map((purchase) => (
              <li key={purchase.id}>
                <div>
                  <strong>{purchase.game?.title ?? 'Jogo removido'}</strong>
                  <span>Adquirido em {formatShortDate(purchase.purchasedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="account__card">
        <h2>Biblioteca</h2>
        {library.length === 0 ? (
          <p>Você ainda não possui jogos na biblioteca. Explore o catálogo para começar.</p>
        ) : (
          <div className="account__library">
            {library.map((game) => (
              <article key={game.id}>
                <h3>{game.title}</h3>
                <p>{game.shortDescription}</p>
                <a href={`/jogos/${game.slug}`}>Ver detalhes</a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="account__card">
        <h2>Preferências</h2>
        {prefs ? (
          <form className="account__preferences">
            <label>
              <input
                type="checkbox"
                checked={prefs.emailExpiryAlerts}
                onChange={(event) => handlePreferencesUpdate({ emailExpiryAlerts: event.target.checked })}
                disabled={saving}
              />
              Receber alertas de expiração de aluguel
            </label>
            <label>
              <input
                type="checkbox"
                checked={prefs.emailReleaseAlerts}
                onChange={(event) => handlePreferencesUpdate({ emailReleaseAlerts: event.target.checked })}
                disabled={saving}
              />
              Avisar quando jogos “em breve” forem lançados
            </label>
          </form>
        ) : (
          <p>Carregando preferências...</p>
        )}
      </section>

    </div>
  );
};

const AccountPage = () => {
  return (
    <Routes>
      <Route index element={<AccountDashboard />} />
    </Routes>
  );
};

export default AccountPage;
