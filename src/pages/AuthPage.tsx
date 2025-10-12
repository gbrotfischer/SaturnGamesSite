import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabaseClient';
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

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' }
  });

  async function onSubmit(values: AuthForm) {
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
    } catch (err: any) {
      setMessage(err.message ?? 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
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
          <button type="submit" disabled={loading} className="auth__submit">
            {loading ? 'Processando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth__divider">
          <span>ou</span>
        </div>

        <button className="auth__google" onClick={signInWithGoogle} type="button">
          Entrar com Google
        </button>

        {message && <p className="auth__message">{message}</p>}
      </div>
    </div>
  );
};

export default AuthPage;
