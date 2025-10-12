import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient, hasSupabaseCredentials } from '../lib/supabaseClient';
import { useAuth } from '../components/AuthContext';

import './AuthPage.css';

const authSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres')
});

type AuthForm = z.infer<typeof authSchema>;

const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { refreshSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) {
      return next;
    }
    return '/minha-conta';
  }, [location.search]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' }
  });

  const supabase = getSupabaseClient();
  const authDisabled = !hasSupabaseCredentials();

  async function onSubmit(values: AuthForm) {
    if (!hasSupabaseCredentials()) {
      setMessage('Autenticação desativada neste ambiente. Configure o Supabase para habilitar o login.');
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) throw error;
        setMessage('Login realizado com sucesso!');
      } else {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/minha-conta`
          }
        });
        if (error) throw error;
        setMessage('Conta criada! Verifique seu e-mail para confirmar.');
      }
      await refreshSession();
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setMessage(err.message ?? 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setMessage(null);
    if (!hasSupabaseCredentials()) {
      setMessage('Autenticação via Google indisponível sem configurar o Supabase.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${nextPath}` },
    });
    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        {authDisabled && (
          <div className="auth__banner">
            Configure as variáveis do Supabase para habilitar o login e a criação de contas.
          </div>
        )}
        <div className="auth__tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Entrar
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="auth__form">
          <label>
            <span>E-mail</span>
            <input type="email" placeholder="voce@email.com" {...register('email')} />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label>
            <span>Senha</span>
            <input type="password" placeholder="••••••" {...register('password')} />
            {errors.password && <small>{errors.password.message}</small>}
          </label>
          <button type="submit" disabled={loading || authDisabled} className="auth__submit">
            {loading ? 'Processando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth__divider">
          <span>ou</span>
        </div>

        <button className="auth__google" onClick={signInWithGoogle} type="button" disabled={authDisabled}>
          Entrar com Google
        </button>

        {message && <p className="auth__message">{message}</p>}
      </div>
    </div>
  );
};

export default AuthPage;
