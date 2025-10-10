import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../components/AuthContext';

import './DashboardPage.css';

type License = {
  id: number;
  email: string;
  expires_at: string | null;
  active: boolean | null;
};

const DashboardPage = () => {
  const { user, refreshSession } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLicense() {
      if (!user) return;
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('licenses')
        .select('*')
        .maybeSingle();
      if (queryError) {
        setError(queryError.message);
      } else {
        setLicense(data);
      }
      setLoading(false);
    }

    loadLicense();
  }, [user]);

  const isActive = Boolean(license?.active) && !!license?.expires_at && new Date(license.expires_at) > new Date();

  const expiresAtFormatted = license?.expires_at
    ? format(new Date(license.expires_at), "dd 'de' MMMM 'de' yyyy HH:mm")
    : 'Sem data cadastrada';

  async function handleRefresh() {
    await refreshSession();
    const { data } = await supabase.from('licenses').select('*').maybeSingle();
    setLicense(data);
  }

  return (
    <div className="dashboard">
      <section className="dashboard__card">
        <h1>Olá, {user?.email}</h1>
        <p>
          Aqui você acompanha o status da sua assinatura. Se algo estiver errado, entre em contato
          com nosso suporte.
        </p>

        {loading && <p>Carregando licença…</p>}
        {error && <p className="dashboard__error">{error}</p>}

        {license && !loading && (
          <div className="dashboard__status">
            <div>
              <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                {isActive ? 'Licença ativa' : 'Licença inativa'}
              </span>
              <p>Expira em: {expiresAtFormatted}</p>
            </div>
            <button className="dashboard__refresh" onClick={handleRefresh}>
              Atualizar dados
            </button>
          </div>
        )}

        <div className="dashboard__actions">
          <a className="dashboard__primary" href="https://launcher.saturngames.win/download">
            Baixar launcher
          </a>
          {isActive ? (
            <a className="dashboard__secondary" href="saturn-launcher://open">
              Abrir launcher
            </a>
          ) : (
            <a className="dashboard__secondary" href="/assine">
              Renovar assinatura
            </a>
          )}
        </div>
      </section>

      <section className="dashboard__info">
        <h2>Fluxo completo</h2>
        <ul>
          <li>
            Os pagamentos confirmados via OpenPix disparam um webhook hospedado no Cloudflare Workers
            em <code>https://api.saturngames.win/webhooks/openpix</code>.
          </li>
          <li>
            O webhook valida a assinatura do evento e chama a função RPC
            <code>payment_add_one_month_to_license</code> no Supabase usando a chave <em>service_role</em>.
          </li>
          <li>
            Após a atualização, você pode clicar em “Atualizar dados” para sincronizar sua licença.
          </li>
        </ul>
      </section>
    </div>
  );
};

export default DashboardPage;
