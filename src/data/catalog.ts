import type { Game } from '../types';

export const localCatalog: Game[] = [
  {
    id: 'game-bubbles-tiktok',
    slug: 'bubbles-tiktok',
    title: 'Bubbles TikTok',
    shortDescription:
      'Transforme interações da live em uma disputa frenética de bolhas com ranking em tempo real.',
    description:
      'Bubbles TikTok foi criado sob medida para streams interativas: cada curtida, comentário ou presente da audiência alimenta a bolha do espectador. Ela se move aleatoriamente pela tela e, ao encostar em outra, ambos perdem pontos. Quem engaja mais mantém a bolha viva e chega ao topo do ranking. Inclui painel de configuração, temas personalizados e ajuste fino das regras para cada criador.',
    priceCents: 2490,
    lifetimePriceCents: null,
    rentalDurationDays: 30,
    isLifetimeAvailable: false,
    isPublished: true,
    tiktokNotes:
      'Integre o overlay pelo OBS Browser Source usando a URL segura do launcher. Compatível com chat e presentes TikTok.',
    status: 'available',
    genres: ['Party', 'Interativo'],
    tags: ['mod', 'ranking ao vivo', 'tiktok'],
    releaseDate: '2024-08-01',
    popularityScore: 96,
    featured: true,
    createdAt: '2024-08-01T00:00:00Z',
    assets: [
      {
        id: 'asset-bubbles-cover',
        gameId: 'game-bubbles-tiktok',
        kind: 'cover',
        url: '/media/bubbles-cover.svg',
        sortOrder: 0,
      },
      {
        id: 'asset-bubbles-shot-1',
        gameId: 'game-bubbles-tiktok',
        kind: 'screenshot',
        url: '/media/bubbles-screenshot.svg',
        sortOrder: 1,
      },
    ],
    upcoming: null,
  },
  {
    id: 'game-saturn-plinko',
    slug: 'saturn-plinko',
    title: 'Saturn Plinko',
    shortDescription: 'O plinko definitivo para lives, com ranking dinâmico e eventos patrocinados.',
    description:
      'Saturn Plinko coloca os espectadores no controle: cada interação gera fichas que caem na mesa e acumulam pontos, com gatilhos para combos e power-ups patrocinados. Ideal para campanhas rápidas ou maratonas de engajamento.',
    priceCents: 0,
    lifetimePriceCents: null,
    rentalDurationDays: 30,
    isLifetimeAvailable: false,
    isPublished: true,
    tiktokNotes:
      'Compatibilidade TikTok confirmada. Guia completo será publicado próximo ao lançamento.',
    status: 'coming_soon',
    genres: ['Arcade', 'Game show'],
    tags: ['em breve', 'plinko', 'ranking'],
    releaseDate: null,
    popularityScore: 88,
    featured: true,
    createdAt: '2024-09-15T00:00:00Z',
    assets: [
      {
        id: 'asset-plinko-cover',
        gameId: 'game-saturn-plinko',
        kind: 'cover',
        url: '/media/plinko-cover.svg',
        sortOrder: 0,
      },
      {
        id: 'asset-plinko-shot-1',
        gameId: 'game-saturn-plinko',
        kind: 'screenshot',
        url: '/media/plinko-screenshot.svg',
        sortOrder: 1,
      },
    ],
    upcoming: {
      id: 'upcoming-plinko',
      gameId: 'game-saturn-plinko',
      releaseDate: null,
      notifyList: [],
    },
  },
  {
    id: 'game-saturn-cleaner',
    slug: 'saturn-cleaner',
    title: 'Saturn Cleaner',
    shortDescription:
      'Cada interação da audiência derruba itens no cenário e desafia o streamer a manter o palco limpo.',
    description:
      'Saturn Cleaner combina humor com competição. Enquanto o chat suja o ambiente com novos itens, o criador precisa coordenar sua limpeza para segurar a audiência. Possui modos cooperativos, variações temáticas e indicadores de hype.',
    priceCents: 0,
    lifetimePriceCents: null,
    rentalDurationDays: 30,
    isLifetimeAvailable: false,
    isPublished: true,
    tiktokNotes: 'Detalhes de integração serão divulgados próximo ao lançamento oficial.',
    status: 'coming_soon',
    genres: ['Casual', 'Party'],
    tags: ['em breve', 'desafio', 'tiktok'],
    releaseDate: null,
    popularityScore: 82,
    featured: false,
    createdAt: '2024-10-01T00:00:00Z',
    assets: [
      {
        id: 'asset-cleaner-cover',
        gameId: 'game-saturn-cleaner',
        kind: 'cover',
        url: '/media/cleaner-cover.svg',
        sortOrder: 0,
      },
      {
        id: 'asset-cleaner-shot-1',
        gameId: 'game-saturn-cleaner',
        kind: 'screenshot',
        url: '/media/cleaner-screenshot.svg',
        sortOrder: 1,
      },
    ],
    upcoming: {
      id: 'upcoming-cleaner',
      gameId: 'game-saturn-cleaner',
      releaseDate: null,
      notifyList: [],
    },
  },
];

export default localCatalog;
