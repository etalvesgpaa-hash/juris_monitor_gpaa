-- =====================================================
-- JurisMonitor - Dados de Exemplo para Testes
-- Execute no SQL Editor após criar as tabelas
-- =====================================================

-- IMPORTANTE: Substitua 'USER_ID_AQUI' pelo ID do seu usuário
-- Para encontrar seu user_id, execute: SELECT id FROM auth.users;

-- ========== CLIENTES DE EXEMPLO ==========
INSERT INTO public.clientes (user_id, nome, cpf_cnpj, email, telefone, endereco, observacoes) VALUES
('USER_ID_AQUI', 'Maria Silva Santos', '123.456.789-00', 'maria.silva@email.com', '(11) 98765-4321', 'Rua das Flores, 123 - São Paulo/SP', 'Cliente ativa desde 2023'),
('USER_ID_AQUI', 'João Pedro Oliveira', '987.654.321-00', 'joao.oliveira@email.com', '(11) 97654-3210', 'Av. Paulista, 1000 - São Paulo/SP', 'Empresário, área trabalhista'),
('USER_ID_AQUI', 'Empresa ABC Ltda', '12.345.678/0001-90', 'contato@empresaabc.com', '(11) 3456-7890', 'Rua Comercial, 456 - São Paulo/SP', 'Pessoa jurídica, contratos'),
('USER_ID_AQUI', 'Ana Costa Lima', '456.789.123-00', 'ana.costa@email.com', '(11) 96543-2109', 'Rua das Acácias, 789 - São Paulo/SP', 'Casos de família'),
('USER_ID_AQUI', 'Carlos Mendes', '321.654.987-00', 'carlos.mendes@email.com', '(11) 95432-1098', 'Av. Brasil, 2000 - São Paulo/SP', 'Ações cíveis');

-- ========== PROCESSOS DE EXEMPLO ==========
INSERT INTO public.processos (user_id, numero_cnj, classe, assunto, tribunal, vara, comarca, status, valor_causa, partes, advogados) VALUES
('USER_ID_AQUI', '0001234-56.2024.8.26.0100', 'Ação de Cobrança', 'Cobrança de honorários advocatícios', 'TJSP', '1ª Vara Cível', 'São Paulo', 'ativo', 50000.00, 'Maria Silva Santos x Empresa XYZ', 'Dr. Advogado'),
('USER_ID_AQUI', '0002345-67.2024.8.26.0100', 'Ação Trabalhista', 'Verbas rescisórias', 'TRT-2', '5ª Vara do Trabalho', 'São Paulo', 'ativo', 120000.00, 'João Pedro Oliveira x Empresa ABC', 'Dr. Advogado'),
('USER_ID_AQUI', '0003456-78.2023.8.26.0100', 'Divórcio Consensual', 'Dissolução de união estável', 'TJSP', '2ª Vara de Família', 'São Paulo', 'arquivado', 0, 'Ana Costa Lima x Carlos Costa', 'Dr. Advogado'),
('USER_ID_AQUI', '0004567-89.2024.8.26.0100', 'Ação de Despejo', 'Despejo por falta de pagamento', 'TJSP', '3ª Vara Cível', 'São Paulo', 'ativo', 30000.00, 'Empresa ABC x Inquilino', 'Dr. Advogado'),
('USER_ID_AQUI', '0005678-90.2024.8.26.0100', 'Ação Indenizatória', 'Danos morais e materiais', 'TJSP', '4ª Vara Cível', 'São Paulo', 'pendente', 80000.00, 'Carlos Mendes x Seguradora', 'Dr. Advogado');

-- ========== TAREFAS DE EXEMPLO ==========
INSERT INTO public.tarefas (user_id, titulo, descricao, prioridade, status, data_vencimento) VALUES
('USER_ID_AQUI', 'Protocolar contestação', 'Processo 0001234-56.2024.8.26.0100 - Prazo de 15 dias', 'alta', 'pendente', NOW() + INTERVAL '2 days'),
('USER_ID_AQUI', 'Audiência trabalhista', 'Comparecer à audiência de instrução', 'alta', 'pendente', NOW() + INTERVAL '5 days'),
('USER_ID_AQUI', 'Elaborar petição inicial', 'Nova ação de revisão contratual', 'media', 'pendente', NOW() + INTERVAL '10 days'),
('USER_ID_AQUI', 'Reunião com cliente', 'Discutir estratégia processual', 'media', 'pendente', NOW() + INTERVAL '3 days'),
('USER_ID_AQUI', 'Análise de documentos', 'Revisar contratos para devido diligence', 'baixa', 'pendente', NOW() + INTERVAL '15 days'),
('USER_ID_AQUI', 'Recurso de apelação', 'Prazo quinzenal', 'alta', 'pendente', NOW() + INTERVAL '7 days'),
('USER_ID_AQUI', 'Juntada de documentos', 'Documentação complementar processo trabalhista', 'media', 'concluida', NOW() - INTERVAL '2 days');

-- ========== INTIMAÇÕES DE EXEMPLO ==========
INSERT INTO public.intimacoes (user_id, numero_processo, origem, tipo, conteudo, data_publicacao, prazo, status) VALUES
('USER_ID_AQUI', '0001234-56.2024.8.26.0100', 'aasp', 'Despacho', 'Determina a apresentação de contestação no prazo legal', NOW() - INTERVAL '5 days', NOW() + INTERVAL '10 days', 'ativa'),
('USER_ID_AQUI', '0002345-67.2024.8.26.0100', 'diario_oficial', 'Sentença', 'Publicada sentença procedente parcial', NOW() - INTERVAL '3 days', NOW() + INTERVAL '12 days', 'ativa'),
('USER_ID_AQUI', '0004567-89.2024.8.26.0100', 'aasp', 'Audiência', 'Designada audiência de conciliação', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 'ativa'),
('USER_ID_AQUI', '0005678-90.2024.8.26.0100', 'email', 'Decisão Interlocutória', 'Deferida produção de prova pericial', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 'ativa'),
('USER_ID_AQUI', '0003456-78.2023.8.26.0100', 'aasp', 'Sentença', 'Homologado acordo de divórcio', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days', 'cumprida');

-- ========== HONORÁRIOS DE EXEMPLO ==========
INSERT INTO public.honorarios (user_id, descricao, valor, tipo, status, data_vencimento, observacoes) VALUES
('USER_ID_AQUI', 'Honorários contratuais - Ação de Cobrança', 8000.00, 'fixo', 'pago', NOW() - INTERVAL '10 days', 'Primeira parcela paga'),
('USER_ID_AQUI', 'Honorários - Ação Trabalhista', 15000.00, 'percentual', 'pendente', NOW() + INTERVAL '5 days', '10% do valor da causa'),
('USER_ID_AQUI', 'Consultoria jurídica mensal - Empresa ABC', 5000.00, 'contrato', 'pendente', NOW() + INTERVAL '15 days', 'Contrato de assessoria'),
('USER_ID_AQUI', 'Honorários sucumbenciais', 12000.00, 'sucumbencia', 'pendente', NOW() + INTERVAL '30 days', 'Aguardando trânsito em julgado'),
('USER_ID_AQUI', 'Elaboração de contrato', 3000.00, 'fixo', 'pago', NOW() - INTERVAL '20 days', 'Contrato de prestação de serviços'),
('USER_ID_AQUI', 'Ação Indenizatória - Taxa inicial', 10000.00, 'fixo', 'pendente', NOW() + INTERVAL '2 days', 'Prazo crítico - entrar em contato');

-- ========== MOVIMENTAÇÕES DE EXEMPLO ==========
INSERT INTO public.movimentacoes (user_id, processo_id, data, titulo, descricao) VALUES
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0001234-56.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '30 days', 'Distribuição', 'Processo distribuído à 1ª Vara Cível'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0001234-56.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '25 days', 'Citação', 'Expedido mandado de citação do réu'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0001234-56.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '20 days', 'Juntada', 'Juntado aos autos AR de citação'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0001234-56.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '5 days', 'Despacho', 'Intimação para apresentação de contestação'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0002345-67.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '60 days', 'Distribuição', 'Processo distribuído à 5ª Vara do Trabalho'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0002345-67.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '45 days', 'Audiência', 'Realizada audiência de conciliação - sem acordo'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0002345-67.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '30 days', 'Instrução', 'Ouvidas testemunhas do reclamante'),
('USER_ID_AQUI', (SELECT id FROM public.processos WHERE numero_cnj = '0002345-67.2024.8.26.0100' LIMIT 1), NOW() - INTERVAL '3 days', 'Sentença', 'Publicada sentença parcialmente procedente');

-- =====================================================
-- IMPORTANTE: Após executar, substitua 'USER_ID_AQUI' 
-- pelo seu ID real de usuário!
--
-- Para encontrar seu user_id:
-- SELECT id FROM auth.users WHERE email = 'seu-email@example.com';
--
-- Depois execute um REPLACE em todo este arquivo:
-- Substitua 'USER_ID_AQUI' pelo ID retornado
-- =====================================================

-- ========== ESTATÍSTICAS GERADAS ==========
-- Após inserir estes dados, você terá:
--
-- ✅ 5 clientes cadastrados
-- ✅ 5 processos (3 ativos, 1 arquivado, 1 pendente)
-- ✅ 7 tarefas (6 pendentes, 1 concluída)
-- ✅ 5 intimações (4 ativas, 1 cumprida)
-- ✅ 6 honorários (2 pagos, 4 pendentes)
-- ✅ 8 movimentações processuais
--
-- Seu dashboard terá gráficos e estatísticas!
-- =====================================================
