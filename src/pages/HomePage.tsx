import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameCard from '../components/GameCard';
import { fetchCatalog } from '../lib/api';
import type { Game } from '../types';

import './HomePage.css';

const HomePage = () => {
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
      <section className="home__hero">
        <div className="home__hero-copy">
          <span className="home__tag">Experiência gamer premium</span>
          <h1>
            Mods e jogos originais feitos para explodir sua audiência no <strong>TikTok</strong>.
          </h1>
          <p>
            Alugue títulos individuais com acesso rápido, pagamentos Pix integrados e suporte direto da equipe
            Saturn Games.
          </p>
          <div className="home__cta">
            <button type="button" onClick={() => navigate('/jogos')}>
              Explorar jogos
            </button>
            <button type="button" onClick={() => navigate('/sac')} className="outline">
              Falar com o suporte
            </button>
          </div>
          <ul className="home__trust">
            <li>Pagamento seguro via OpenPix</li>
            <li>Autenticação Supabase</li>
            <li>Deploy protegido no Cloudflare</li>
          </ul>
        </div>
        <div className="home__hero-card" aria-hidden>
          <div className="home__hero-glow" />
          <div className="home__hero-gradient" />
          <div className="home__hero-info">
            <p>Libere novos mods em minutos com monitoramento automático de licenças.</p>
            <span>Disponível 24/7</span>
          </div>
        </div>
      </section>

      <section className="home__featured">
        <div className="home__section-header">
          <h2>Destaques da semana</h2>
          <p>Jogos que estão dominando as lives e trends no TikTok agora mesmo.</p>
        </div>
        {loading && <div className="home__loading">Carregando catálogo...</div>}
        {error && <div className="home__error">{error}</div>}
        {!loading && !error && (
          <div className="home__grid">
            {featured.map((game) => (
              <GameCard key={game.id} game={game} highlight onPrimaryAction={() => navigate(`/jogos/${game.slug}`)} />
            ))}
            {featured.length === 0 && <p>Nenhum jogo em destaque no momento. Confira o catálogo completo.</p>}
          </div>
        )}
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
