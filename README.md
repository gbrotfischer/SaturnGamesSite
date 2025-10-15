# Saturn Games Portal

Portal gamer dark focado em aluguel individual de mods e jogos criados para lives no TikTok. O projeto entrega:

- Front-end em React + Vite com rotas para Home, Catálogo, Página de Jogo, Minha Conta, FAQ, Contato e Autenticação.
- Catálogo inicial em `src/data/catalog.json` com jogos disponíveis e "em breve" (pode editar/expandir manualmente).
- Integração com Supabase (Auth + Database) para catálogo, aluguéis, compras vitalícias e notificações.
- Checkout Stripe pronto para redirecionar o usuário ao pagamento seguro e registrar o aluguel após a confirmação.
- Página de sucesso dedicada valida o `session_id` retornado pelo Stripe e mostra o status do acesso ao jogo.

## Stack principal

- React 18 + React Router
- TypeScript, CSS moderno (tema dark gamer)
- Supabase (`@supabase/supabase-js`)
- Stripe Checkout (integração via endpoints `/api/create-checkout-session` e `/api/check-payment-status`)
- Cloudflare Pages (deploy estático do front)

## Catálogo base (demo)

- `src/data/catalog.json` carrega três jogos exemplo:
  - **Bubbles TikTok** (aluguel ativo, já com preço e screenshots)
  - **Saturn Plinko** (em breve)
  - **Saturn Cleaner** (em breve)
- Ao rodar sem Supabase configurado, o front-end usa automaticamente esse catálogo local.
- Quando o Supabase estiver pronto, basta popular as tabelas `games`/`game_assets` que o site troca para os dados reais.
- Atualize imagens editando os SVGs em `public/media/` ou apontando para URLs públicas próprias.

## Variáveis de ambiente

### Front-end (`.env` ou variáveis do Pages)

| Nome | Descrição |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` do Supabase |
| `VITE_TURNSTILE_SITE_KEY` | (Opcional) site key do Cloudflare Turnstile para o formulário do SAC |
| `VITE_STRIPE_PUBLISHABLE_KEY` | (Opcional) chave pública do Stripe para integrações futuras |

### Supabase Edge Functions (`supabase secrets set`)

| Nome | Descrição |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Necessária para inserir/atualizar `checkout_sessions` e `rentals` |
| `STRIPE_SECRET_KEY` | Chave secreta da API do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint de webhook do Stripe |

## Rodando localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

O bundle final ficará em `dist/`.

## Supabase

1. Crie um projeto em [app.supabase.com](https://app.supabase.com) e anote `Project URL`, `anon key` e `service_role`.
2. No SQL Editor, execute `db/schema.sql` para criar as tabelas:
   - `games`, `game_assets`, `rentals`, `purchases`, `releases_upcoming`, `tickets_support`, `user_notifications`, `checkout_sessions`.
3. Configure RLS conforme a sua política (ex.: permitir que usuários autenticados leiam apenas seus aluguéis). O esquema fornece `text[]` para tags/gêneros e constraints para evitar duplicidade.
4. (Opcional) adicione triggers/jobs para marcar aluguéis expirados ou enviar notificações.
5. Sem Supabase configurado, o portal funciona em modo demo usando o catálogo local (auth e pagamentos ficam desativados).

## Cloudflare Pages (frontend)

1. **Create project** → conecte o repositório.
2. Build command `npm run build`, output `dist`, Node 18.
3. Cadastre as variáveis listadas em [Variáveis de ambiente](#variáveis-de-ambiente).
4. Após o primeiro deploy, associe `www.saturngames.win` em **Custom domains** e configure redirecionamento do domínio raiz.

## Endpoints de pagamento

O front-end consome três endpoints HTTP expostos pelo backend (Cloudflare Worker, Supabase Edge Function ou outra plataforma de sua escolha):

1. **`POST /api/create-checkout-session`**
   - Request: `{ gameId, priceId, userId, email, mode }`.
   - Resposta esperada: `{ sessionId, url, expiresAt? }` com a URL pública do Stripe Checkout.
   - O backend deve criar/atualizar `checkout_sessions` e armazenar o `session_id` para reconciliar o webhook do Stripe.
2. **`GET /api/check-payment-status?session_id=...`**
   - Verifica o status da sessão no Stripe e retorna `{ success, paymentStatus, accessActive?, expiresAt?, gameId? }`.
   - Usado na página de sucesso para exibir a confirmação ao usuário.
3. **`GET /api/user/games`** *(opcional)*
   - Retorna os jogos liberados para o usuário logado (aluguel ativo ou compra vitalícia).
   - Facilita mostrar a biblioteca resumida no dashboard.

Implemente os webhooks do Stripe (`checkout.session.completed`, `invoice.payment_succeeded`, etc.) para atualizar `checkout_sessions` e criar/estender registros em `rentals` assim que o pagamento for confirmado.

## Fluxo de pagamentos

1. O usuário clica em “Comprar acesso” ou “Renovar”. O front chama `POST /api/create-checkout-session` enviando `{ gameId, priceId, userId, email, mode }`.
2. O backend cria/atualiza `checkout_sessions`, gera a sessão no Stripe e devolve `{ sessionId, url }`.
3. O front salva `sessionId` em `sessionStorage` (`checkout_pending`) e redireciona para a URL do Stripe.
4. Após o pagamento, o Stripe redireciona para `/success?session_id=...`. A página consulta `GET /api/check-payment-status` e exibe o status.
5. O webhook do Stripe cria/estende o aluguel na tabela `rentals`. A tela Minha Conta / Biblioteca mostra o jogo assim que o registro está ativo.

## Estrutura de diretórios

```
├── src
│   ├── App.tsx
│   ├── components/ (Header, Footer, GameCard, AuthContext)
│   ├── data/catalog.json (catálogo base usado como fallback)
│   ├── hooks/useCheckout.ts
│   ├── lib/ (api.ts, env.ts, supabaseClient.ts)
│   ├── pages/ (HomePage, LibraryPage, GamePage, AccountPage, CheckoutSuccessPage, ContactPage, FaqPage, AuthPage, NotFoundPage)
│   ├── styles/global.css
│   ├── types/ (tipos de domínio)
│   └── utils/ (formatCurrency, helpers de data)
├── db/schema.sql (DDL das tabelas)
├── public/ (assets estáticos)
└── README.md
```

## Checklist antes do go-live

- [ ] Variáveis de ambiente configuradas no Pages e no backend responsável pelo Stripe.
- [ ] Tabelas do Supabase criadas via `db/schema.sql` e policies ajustadas.
- [ ] Endpoints `/api/create-checkout-session` e `/api/check-payment-status` publicados e conectados ao Stripe.
- [ ] Fluxo completo validado: login → selecionar jogo → redirecionar ao Stripe → pagamento confirmado → aluguel ativo no Supabase.
- [ ] SAC enviando ticket e recebendo resposta `ticketId`.
- [ ] Biblioteca/Minha Conta refletindo aluguéis ativos e preferências.
- [ ] Links de políticas e seção de segurança no rodapé revisados.

## Scripts úteis

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
```

Em ambientes sem acesso ao registry npm, faça o build localmente e publique os arquivos gerados.
