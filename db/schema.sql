-- Saturn Games schema focusing on aluguel individual de jogos

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_description text,
  description text,
  price_cents integer not null,
  lifetime_price_cents integer,
  rental_duration_days integer not null default 30,
  is_lifetime_available boolean not null default false,
  is_published boolean not null default true,
  status text not null default 'available' check (status in ('available', 'coming_soon')),
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  tiktok_notes text,
  release_date date,
  popularity_score integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.game_assets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  kind text not null check (kind in ('cover', 'screenshot', 'trailer')),
  url text not null,
  sort_order integer not null default 0
);

create index if not exists game_assets_game_idx on public.game_assets (game_id, sort_order);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id uuid not null references public.games(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  payment_ref text,
  status text not null default 'active' check (status in ('active', 'expired', 'refunded')),
  mode text not null default 'rental' check (mode in ('rental', 'lifetime')),
  created_at timestamptz not null default now(),
  constraint rentals_unique_active unique (user_id, game_id, status) where status = 'active'
);

create index if not exists rentals_user_idx on public.rentals (user_id);
create index if not exists rentals_game_idx on public.rentals (game_id);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id uuid not null references public.games(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  payment_ref text,
  constraint purchases_unique unique (user_id, game_id)
);

create table if not exists public.releases_upcoming (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  release_date date,
  notify_list text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.tickets_support (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  user_id uuid primary key,
  email_release_alerts boolean not null default true,
  email_expiry_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.checkout_sessions (
  id uuid primary key,
  user_id uuid not null,
  game_id uuid not null references public.games(id) on delete cascade,
  mode text not null check (mode in ('rental', 'lifetime')),
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  correlation_id text not null unique,
  payment_ref text,
  created_at timestamptz not null default now()
);

create index if not exists checkout_sessions_user_idx on public.checkout_sessions (user_id);
create index if not exists checkout_sessions_game_idx on public.checkout_sessions (game_id);

-- RLS policies devem ser configuradas conforme as necessidades da aplicação.
