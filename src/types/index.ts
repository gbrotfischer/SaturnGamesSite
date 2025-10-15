export type GameAssetKind = 'cover' | 'screenshot' | 'trailer';

export type GameStatus = 'available' | 'coming_soon';

export type RentalStatus = 'active' | 'expired' | 'refunded';

export type CheckoutMode = 'rental' | 'lifetime';

export interface GameAsset {
  id: string;
  gameId: string;
  kind: GameAssetKind;
  url: string;
  sortOrder: number;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  lifetimePriceCents: number | null;
  stripePriceIdRental: string | null;
  stripePriceIdLifetime: string | null;
  rentalDurationDays: number;
  isLifetimeAvailable: boolean;
  isPublished: boolean;
  tiktokNotes: string | null;
  status: GameStatus;
  genres: string[];
  tags: string[];
  releaseDate: string | null;
  popularityScore: number;
  featured: boolean;
  createdAt: string;
  assets: GameAsset[];
  upcoming?: UpcomingRelease | null;
}

export interface UpcomingRelease {
  id: string;
  gameId: string;
  releaseDate: string | null;
  notifyList: string[];
}

export interface Rental {
  id: string;
  userId: string;
  gameId: string;
  startsAt: string;
  expiresAt: string | null;
  status: RentalStatus;
  paymentRef: string | null;
  mode: CheckoutMode;
}

export interface RentalWithGame extends Rental {
  game?: Game;
}

export interface Purchase {
  id: string;
  userId: string;
  gameId: string;
  purchasedAt: string;
  paymentRef: string | null;
}

export interface PurchaseWithGame extends Purchase {
  game?: Game;
}

export interface SupportTicket {
  id: string;
  userId: string | null;
  subject: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
}

export interface NotificationPreferences {
  emailReleaseAlerts: boolean;
  emailExpiryAlerts: boolean;
}

export interface UserProfileSummary {
  id: string;
  email: string;
  fullName: string | null;
}
