# 🚀 JurisMonitor - Guia Rápido de Instalação

## 📦 O que você recebeu

Você recebeu o **JurisMonitor completo** com TODAS as melhorias implementadas:

✅ Módulo de Intimações  
✅ Módulo de Honorários  
✅ Sistema de Notificações Inteligente  
✅ Dashboard com Gráficos Interativos  
✅ Documentação Completa  

---

## ⚡ Instalação Rápida (5 minutos)

### Passo 1: Descompactar o Projeto
```bash
# Extrair o ZIP
unzip jurismonitor-completo.zip
cd process-hub-main
```

### Passo 2: Instalar Dependências
```bash
# Com NPM
npm install

# OU com Bun (mais rápido)
bun install
```

### Passo 3: Configurar Supabase

1. **Criar conta no Supabase** (grátis): https://supabase.com
2. **Criar novo projeto**
3. **Copiar credenciais**:
   - Project URL
   - Anon Key (public)

4. **Criar arquivo `.env.local`** na raiz do projeto:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

### Passo 4: Configurar Banco de Dados

1. **Ir para SQL Editor** no Supabase Dashboard
2. **Executar o script completo**: `docs/supabase-schema.sql`
3. **Executar a migration de honorários**: `supabase/migrations/20240101000000_add_honorarios.sql`

### Passo 5: Executar o Projeto
```bash
# Com NPM
npm run dev

# OU com Bun
bun dev
```

🎉 **Pronto!** Acesse: http://localhost:5173

---

## 🗂️ Estrutura dos Arquivos Novos/Modificados

### Páginas Criadas:
```
src/pages/
├── IntimacoesPage.tsx      ✨ NOVO - Gestão de intimações
├── HonorariosPage.tsx      ✨ NOVO - Controle financeiro
└── NotificacoesPage.tsx    ✨ NOVO - Central de alertas
```

### Arquivos Modificados:
```
src/
├── components/AppLayout.tsx           📝 Atualizado - Rotas integradas
└── pages/DashboardPage.tsx            📝 Atualizado - Gráficos adicionados
```

### Banco de Dados:
```
docs/
└── supabase-schema.sql                📝 Atualizado - Tabela honorarios

supabase/migrations/
└── 20240101000000_add_honorarios.sql  ✨ NOVO - Migration honorários
```

### Documentação:
```
README.md                               📝 Atualizado - Completo
docs/MELHORIAS_IMPLEMENTADAS.md        ✨ NOVO - Detalhes das melhorias
```

---

## 🎯 Principais Funcionalidades

### 1. Intimações
- Cadastrar intimações de diferentes origens
- Calcular dias restantes automaticamente
- Alertas visuais (urgente, atenção, vencida)
- Filtros por status e origem
- Marcar como cumprida

### 2. Honorários
- Controlar valores a receber
- Tipos: fixo, percentual, sucumbência, contrato
- Status: pendente, pago, cancelado
- Estatísticas financeiras
- Vincular com clientes e processos

### 3. Notificações
- Alertas inteligentes de todos os módulos
- 4 níveis de prioridade
- Filtros: todas, urgentes, hoje, próximos
- Cálculo automático de prazos

### 4. Dashboard
- 3 gráficos interativos (Recharts)
- Cards de estatísticas
- Prazos críticos em destaque
- Últimas intimações e tarefas

---

## 📊 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Iniciar servidor dev
npm run build           # Build para produção
npm run preview         # Preview do build

# Testes
npm run test            # Executar testes
npm run test:watch      # Testes em modo watch

# Lint
npm run lint            # Verificar código
```

---

## 🔐 Segurança

✅ Row Level Security (RLS) ativo em todas as tabelas  
✅ Cada usuário só acessa seus próprios dados  
✅ Autenticação via Supabase Auth  
✅ Proteção contra SQL Injection  

---

## 📱 Responsividade

✅ Desktop (layout completo)  
✅ Tablet (adaptado)  
✅ Mobile (bottom navigation)  

---

## 🆘 Problemas Comuns

### Erro: "Invalid API key"
- Verificar se o arquivo `.env.local` existe
- Confirmar que as credenciais estão corretas
- Reiniciar o servidor de desenvolvimento

### Erro: "relation does not exist"
- Executar os scripts SQL no Supabase
- Verificar se todas as tabelas foram criadas
- Confirmar que RLS está ativo

### Página em branco
- Verificar console do navegador (F12)
- Confirmar que o Supabase está configurado
- Verificar se está autenticado

### Gráficos não aparecem
- Confirmar que Recharts foi instalado
- Verificar se há dados nas tabelas
- Limpar cache do navegador

---

## 📚 Documentação Completa

Leia os seguintes arquivos para mais detalhes:

- `README.md` - Documentação principal
- `docs/MELHORIAS_IMPLEMENTADAS.md` - Lista completa de melhorias
- `docs/supabase-schema.sql` - Schema do banco
- `docs/DEPLOY.md` - Instruções de deploy

---

## 🎨 Personalização

### Cores do Tema
Editar: `src/index.css` e `tailwind.config.ts`

### Componentes UI
Baseados em shadcn/ui: `src/components/ui/`

### Páginas
Adicionar novas páginas em: `src/pages/`

---

## 🚀 Deploy (Produção)

### Opções Recomendadas:

**1. Vercel (Recomendado)**
```bash
# Instalar CLI
npm i -g vercel

# Deploy
vercel
```

**2. Netlify**
```bash
# Build
npm run build

# Fazer upload da pasta dist/
```

**3. Supabase Hosting**
```bash
# Seguir guia em: docs/DEPLOY.md
```

---

## 📈 Próximos Passos

Após instalar, você pode:

1. ✅ Cadastrar seus primeiros clientes
2. ✅ Adicionar processos
3. ✅ Criar tarefas e intimações
4. ✅ Configurar honorários
5. ✅ Explorar o dashboard e notificações

---

## 💡 Dicas

- Use filtros para encontrar informações rapidamente
- Configure notificações para não perder prazos
- Vincule honorários com processos para melhor controle
- Exporte dados regularmente (futuro)

---

## 🆘 Suporte

Se precisar de ajuda:

1. Verifique a documentação completa no `README.md`
2. Consulte `docs/MELHORIAS_IMPLEMENTADAS.md`
3. Verifique os logs do console (F12)
4. Revise a configuração do Supabase

---

## ✅ Checklist de Instalação

- [ ] Extrair ZIP
- [ ] Instalar dependências
- [ ] Criar projeto Supabase
- [ ] Configurar `.env.local`
- [ ] Executar scripts SQL
- [ ] Iniciar servidor dev
- [ ] Criar conta de usuário
- [ ] Testar funcionalidades

---

**🎉 Tudo pronto! Aproveite o JurisMonitor!**

Desenvolvido com ❤️ para advogados que buscam eficiência.
