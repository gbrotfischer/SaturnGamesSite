import './Footer.css';

const currentYear = new Date().getFullYear();

const Footer = () => {
  return (
    <footer className="sg-footer">
      <div className="sg-footer__inner">
        <div className="sg-footer__brand">
          <div className="sg-footer__logo" aria-hidden>
            🪐
          </div>
          <div>
            <strong>Saturn Games</strong>
            <p>Locadora gamer especializada em experiências para TikTok com total segurança.</p>
          </div>
        </div>

        <div className="sg-footer__grid">
          <div>
            <h4>Legal</h4>
            <ul>
              <li>
                <a href="/termos" rel="nofollow">
                  Termos de uso
                </a>
              </li>
              <li>
                <a href="/privacidade" rel="nofollow">
                  Política de privacidade
                </a>
              </li>
              <li>
                <a href="/reembolso" rel="nofollow">
                  Política de reembolso
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Suporte</h4>
            <ul>
              <li>
                <a href="mailto:support@saturngames.win">support@saturngames.win</a>
              </li>
              <li>
                <a href="/sac">Central de ajuda</a>
              </li>
              <li>
                <a href="https://status.saturngames.win" target="_blank" rel="noreferrer">
                  Status em tempo real
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Segurança</h4>
            <ul className="sg-footer__badges">
              <li>🔐 Dados criptografados</li>
              <li>💳 Pagamentos protegidos</li>
              <li>🛡️ Cloudflare Shield</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sg-footer__bottom">
        <p>© {currentYear} Saturn Games. Todos os direitos reservados.</p>
        <p className="sg-footer__compliance">
          Operamos com Supabase, Cloudflare e OpenPix para autenticação, hospedagem e pagamentos.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
