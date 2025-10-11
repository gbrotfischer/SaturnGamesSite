# Saturn Games Portal

Portal web para autenticação, gestão de assinaturas e geração de pagamentos Pix para o ecossistema Saturn Games. Desenvolvido com React + Vite e integrado ao Supabase e OpenPix, pensado para ser publicado em Cloudflare Pages com suporte a um Worker para webhooks.

## Requisitos

- Node.js 18+
- Variáveis de ambiente em tempo de build/execução:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_OPENPIX_APP_ID` (AppID da sua aplicação na OpenPix, usado pelo plugin do frontend)

## Desenvolvimento local

Instale as dependências e execute o servidor dev:

```bash
npm install
npm run dev
```

> Observação: alguns ambientes restritos podem bloquear o download de dependências do npm. Caso isso ocorra, execute os comandos em uma máquina com acesso liberado e suba o build para o repositório.

## Build

```bash
npm run build
```

Os arquivos de produção serão gerados em `dist/`.

## Passo a passo: preparar o Supabase

1. **Criar o projeto** – acesse [app.supabase.com](https://app.supabase.com), crie um novo projeto e anote o `Project URL` e a chave `anon`.
2. **Recuperar a chave `service_role`** – em *Project Settings → API* copie a `service_role` (use apenas no backend/Worker).
3. **Importar as tabelas e a RPC** – a documentação técnica compartilhada inclui o SQL do esquema (`public.licenses`, `public.license_changes` e `payment_add_one_month_to_license`). Execute o script no SQL Editor.
4. **Configurar políticas RLS** – confirme que a policy `licenses_select_own_active_by_jwt_email` está ativa para a tabela `public.licenses`.
5. **Criar um usuário de teste** – registre manualmente um usuário pelo Supabase Auth ou via portal para validar o fluxo mais adiante.

> Esses dados alimentam as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, no Worker, `SUPABASE_SERVICE_ROLE_KEY`.

## Passo a passo: Deploy no Cloudflare Pages

### 1. Conectar o repositório

1. Entre no painel do [Cloudflare Pages](https://dash.cloudflare.com/) e clique em **Create project**.
2. Escolha **Connect to Git** e autorize o acesso ao repositório que contém este código.
3. Selecione a branch principal (por exemplo, `main`) e avance.

### 2. Definir comandos de build

1. Em **Build settings**, mantenha:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `18`
2. Confirme que o Pages executará automaticamente `npm install` antes do build.

### 3. Variáveis de ambiente

Adicione as variáveis em **Environment variables** → **Production** (repita para Preview se quiser builds de teste):

| Nome | Valor | Origem |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xyzcompany.supabase.co`) | Painel Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` | Painel Supabase |
| `VITE_OPENPIX_APP_ID` | ID da aplicação cadastrado na OpenPix (necessário para o plugin) | Painel OpenPix |

### 4. Conectar domínio

1. Depois do primeiro deploy, vá em **Pages → Custom domains** e aponte `www.saturngames.win` para o projeto.
2. Siga o assistente de DNS: a Cloudflare criará os registros necessários automaticamente quando o domínio estiver delegado para ela.
3. Configure um redirecionamento (Page Rule) de `saturngames.win` → `https://www.saturngames.win` para evitar conteúdo duplicado.

### 5. Publicar

1. Clique em **Save and deploy**. O Cloudflare Pages executará o build e publicará o site.
2. Aguarde a propagação de DNS (geralmente minutos). Você já pode acessar `https://www.saturngames.win`.

## Passo a passo: criar o Worker para OpenPix

1. No painel Cloudflare, acesse **Workers & Pages → Overview → Create application**.
2. Escolha **Create Worker** e dê um nome (ex.: `openpix-webhook`).
3. Abra o editor e substitua o código padrão pelo conteúdo de `worker/src/index.ts` deste repositório. O arquivo está em JavaScript padrão (módulos) para ser colado diretamente no painel. Caso prefira CLI, use `npx wrangler deploy worker/src/index.ts`.
4. Na barra lateral do editor, defina o modo **Modules** (ícone de engrenagem → "Worker type" → **Modules**) — esse modo é necessário para receber as variáveis de ambiente.
5. Em **Settings → Variables**, adicione:
   - `SUPABASE_URL` – URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` – chave `service_role` (adicione como **Encrypted**).
   - (Opcional) `OPENPIX_WEBHOOK_SECRET` – segredo exibido ao criar o webhook na OpenPix. Se ainda não possuir, deixe vazio; o Worker aceitará requisições sem validar assinatura.
   - (Opcional) `CORS_ALLOW_ORIGIN` – domínio autorizado a fazer chamadas (`https://www.saturngames.win`).
6. Em **Triggers → Routes**, crie uma rota como `api.saturngames.win/*` associada ao Worker.
7. No DNS do Cloudflare, adicione o subdomínio `api.saturngames.win` apontando para o Worker (o assistente oferece criar automaticamente após salvar a rota).
8. Publique o Worker e teste acessando `https://api.saturngames.win/` — a resposta trará `status`, `supabaseConfigured` e `secretConfigured`. A URL de webhook será `https://api.saturngames.win/webhooks/openpix` e o atalho de saúde simples `https://api.saturngames.win/healthz` devolve `ok`.

> Este Worker trata apenas os webhooks da OpenPix e chama o Supabase. A criação da cobrança ocorre exclusivamente no frontend via plugin oficial.

> Referência rápida: o diretório `worker/` contém um `wrangler.toml` básico e o código pronto para colar no editor do Cloudflare ou publicar via `npx wrangler deploy`.

### Entendendo a tela de Configurações do Worker

Ao abrir o Worker recém-criado, você verá abas como na captura enviada:

- **Visão geral** mostra o estado do deploy mais recente.
- **Domínios e rotas** é onde você associa o Worker a um domínio público. Clique em **Adicionar rota** e informe, por exemplo, `api.saturngames.win/*`. O Cloudflare criará automaticamente o registro DNS quando o domínio estiver na sua conta.
- **Variáveis e segredos** é o formulário onde você adiciona as chaves que o Worker usará. Clique em **Adicionar** e cadastre cada item:
  - `SUPABASE_URL` → URL do projeto Supabase.
  - `SUPABASE_SERVICE_ROLE_KEY` → chave `service_role` (use a opção **Valor criptografado** para segredos).
  - (Opcional) `OPENPIX_WEBHOOK_SECRET` → segredo fornecido pela OpenPix para validar o header `x-openpix-signature`.
  - (Opcional) `CORS_ALLOW_ORIGIN` → domínio autorizado a chamar o Worker.
- **Disparar eventos** só é usado para agendar tarefas em background; você pode deixar desativado caso não precise de CRON.
- **Logs do Workers** permite ativar a coleta de logs em tempo real. Em produção, vale habilitar para depurar webhooks.

Depois de configurar variáveis e rotas, clique em **Deploy**. Na parte superior da página o Cloudflare mostrará a URL pública (`https://<worker>.workers.dev/...`) — use-a para testar até concluir a configuração do domínio personalizado.

## Passo a passo: ativar o plugin da OpenPix no frontend

1. Abra `index.html` e confirme que o script do plugin está presente:<br>`<script src="https://plugin.woovi.com/v1/woovi.js" async></script>`.
2. Garanta que a variável `VITE_OPENPIX_APP_ID` esteja definida no Cloudflare Pages e nos ambientes locais. O AppID vem do painel da OpenPix.
3. Ao acessar `/assine`, verifique no console do navegador se aparecem os logs `[Woovi] connecting` e `[Woovi] connected`. Isso confirma que o plugin foi carregado.
4. Clique em **Abrir cobrança Pix** para disparar `window.$openpix.push(['pix', ...])`. O modal da OpenPix deve ser exibido imediatamente com QR Code e Pix Copia e Cola.
5. Use os eventos de status (já tratados em `SubscribePage.tsx`) para acompanhar se a cobrança foi paga, expirada ou fechada.

## Passo a passo: configurar a OpenPix

1. **Criar conta** – acesse [app.openpix.com.br](https://app.openpix.com.br) e registre uma conta empresarial.
2. **Criar uma aplicação** – no menu *Integrações → Aplicações*, clique em **Nova aplicação** e anote o `APP_ID`. Esse valor alimenta `VITE_OPENPIX_APP_ID` no frontend.
3. **Configurar Webhook** – dentro da mesma aplicação, abra a aba **Webhooks** e clique em **Adicionar webhook**.
   - Informe a URL `https://api.saturngames.win/webhooks/openpix` (use a URL `*.workers.dev` enquanto o domínio não estiver ativo).
   - Escolha os eventos que deseja receber (`OPENPIX:TRANSACTION_RECEIVED` já cobre confirmações de pagamento).
   - Ao salvar, a OpenPix exibirá um campo **Secret** (ou **Token**) — copie-o e cole em `OPENPIX_WEBHOOK_SECRET` nas variáveis do Worker. Caso pule esse passo, deixe o campo vazio no Worker até conseguir o segredo.
4. **Testar webhook** – utilize o botão **Enviar teste**. A resposta deve ser `200` com `{ "status": "processed" }` ou `{ "status": "ignored" ... }`. Se receber erro 401, verifique o segredo; se receber erro 500, consulte os logs do Worker.
5. **Verificar no Supabase** – após um teste bem-sucedido, confirme que a RPC `payment_add_one_month_to_license` foi executada consultando `public.licenses` ou `public.license_changes`.
6. **Habilitar modo produção** – se iniciou em modo sandbox, solicite habilitação para ambiente real quando estiver pronto.

### Criar cobranças via plugin JavaScript da OpenPix

1. O `index.html` do projeto injeta o script oficial do plugin (`https://plugin.woovi.com/v1/woovi.js`).
2. Ao carregar a página de assinatura, o componente `SubscribePage` envia `window.$openpix.push(['config', { appID: VITE_OPENPIX_APP_ID }])` para inicializar o plugin com o seu AppID.
3. Quando o usuário escolhe um plano e clica em **Abrir cobrança Pix**, o frontend gera um `correlationID` único e executa `window.$openpix.push(['pix', { value, correlationID, description, customer }])`.
4. O plugin exibe o modal oficial da OpenPix com QR Code, Pix Copia e Cola e acompanha o status em tempo real.
5. Eventos como `CHARGE_COMPLETED` e `CHARGE_EXPIRED` são capturados para atualizar a interface e orientar o cliente.

> O Worker continua necessário para processar os webhooks e liberar a licença no Supabase. A criação da cobrança, porém, ocorre totalmente no frontend via plugin.

## Checklist final antes de liberar

- [ ] Cloudflare Pages conectado ao repositório e com variáveis de ambiente definidas.
- [ ] Domínio `www.saturngames.win` apontando para o Pages e redirecionamento configurado para o apex.
- [ ] Worker publicado em `api.saturngames.win` com variáveis seguras e logs funcionando.
- [ ] Webhook da OpenPix apontando para o Worker e testado.
- [ ] Plugin da OpenPix carregando e exibindo o modal de pagamento em `/assine`.
- [ ] RPC `payment_add_one_month_to_license` retornando 200 durante os testes.
- [ ] Usuário de teste conseguindo logar e visualizar o status da licença no dashboard.

## Estrutura principal

- `src/App.tsx` – Configuração das rotas e layout geral.
- `src/components/AuthContext.tsx` – Provider que sincroniza a sessão Supabase no frontend.
- `src/pages/` – Páginas (landing, autenticação, dashboard, assinatura, FAQ).
- `src/lib/` – Cliente Supabase e utilitários de ambiente.
- `src/utils/` – Funções auxiliares (ex.: formatação de moeda).
- `worker/` – Código do Cloudflare Worker que processa webhooks da OpenPix (com endpoint opcional para criar cobranças via API).

## Integrações

- **Supabase**: autenticação (e-mail/senha, Google) e leitura da tabela `public.licenses` protegida por RLS.
- **OpenPix**: geração de cobranças direto no frontend com o plugin oficial e confirmação via webhook no Worker.
- **Cloudflare Workers**: responsável por receber webhooks da OpenPix e chamar a RPC `payment_add_one_month_to_license` usando a `service_role`.

## Próximos passos sugeridos

- Implementar o Worker/Backend descrito na documentação técnica para processar webhooks.
- Conectar o launcher para abrir `https://saturngames.win/assine` quando a licença estiver inativa.
- Configurar DNS no Cloudflare para `www.saturngames.win` (site) e `api.saturngames.win` (webhook/REST).
