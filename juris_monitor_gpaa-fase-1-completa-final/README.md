# 📊 JurisMonitor

Sistema completo de gestão jurídica para advogados e escritórios de advocacia.

## 🎯 Sobre o Projeto

JurisMonitor é uma plataforma moderna e intuitiva para gestão completa de processos jurídicos, desenvolvida para facilitar o dia a dia de advogados e escritórios de advocacia. Com foco em organização, produtividade e controle financeiro.

## ✨ Funcionalidades

### 📈 Dashboard Inteligente
- Visão geral completa dos processos e prazos
- Gráficos interativos de produtividade (Recharts)
- Alertas de prazos críticos
- Estatísticas em tempo real

### ⚖️ Gestão de Processos
- Cadastro completo com número CNJ
- Acompanhamento de movimentações
- Histórico detalhado
- Vinculação com clientes
- Status e fases processuais

### 📅 Intimações
- Gerenciamento de intimações por origem (AASP, Diário Oficial, etc.)
- Controle de prazos processuais
- Alertas automáticos de vencimento
- Status: ativa, cumprida, arquivada
- Filtros avançados

### 💰 Honorários
- Controle financeiro completo
- Tipos: fixo, percentual, sucumbência, contrato
- Status de pagamento (pendente, pago, cancelado)
- Alertas de vencimento
- Relatórios de recebíveis
- Vinculação com clientes e processos

### ✅ Tarefas
- Organização de atividades
- Prioridades (baixa, média, alta)
- Controle de prazos
- Status de conclusão
- Vinculação com processos

### 🔔 Notificações
- Central de alertas inteligentes
- Classificação por prioridade (urgente, alta, média, baixa)
- Notificações de:
  - Prazos vencendo
  - Tarefas pendentes
  - Intimações urgentes
  - Honorários a receber
- Filtros por tipo e período (todas, urgentes, hoje, próximos 7 dias)

### 👥 Clientes
- Cadastro completo (CPF/CNPJ, contatos, endereço)
- Histórico de processos
- Observações personalizadas

### ⚙️ Configurações
- Perfil do usuário
- Dados do escritório
- Preferências do sistema

## 🛠️ Tecnologias

### Frontend
- **React 18** - Framework UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool moderna e rápida
- **Tailwind CSS** - Estilização utilitária
- **shadcn/ui** - Componentes UI modernos
- **Radix UI** - Primitivos acessíveis
- **Lucide React** - Ícones

### Backend & Database
- **Supabase** - Backend as a Service
  - PostgreSQL Database
  - Authentication
  - Row Level Security (RLS)
  - Real-time subscriptions

### Gerenciamento de Estado
- **TanStack Query** (React Query) - Server state
- **React Context** - Client state
- **React Hook Form** - Formulários
- **Zod** - Validação de schemas

### Gráficos & Visualização
- **Recharts** - Gráficos interativos
- **date-fns** - Manipulação de datas

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ ou Bun
- Conta no Supabase

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/jurismonitor.git
cd jurismonitor

# Instalar dependências
npm install
# ou
bun install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase
```

### Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o script SQL em `docs/supabase-schema.sql` no SQL Editor
3. Execute a migration de honorários em `supabase/migrations/20240101000000_add_honorarios.sql`
4. Configure as variáveis de ambiente:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### Executar em Desenvolvimento

```bash
npm run dev
# ou
bun dev
```

Acesse: `http://localhost:5173`

### Build para Produção

```bash
npm run build
# ou
bun run build
```

## 📁 Estrutura do Projeto

```
jurismonitor/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   ├── ui/          # Componentes shadcn/ui
│   │   ├── AppLayout.tsx
│   │   ├── TopNav.tsx
│   │   └── BottomNav.tsx
│   ├── hooks/           # Custom hooks
│   │   ├── useAuth.tsx
│   │   ├── useProcessos.tsx
│   │   ├── useTarefas.tsx
│   │   └── useClientes.tsx
│   ├── pages/           # Páginas da aplicação
│   │   ├── DashboardPage.tsx
│   │   ├── ProcessosPage.tsx
│   │   ├── IntimacoesPage.tsx
│   │   ├── HonorariosPage.tsx
│   │   ├── NotificacoesPage.tsx
│   │   ├── TarefasPage.tsx
│   │   ├── ClientesPage.tsx
│   │   └── ConfigPage.tsx
│   ├── integrations/    # Integrações externas
│   │   └── supabase/
│   ├── lib/            # Utilitários
│   └── App.tsx         # Componente principal
├── docs/               # Documentação
│   ├── supabase-schema.sql
│   └── DEPLOY.md
├── supabase/          # Configurações Supabase
│   └── migrations/    # Migrações SQL
└── public/            # Arquivos estáticos
```

## 🗄️ Modelo de Dados

### Tabelas Principais

- **profiles** - Dados do usuário/advogado
- **clientes** - Cadastro de clientes
- **processos** - Processos jurídicos
- **movimentacoes** - Histórico processual
- **intimacoes** - Intimações e publicações
- **tarefas** - Atividades e prazos
- **honorarios** - Controle financeiro

Todos os dados utilizam Row Level Security (RLS) para garantir que cada usuário acesse apenas suas próprias informações.

## 🔐 Segurança

- Autenticação via Supabase Auth
- Row Level Security (RLS) em todas as tabelas
- Proteção contra SQL Injection
- HTTPS em produção
- Validação de dados com Zod

## 📱 Responsividade

JurisMonitor é totalmente responsivo e funciona perfeitamente em:
- 💻 Desktop
- 📱 Mobile
- 📲 Tablet

### Navegação Mobile
- Bottom navigation para fácil acesso com uma mão
- Interface otimizada para telas pequenas
- Touch-friendly

## 🎨 Design System

- **Cores**: Tema personalizado para ambiente jurídico
- **Tipografia**: Sistema hierárquico claro
- **Componentes**: Baseados em shadcn/ui
- **Ícones**: Lucide React
- **Animações**: Transições suaves com Tailwind

## 🔄 Próximas Funcionalidades

### Planejado
- [ ] Integração com DataJud (consulta processual automática)
- [ ] Análise de processos com IA
- [ ] Geração automática de petições
- [ ] Sistema de agenda integrado
- [ ] Anexos de documentos
- [ ] Compartilhamento de processos
- [ ] App mobile nativo (React Native)
- [ ] Multi-escritório (gestão de equipes)
- [ ] API pública
- [ ] Integrações com tribunais
- [ ] Assinatura digital de documentos

## 📄 Licença

Este projeto está sob a licença MIT.

## 👥 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 🐛 Reportar Bugs

Encontrou um bug? Por favor, abra uma issue com:
- Descrição do problema
- Passos para reproduzir
- Comportamento esperado
- Screenshots (se aplicável)

## 🙏 Agradecimentos

- [Supabase](https://supabase.com) - Backend e infraestrutura
- [shadcn/ui](https://ui.shadcn.com) - Componentes UI
- [Lovable](https://lovable.dev) - Plataforma de desenvolvimento
- Comunidade React e TypeScript

---

Desenvolvido com ❤️ para advogados que buscam eficiência e organização.
