# Saturn Games Portal

Portal gamer dark focado em aluguel individual de mods e jogos criados para lives no TikTok. O projeto entrega:

- Front-end em React + Vite com rotas para Home, Catálogo, Página de Jogo, Minha Conta, FAQ, Contato e Autenticação.
- Catálogo inicial em `src/data/catalog.json` com jogos disponíveis e "em breve" (pode editar/expandir manualmente).
- Integração com Supabase (Auth + Database) para catálogo, aluguéis, compras vitalícias e notificações.
- Cobranças Pix geradas pela Edge Function `openpix-create-session` do Supabase, com QR code exibido no modal nativo do portal.
- Webhook `openpix-webhook` (Edge Function) atualiza licenças e aluguéis assim que a OpenPix confirma o pagamento.

## Stack principal

- React 18 + React Router
- TypeScript, CSS moderno (tema dark gamer)
- Supabase (`@supabase/supabase-js`)
- Supabase Edge Functions (`openpix-create-session`, `openpix-webhook`)
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

### Supabase Edge Functions (`supabase secrets set`)

| Nome | Descrição |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Necessária para inserir/atualizar `checkout_sessions` e `rentals` |
| `OPENPIX_APP_ID` | AppID da integração criada na OpenPix |
| `OPENPIX_API_KEY` | Chave privada da OpenPix para gerar cobranças |
| `OPENPIX_WEBHOOK_SECRET` | (Opcional) segredo para validar a assinatura do webhook |

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

## Supabase Edge Functions

O projeto assume duas funções implantadas no Supabase:

1. **`openpix-create-session`** — recebe `{ user_id, email, game_id, amount, mode, rental_duration_days }` e:
   - cria um registro em `checkout_sessions` com `session_id = correlation_id`;
   - chama a API da OpenPix para gerar a cobrança (ou retorna placeholder no sandbox);
   - devolve `{ ok: true, session, openpix }` onde `openpix.qrCodeImage` e `openpix.paymentLinkUrl` são usados no modal.
2. **`openpix-webhook`** — processa eventos `OPENPIX:TRANSACTION_RECEIVED`:
   - armazena o payload em `openpix_webhook_events` (para auditoria);
   - marca `checkout_sessions.status = 'paid'` e registra `payment_ref`;
   - cria/estende `rentals` (ou `purchases` para modo vitalício) e dispara broadcasts Realtime opcionais.

> Consulte a documentação interna do backend para publicar essas funções via `supabase functions deploy`.

## Fluxo de pagamentos

1. O front chama `supabase.functions.invoke('openpix-create-session')` passando `game_id`, `mode`, `user_id` e `email`.
2. A função cria o registro em `checkout_sessions`, gera (ou solicita) o QR code na OpenPix e devolve `session_id`, `correlation_id`, `amount_cents` e opcionalmente `openpix.qrCodeImage`/`paymentLinkUrl`.
3. O modal `CheckoutModal` exibe o QR/code link e inicia polling em `checkout_sessions?session_id=...` até `status === 'paid'` ou `expires_at` expirar. Quando pago, consulta `rentals` para confirmar a liberação.
4. A função `openpix-webhook` processa o evento da OpenPix, marca a sessão como paga e cria/estende o aluguel (ou compra vitalícia). Opcionalmente emite broadcast Realtime.
5. Assim que o front detecta a mudança (via polling ou broadcast), mostra o sucesso e atualiza a biblioteca/minha conta.

## Estrutura de diretórios

```
├── src
│   ├── App.tsx
│   ├── components/ (Header, Footer, GameCard, AuthContext)
│   ├── data/catalog.json (catálogo base usado como fallback)
│   ├── hooks/useCheckout.ts
│   ├── lib/ (api.ts, env.ts, supabaseClient.ts)
│   ├── pages/ (HomePage, LibraryPage, GamePage, AccountPage, ContactPage, FaqPage, AuthPage, NotFoundPage)
│   ├── styles/global.css
│   ├── types/ (tipos de domínio)
│   └── utils/ (formatCurrency, helpers de data)
├── db/schema.sql (DDL das tabelas)
├── public/ (assets estáticos)
├── worker/ (legado opcional caso opte por Cloudflare Workers)
└── README.md
```

## Checklist antes do go-live

- [ ] Variáveis de ambiente configuradas no Pages e nas Edge Functions do Supabase.
- [ ] Tabelas do Supabase criadas via `db/schema.sql` e policies ajustadas.
- [ ] Funções `openpix-create-session` e `openpix-webhook` implantadas e testadas com evento da OpenPix.
- [ ] Fluxo completo validado: login → selecionar jogo → gerar cobrança → confirmar pagamento → Supabase atualiza aluguel.
- [ ] SAC enviando ticket e recebendo resposta `ticketId`.
- [ ] Biblioteca/Minha Conta refletindo aluguéis ativos e preferências.
- [ ] Links de políticas e seção de segurança no rodapé revisados.

## Scripts úteis

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
```

Em ambientes sem acesso ao registry npm, faça o build localmente e publique os arquivos gerados.
