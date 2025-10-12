import './FaqPage.css';

const faqs = [
  {
    question: 'Como funciona a autenticação?',
    answer:
      'Usamos Supabase Auth. Você pode entrar com e-mail e senha ou Google. O token fica salvo no navegador para manter sua sessão.'
  },
  {
    question: 'Quando o pagamento é confirmado?',
    answer:
      'Assim que a OpenPix envia o webhook de pagamento confirmado, nosso Worker valida a assinatura e atualiza sua licença no Supabase.'
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. Basta cancelar a recorrência no seu banco. Sua licença permanecerá ativa até o fim do período atual.'
  }
];

const FaqPage = () => {
  return (
    <div className="faq">
      <h1>FAQ Saturn Games</h1>
      <p>Perguntas frequentes sobre assinatura, pagamentos e acesso.</p>
      <div className="faq__list">
        {faqs.map((faq) => (
          <article key={faq.question}>
            <h2>{faq.question}</h2>
            <p>{faq.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default FaqPage;
