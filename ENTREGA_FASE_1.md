# JurisMonitor — Entrega da Fase 1

Esta versão aplica a modernização visual sem alterar o banco de dados, APIs, integrações, envio de e-mails ou regras de cálculo existentes.

## Escopo entregue

- identidade visual em azul-marinho, dourado fosco e superfícies neutras;
- tipografia Inter, Manrope e JetBrains Mono;
- layout principal com sidebar responsiva e recolhível;
- pesquisa no menu, favoritos e páginas recentes, salvos no navegador;
- indicador visual da página ativa e navegação móvel;
- cabeçalho contextual, modo escuro e controles reorganizados;
- dashboard reconstruído como centro de comando, com cabeçalho executivo, resumo imediato do dia, central de prioridades clicável e resumo operacional;
- seis indicadores uniformes, agenda, intimações e listas de prazos preservados;
- gráficos analíticos renovados: distribuição radial de processos, fluxo de intimações com linha de média e evolução de tarefas em barras empilhadas;
- indicadores de percentual de processos ativos, média diária de intimações e taxa de conclusão de tarefas;
- modo "Organizar painel" para arrastar ou mover os seis cards por setas;
- ordem dos cards salva no navegador, sem tabela ou alteração no Supabase;
- padronização visual de botões, cards, inputs, selects, textareas, badges, tabelas, abas, diálogos, alertas e estados de carregamento;
- títulos, descrições, espaçamentos e painéis consistentes nos módulos;
- melhorias de responsividade, rolagem de tabelas/abas e modais;
- microinterações com estados de hover, foco, transição e entrada de páginas;
- suporte a redução de movimento conforme preferência de acessibilidade.

## Preservação funcional

Comparados ao projeto original, permanecem sem alteração os diretórios `api`, `supabase`, `src/hooks` e `src/integrations`. Portanto, as rotinas de e-mail, autenticação, sincronização, banco, intimações, tarefas, clientes e processos não foram reescritas nesta fase.

## Validação executada

- compilação de produção concluída;
- teste automatizado existente concluído;
- tela de acesso conferida visualmente em desktop e largura móvel;
- ausência de rolagem horizontal confirmada na largura móvel;
- projeto final não contém `.env.local`, credenciais ou configuração fictícia de teste.

## Conferência após publicação

Como as credenciais do Supabase não acompanham o projeto local, a área autenticada deve ser conferida no ambiente conectado após o deploy. Teste: menu, modo escuro, organização dos cards, criação/edição de tarefas, contadores de intimações, sincronização e envio de e-mails. Essa conferência não exige migração de banco.

## Evolução de Tarefas, Kanban e Agenda

- resumo operacional de demandas abertas, vencidas, vencendo hoje e concluídas;
- visualização escolhida salva apenas no navegador;
- cards do Kanban podem ser arrastados entre colunas, atualizando o campo `status` existente;
- tarefas podem ser arrastadas entre os dias da agenda, atualizando `data_vencimento` existente;
- alternativa “Mover” mantida nos cards para celular e acessibilidade;
- nenhuma tabela, coluna, política RLS ou migração foi criada ou alterada.

## Painel TV

- módulo separado, aberto pelo botão “Painel TV” no dashboard;
- três apresentações rotativas: visão geral, tarefas/produtividade e carteira/intimações/clientes;
- velocímetros de saúde operacional e taxa de conclusão;
- gráficos radiais, barras, linha de tendência e mapa de carga dos próximos 14 dias;
- rotação automática a cada 20 segundos, atualização visual a cada 30 segundos, pausa e navegação manual;
- modo tela cheia e privacidade ativada por padrão;
- apresenta apenas totais e tendências, sem nomes, números processuais, valores ou conteúdos confidenciais;
- funciona apenas com leitura dos dados e hooks atuais, sem migração ou alteração no banco.
