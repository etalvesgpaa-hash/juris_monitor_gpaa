# JurisMonitor — Guia de Deploy

## Pré-requisitos
- Conta no [GitHub](https://github.com)
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com)

---

## 1️⃣ Subir para o GitHub

### Opção A — Via Lovable (recomendado)
1. No Lovable, clique no nome do projeto (topo esquerdo) → **Settings**
2. Vá em **Connectors** → **GitHub** → **Connect project**
3. Autorize e crie o repositório

### Opção B — Manualmente
```bash
git init
git add .
git commit -m "JurisMonitor v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/jurismonitor.git
git push -u origin main
```

---

## 2️⃣ Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Dê o nome **JurisMonitor**, escolha região e senha
3. Aguarde o projeto ser criado
4. Vá em **SQL Editor** → **New Query**
5. Cole todo o conteúdo do arquivo `docs/supabase-schema.sql`
6. Clique **Run** — todas as tabelas serão criadas

### Copie as credenciais:
- Vá em **Settings** → **API**
- Copie:
  - **Project URL** → `VITE_SUPABASE_URL`
  - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### Configure a autenticação:
- **Authentication** → **URL Configuration**
- Adicione seu domínio Vercel em **Redirect URLs**:
  - `https://seu-app.vercel.app`
  - `https://seu-app.vercel.app/reset-password`

---

## 3️⃣ Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub
3. Configure:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Variáveis de ambiente (Environment Variables):

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `EMAIL_USER` | Seu e-mail Gmail |
| `EMAIL_PASS` | Senha de app do Gmail |

> ⚠️ **EMAIL_PASS** é a **senha de app** do Gmail (não sua senha normal).
> Gere em: Google Account → Segurança → Senhas de app

4. Clique **Deploy**

---

## 4️⃣ Instalar dependência do Nodemailer

O Vercel instalará automaticamente, mas o `package.json` raiz
já inclui as dependências do frontend. Para as funções serverless
(`api/`), o Vercel gerencia separadamente. Certifique-se de que
o `nodemailer` está disponível executando na raiz:

```bash
npm install nodemailer
```

---

## 5️⃣ Verificação final

- [ ] Acesse `https://seu-app.vercel.app` — deve exibir a tela de login
- [ ] Crie uma conta e faça login
- [ ] Verifique o Dashboard
- [ ] Teste o proxy: `https://seu-app.vercel.app/api/proxy?url=https://api-publica.datajud.cnj.jus.br`

---

## Estrutura dos arquivos

```
├── api/
│   ├── proxy.js          ← Proxy CORS (Vercel Serverless)
│   └── send-email.js     ← Envio de e-mail (Vercel Serverless)
├── docs/
│   └── supabase-schema.sql ← SQL para criar tabelas
├── src/
│   ├── components/       ← Componentes React
│   ├── hooks/            ← Auth e hooks
│   ├── lib/              ← Supabase client
│   ├── pages/            ← Páginas do app
│   └── index.css         ← Design system
├── vercel.json           ← Config Vercel (functions + CSP)
└── package.json
```
