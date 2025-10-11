# Saturn Games Portal

Portal web para autenticação, gestão de assinaturas e geração de pagamentos Pix para o ecossistema Saturn Games. Desenvolvido com React + Vite e integrado ao Supabase e OpenPix, pensado para ser publicado em Cloudflare Pages com suporte a um Worker para webhooks.

## Requisitos

- Node.js 18+
- Variáveis de ambiente em tempo de build/execução:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_OPENPIX_WORKER_URL` (URL pública do Worker que cria cobranças)
  - `VITE_OPENPIX_APP_ID` (opcional, encaminhado no header `x-openpix-app-id`)

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
| `VITE_OPENPIX_WORKER_URL` | URL pública do Worker que criará cobranças (ex.: `https://api.saturngames.win/charges`) | Worker configurado abaixo |
| `VITE_OPENPIX_APP_ID` | (Opcional) ID da aplicação cadastrado na OpenPix | Painel OpenPix |

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
3. Substitua o código padrão por uma função que:
   - Valide o `x-openpix-signature` (ou o mecanismo do provedor escolhido).
   - Consulte o Supabase usando `SUPABASE_SERVICE_ROLE_KEY` e chame a RPC `payment_add_one_month_to_license`.
   - Retorne `200` quando a cobrança for processada.
4. Em **Settings → Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENPIX_SECRET_KEY` (token da OpenPix para gerar cobranças ou validar webhooks)
   - Qualquer outra configuração (ex.: `LOG_LEVEL`).
5. Em **Triggers → Routes**, crie uma rota como `api.saturngames.win/*` associada ao Worker.
6. No DNS do Cloudflare, crie um registro CNAME ou AAAA para `api.saturngames.win` apontando para o Worker (o assistente oferece a opção automaticamente).
7. Publique o Worker e copie a URL final, por exemplo `https://api.saturngames.win/charges` (usada pelo frontend) e `https://api.saturngames.win/webhooks/openpix` (usada pelo webhook).

> Se preferir, mantenha o Worker separado: um endpoint `/charges` para o frontend criar pagamentos e outro `/webhooks/openpix` para receber confirmações.

## Passo a passo: configurar a OpenPix

1. **Criar conta** – acesse [app.openpix.com.br](https://app.openpix.com.br) e registre uma conta empresarial.
2. **Criar uma aplicação** – no menu *Integrações → Aplicações*, clique em **Nova aplicação** e anote:
   - `APP_ID` (usado pelo frontend via `VITE_OPENPIX_APP_ID`, opcional).
   - `API_KEY` ou `SECRET_KEY` (usado no Worker para autenticação ao criar cobranças).
3. **Configurar Webhook** – ainda na aplicação, informe a URL do Worker que receberá confirmações, ex.: `https://api.saturngames.win/webhooks/openpix`.
4. **Definir eventos** – marque os eventos relevantes (por exemplo, `charge.completed`, `charge.expired`).
5. **Testar webhook** – use o botão **Enviar teste** no painel da OpenPix. Confira os logs do Worker (Cloudflare → Workers → Logs) para garantir que a requisição chega e a RPC é executada sem erros.
6. **Habilitar modo produção** – se iniciou em modo sandbox, solicite habilitação para ambiente real quando estiver pronto.

### Criar cobranças a partir do Worker

1. O frontend chama `POST https://api.saturngames.win/charges` com os dados do plano (valor, descrição, e-mail do cliente).
2. O Worker faz `fetch` para `https://api.openpix.com.br/api/openpix/charge` com o `OPENPIX_SECRET_KEY`.
3. A resposta contém o `brCode` e o link do Pix Copia e Cola, que o frontend mostra ao usuário.
4. Quando o pagamento confirmar, a OpenPix chama o webhook configurado, que por sua vez atualiza a licença no Supabase.

## Checklist final antes de liberar

- [ ] Cloudflare Pages conectado ao repositório e com variáveis de ambiente definidas.
- [ ] Domínio `www.saturngames.win` apontando para o Pages e redirecionamento configurado para o apex.
- [ ] Worker publicado em `api.saturngames.win` com variáveis seguras e logs funcionando.
- [ ] Webhook da OpenPix apontando para o Worker e testado.
- [ ] RPC `payment_add_one_month_to_license` retornando 200 durante os testes.
- [ ] Usuário de teste conseguindo logar e visualizar o status da licença no dashboard.

## Estrutura principal

- `src/App.tsx` – Configuração das rotas e layout geral.
- `src/components/AuthContext.tsx` – Provider que sincroniza a sessão Supabase no frontend.
- `src/pages/` – Páginas (landing, autenticação, dashboard, assinatura, FAQ).
- `src/lib/` – Cliente Supabase e utilitários de ambiente.
- `src/utils/` – Funções auxiliares (ex.: formatação de moeda).

## Integrações

- **Supabase**: autenticação (e-mail/senha, Google) e leitura da tabela `public.licenses` protegida por RLS.
- **OpenPix**: geração de cobranças via chamada ao Worker (endpoint `/charges`).
- **Cloudflare Workers**: responsável por receber webhooks da OpenPix e chamar a RPC `payment_add_one_month_to_license` usando a `service_role`.

## Próximos passos sugeridos

- Implementar o Worker/Backend descrito na documentação técnica para processar webhooks.
- Conectar o launcher para abrir `https://saturngames.win/assine` quando a licença estiver inativa.
- Configurar DNS no Cloudflare para `www.saturngames.win` (site) e `api.saturngames.win` (webhook/REST).
