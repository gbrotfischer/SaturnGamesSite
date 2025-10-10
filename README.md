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

## Deploy no Cloudflare Pages

1. Configure um novo projeto no Cloudflare Pages apontando para este repositório.
2. Defina as variáveis de ambiente acima no painel do Pages.
3. Use os comandos padrão: `npm install`, `npm run build`, diretório de saída `dist`.
4. Opcional: configure um Worker em `api.saturngames.win` para processar webhooks da OpenPix.

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
