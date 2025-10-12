# Saturn Games Portal

Portal gamer dark focado em aluguel individual de mods e jogos criados para lives no TikTok. O projeto entrega:

- Front-end em React + Vite com rotas para Home, Catálogo, Página de Jogo, Minha Conta, SAC e Autenticação.
- Integração com Supabase (Auth + Database) para catálogo, aluguéis, compras vitalícias e notificações.
- Cobranças Pix via plugin oficial da OpenPix com sessões geradas por um Worker no Cloudflare.
- Worker que expõe endpoints REST (`/api/checkout/session`, `/api/support/ticket`, `/api/notify/upcoming`, `/api/account/preferences`) e processa webhooks de pagamento.

## Stack principal

- React 18 + React Router
- TypeScript, CSS moderno (tema dark gamer)
- Supabase (`@supabase/supabase-js`)
- OpenPix plugin (`https://plugin.woovi.com/v1/woovi.js`)
- Cloudflare Pages (front) + Cloudflare Workers (backend edge)

## Variáveis de ambiente

### Front-end (`.env` ou variáveis do Pages)

| Nome | Descrição |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` do Supabase |
| `VITE_OPENPIX_APP_ID` | AppID da sua aplicação na OpenPix (para o plugin) |
| `VITE_API_BASE_URL` | URL pública do Worker (ex.: `https://api.saturngames.win`) |
| `VITE_TURNSTILE_SITE_KEY` | (Opcional) site key do Cloudflare Turnstile para o formulário do SAC |

### Worker (`wrangler secrets put` ou painel do Cloudflare)

| Nome | Descrição |
| --- | --- |
| `SUPABASE_URL` | Mesmo `Project URL` usado no frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` (nunca expor no frontend) |
| `SUPABASE_ANON_KEY` | Chave `anon` (necessária para validar o token do usuário) |
| `OPENPIX_WEBHOOK_SECRET` | (Opcional) segredo exibido ao criar o webhook na OpenPix |
| `OPENPIX_APP_ID` | (Opcional) AppID, útil para logs no Worker |
| `CORS_ALLOW_ORIGIN` | Domínio autorizado (ex.: `https://www.saturngames.win`) |

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

## Cloudflare Pages (frontend)

1. **Create project** → conecte o repositório.
2. Build command `npm run build`, output `dist`, Node 18.
3. Cadastre as variáveis listadas em [Variáveis de ambiente](#variáveis-de-ambiente).
4. Após o primeiro deploy, associe `www.saturngames.win` em **Custom domains** e configure redirecionamento do domínio raiz.

## Cloudflare Worker (backend)

1. Crie um Worker (modo **Modules**) e copie `worker/src/index.ts` para o editor (ou use `npx wrangler deploy`).
2. Defina as variáveis (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, etc.).
3. Configure a rota `api.saturngames.win/*` em **Triggers → Routes** e deixe apenas um registro DNS CNAME apontando para `<worker>.workers.dev` (proxy laranja ativo). Isso evita o erro **1016**.
4. Teste:
   - `GET https://api.saturngames.win/` → status geral do Worker.
   - `GET https://api.saturngames.win/healthz` → responde `ok`.
   - `POST https://api.saturngames.win/api/checkout/session` com token Supabase válido → cria uma sessão.
   - `POST https://api.saturngames.win/webhooks/openpix` (via evento de teste da OpenPix) → atualiza aluguéis/compras.

### Endpoints do Worker

| Método | Caminho | Descrição |
| --- | --- | --- |
| `POST` | `/api/checkout/session` | Gera `correlationId` e registra sessão antes de abrir o modal OpenPix |
| `POST` | `/api/support/ticket` | Cria ticket de SAC (autenticado opcional) |
| `POST` | `/api/notify/upcoming` | Inscreve usuário/e-mail na lista “em breve” |
| `POST` | `/api/account/preferences` | Salva preferências de notificação do usuário |
| `POST` | `/webhooks/openpix` | Processa confirmações de pagamento e atualiza Supabase |

Todos respondem JSON com CORS liberado para o domínio configurado.

## Fluxo de pagamentos

1. Front-end chama `POST /api/checkout/session` informando `gameId` e `mode` (`rental` ou `lifetime`). O Worker valida o token Supabase, consulta o jogo e retorna `correlationId`, valor e duração.
2. O React dispara `window.$openpix.push(['pix', ...])` usando o `correlationId`. O modal oficial mostra QR Code / Pix Copia e Cola.
3. Quando a OpenPix envia `OPENPIX:TRANSACTION_RECEIVED`/`CHARGE_COMPLETED`, o Worker valida a assinatura (se houver `OPENPIX_WEBHOOK_SECRET`), encontra a sessão e:
   - Atualiza `checkout_sessions.status` para `paid`.
   - Cria/estende `rentals` somando `rental_duration_days` ao vencimento atual.
   - Ou registra `purchases` em caso de compra vitalícia.
4. O front-end escuta eventos do plugin para informar “Pagamento confirmado” enquanto aguarda a atualização do Supabase.

## OpenPix (plugin)

- `index.html` já injeta `<script src="https://plugin.woovi.com/v1/woovi.js" async></script>`.
- `useOpenPixCheckout` centraliza a comunicação com o plugin (status `awaiting`, `completed`, etc.).
- `VITE_OPENPIX_APP_ID` deve ser o AppID da aplicação criada em [app.openpix.com.br](https://app.openpix.com.br).
- Para criar o webhook: vá em **Integrações → Aplicações → Webhooks**, informe `https://api.saturngames.win/webhooks/openpix`, copie o segredo e salve como `OPENPIX_WEBHOOK_SECRET` no Worker.

## Estrutura de diretórios

```
├── src
│   ├── App.tsx
│   ├── components/ (Header, Footer, GameCard, AuthContext)
│   ├── hooks/useOpenPixCheckout.ts
│   ├── lib/ (api.ts, env.ts, supabaseClient.ts)
│   ├── pages/ (HomePage, LibraryPage, GamePage, AccountPage, SupportPage, AuthPage, NotFoundPage)
│   ├── styles/global.css
│   ├── types/ (tipos de domínio)
│   └── utils/ (formatCurrency, helpers de data)
├── worker/
│   ├── src/index.ts (Worker de APIs + webhook)
│   └── wrangler.toml
├── db/schema.sql (DDL das tabelas)
├── public/ (assets estáticos)
└── README.md
```

## Checklist antes do go-live

- [ ] Variáveis de ambiente configuradas em Pages e Worker.
- [ ] Tabelas do Supabase criadas via `db/schema.sql` e policies ajustadas.
- [ ] Webhook da OpenPix apontando para o Worker e testado com evento de teste.
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
