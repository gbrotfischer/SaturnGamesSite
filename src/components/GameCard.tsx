import { Link } from 'react-router-dom';
import type { Game, RentalWithGame } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import { calculateDaysRemaining, formatShortDate, isActiveRental } from '../utils/date';

import './GameCard.css';

type GameCardProps = {
  game: Game;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  disabled?: boolean;
  highlight?: boolean;
  rental?: RentalWithGame | null;
  showLifetimeOption?: boolean;
  onLifetimeAction?: () => void;
  lifetimeLabel?: string;
};

const GameCard = ({
  game,
  onPrimaryAction,
  primaryLabel = 'Alugar agora',
  disabled,
  highlight,
  rental,
  showLifetimeOption,
  onLifetimeAction,
  lifetimeLabel = 'Comprar vitalício',
}: GameCardProps) => {
  const cover = game.assets.find((asset) => asset.kind === 'cover') ?? game.assets[0];
  const tags = [...game.tags];
  if (game.status === 'coming_soon') {
    tags.push('Em breve');
  }
  if (game.isLifetimeAvailable) {
    tags.push('Compra vitalícia');
  }

  const rentalActive = rental && isActiveRental(rental.expiresAt);
  const daysRemaining = rentalActive ? calculateDaysRemaining(rental!.expiresAt) : null;

  return (
    <article className={`sg-game-card ${highlight ? 'is-highlight' : ''}`}>
      <Link to={`/jogos/${game.slug}`} className="sg-game-card__cover" aria-label={`Detalhes de ${game.title}`}>
        {cover ? <img src={cover.url} alt={game.title} loading="lazy" /> : <div className="sg-game-card__placeholder" />}
        {game.featured && <span className="sg-game-card__featured">Destaque</span>}
      </Link>

      <div className="sg-game-card__content">
        <header>
          <Link to={`/jogos/${game.slug}`} className="sg-game-card__title">
            {game.title}
          </Link>
          {game.shortDescription && <p className="sg-game-card__description">{game.shortDescription}</p>}
        </header>

        <ul className="sg-game-card__tags">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>

        <div className="sg-game-card__footer">
          <div className="sg-game-card__pricing">
            <span className="sg-game-card__price">{formatCurrency(game.priceCents / 100)}</span>
            <span className="sg-game-card__meta">{game.rentalDurationDays} dias de acesso</span>
          </div>

          {rentalActive ? (
            <div className="sg-game-card__status">
              <span className="sg-game-card__badge is-active">Alugado até {formatShortDate(rental!.expiresAt)}</span>
              {typeof daysRemaining === 'number' && daysRemaining <= 5 && (
                <span className="sg-game-card__badge is-warning">Expira em {daysRemaining} dias</span>
              )}
              <button type="button" onClick={onPrimaryAction} className="sg-game-card__primary">
                Renovar aluguel
              </button>
            </div>
          ) : (
            <div className="sg-game-card__actions">
              <button
                type="button"
                className="sg-game-card__primary"
                onClick={onPrimaryAction}
                disabled={disabled || game.status === 'coming_soon'}
              >
                {game.status === 'coming_soon' ? 'Em breve' : primaryLabel}
              </button>
              {showLifetimeOption && game.isLifetimeAvailable && (
                <button
                  type="button"
                  className="sg-game-card__secondary"
                  onClick={onLifetimeAction}
                  disabled={disabled}
                >
                  {lifetimeLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default GameCard;
