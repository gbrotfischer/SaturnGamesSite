import { Link } from 'react-router-dom';

import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="notfound">
      <h1>404</h1>
      <p>Ops! A página que você procura não existe.</p>
      <Link to="/">Voltar para o início</Link>
    </div>
  );
};

export default NotFoundPage;
