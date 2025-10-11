import './Footer.css';

const Footer = () => {
  return (
    <footer className="sg-footer">
      <div className="sg-footer__inner">
        <p>© {new Date().getFullYear()} Saturn Games. Todos os direitos reservados.</p>
        <div className="sg-footer__links">
          <a href="mailto:contato@saturngames.win">Contato</a>
          <a href="https://status.saturngames.win" target="_blank" rel="noreferrer">
            Status
          </a>
          <a href="https://supabase.com/docs" target="_blank" rel="noreferrer">
            Supabase Docs
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
