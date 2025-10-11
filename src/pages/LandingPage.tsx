import { Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

import './LandingPage.css';

const LandingPage = () => {
  const { user } = useAuth();

  return (
    <div className="landing">
      <section className="landing__hero">
        <h1>A nova casa dos seus jogos indies favoritos</h1>
        <p>
          Saturn Games é o portal oficial para gerenciar sua assinatura, baixar o launcher e
          desbloquear conteúdos exclusivos. Integração total com Supabase e pagamentos via Pix.
        </p>
        <div className="landing__actions">
          <Link to={user ? '/dashboard' : '/entrar'} className="landing__cta">
            {user ? 'Ir para minha conta' : 'Criar conta agora'}
          </Link>
          <Link to="/assine" className="landing__secondary">
            Ver planos
          </Link>
        </div>
      </section>

      <section className="landing__grid">
        <article>
          <h2>Login seguro</h2>
          <p>
            Use Supabase Auth com e-mail, senha ou Google. Tokens atualizados automaticamente e
            proteção com Row Level Security.
          </p>
        </article>
        <article>
          <h2>Pagamento transparente</h2>
          <p>
            Geração instantânea de QR Code e copia e cola Pix via integração com OpenPix hospedada em
            Cloudflare Workers.
          </p>
        </article>
        <article>
          <h2>Launcher sempre atualizado</h2>
          <p>
            Se a licença expirar, o launcher redireciona para saturngames.win/assine para você renovar
            em poucos cliques.
          </p>
        </article>
      </section>

      <section className="landing__steps">
        <h2>Como funciona</h2>
        <ol>
          <li>Crie sua conta com Supabase Auth.</li>
          <li>Escolha um plano e gere o Pix no portal.</li>
          <li>Após a confirmação, o webhook atualiza sua licença no Supabase.</li>
          <li>Abra o launcher e jogue. Simples assim.</li>
        </ol>
      </section>
    </div>
  );
};

export default LandingPage;
