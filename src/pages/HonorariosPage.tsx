import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProcessos } from "@/hooks/useProcessos";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─────────────────────────────────────────────
// TABELA OAB-SP 2026 (default embutida)
// ─────────────────────────────────────────────
const TABELA_OABSP_DEFAULT: any = {
  versao: "2026",
  fonte: "Tabela de Honorários OAB/SP 2026",
  observacoes: {
    geral: "Salvo outra disposição, serão devidos honorários no percentual de 20% sobre o valor econômico da questão, havendo ou não benefício patrimonial.",
    valores_minimos: "As importâncias anotadas, em reais, são sugeridas como valores mínimos.",
    cartas_precatorias_min: 1540.70,
    advocacia_partido_mensal_min: 3081.42,
  },
  extrajudicial: {
    consulta: { descricao: "Consulta", min: 539.25 },
    consulta_excepcional_com_documentos: { descricao: "Consulta em condições excepcionais (com exame de documentos)", min: 1155.52 },
    hora_intelectual: { descricao: "Hora intelectual", min: 868.96 },
    acompanhamento_documentos_orgao_publico: { descricao: "Acompanhamento ou exame de documentos em órgão público", min: 1216.54, pct: 10 },
    acompanhamento_citacao_notificacao_intimacao: { descricao: "Acompanhamento de citação, notificação, intimação, interpelação e exames periciais", min: 868.96 },
    acompanhamento_depoimento_testemunhas: { descricao: "Acompanhamento de depoimento pessoal ou inquirição de testemunhas (por ato)", min: 2433.09 },
    cobranca_amigavel: { descricao: "Cobrança amigável (art. 395 do CC/2002), independentemente dos honorários contratuais", min: 1216.54, pct: 10 },
    consignacao_pagamento_extrajudicial: { descricao: "Consignação em pagamento na via extrajudicial", min: 2085.52, pct: 10 },
    exame_instrumento_constituicao_pj: { descricao: "Exame e visto em instrumento de constituição de pessoa jurídica", min: 2085.52 },
    elaboracao_notificacao_extrajudicial: { descricao: "Elaboração de notificação extrajudicial", min: 868.96 },
    elaboracao_minuta_contrato_testamento: { descricao: "Elaboração de minutas de contrato, distrato, alteração, estatuto, testamento, escritura ou documento", min: 4930.26, pct: 3 },
    parecer_ou_memorial: { descricao: "Parecer ou memorial", min: 3475.84 },
    requerimento_ou_peticoes: { descricao: "Requerimento ou petições", min: 1216.54 },
    exame_processo_geral: { descricao: "Exame de processo em geral", min: 770.35 },
    intervencao_amigavel: { descricao: "Intervenção para solução de qualquer assunto no terreno amigável, mesmo quando for de valor inestimável", min: 3081.42, pct_se_interesse_economico: 10 },
  },
  administrativo: {
    sindicancia_processo_admin_defesa: { descricao: "Sindicância e processo administrativo – acompanhamento/defesa", min: 3128.26, pct: 10 },
    processo_admin_recurso: { descricao: "Processo administrativo – recurso", min: 6082.72, pct: 5 },
    acao_defesa_fase_administrativa: { descricao: "Ação ou defesa – fase administrativa", min: 10427.52, pct: 20 },
    recurso_fase_administrativa: { descricao: "Recurso – fase administrativa", min: 5213.74, pct: 10 },
    acao_defesa_fase_judicial: { descricao: "Ação ou defesa – fase judicial", min: 17379.18, pct: 20 },
    recurso_fase_judicial: { descricao: "Recurso – fase judicial", min: 8689.58, pct: 10 },
  },
  juizados_especiais: {
    inicial_contestacao_audiencia: { descricao: "Inicial ou contestação e audiência", min: 1390.33, pct: 20 },
    segunda_instancia: { descricao: "Atuação em segunda instância", min: 1042.75, pct: 10 },
    sustentacao_oral_turmas_recursais: { descricao: "Sustentação oral perante turmas recursais", min: 1042.75, pct: 10 },
  },
  civel: {
    procedimento_ordinario: { descricao: "Procedimento ordinário: proposição ou defesa", min: 6256.51, pct: 20 },
    procedimento_sumario: { descricao: "Procedimento sumário: proposição ou defesa", min: 4344.80, pct: 20 },
    cumprimento_sentenca: { descricao: "Cumprimento de sentença", min: 3475.84, pct: 20 },
    impugnacao_cumprimento_sentenca: { descricao: "Impugnação ao cumprimento de sentença", min: 3475.84, pct: 20 },
    execucao_titulo_extrajudicial: { descricao: "Execução de título extrajudicial", min: 3475.84, pct: 20 },
    impugnacao_embargos_execucao_extrajudicial: { descricao: "Impugnação/embargos à execução de título extrajudicial", min: 3475.84, pct: 20 },
    impugnacao_embargos_penhora_arrematacao: { descricao: "Impugnação/embargos à penhora, à arrematação, à adjudicação, ao leilão, de títulos judiciais e extrajudiciais", min: 3475.84, pct: 20 },
    processo_cautelar_especifico: { descricao: "Processo cautelar específico: incidental ou preparatório", min: 3475.84, pct: 10 },
    processo_cautelar_inominado: { descricao: "Processo cautelar inominado: incidental ou preparatório", min: 4344.80, pct: 20 },
    consignacao_pagamento: { descricao: "Consignação em pagamento", min: 4344.80, pct: 20 },
    deposito: { descricao: "Depósito", min: 3475.84, pct: 10 },
    anulacao_substituicao_titulo_portador: { descricao: "Anulação e substituição de título ao portador", min: 3475.84, pct: 10 },
    prestacao_contas: { descricao: "Prestação de contas", min: 10427.52 },
    possessoria_movel: { descricao: "Ação possessória – móvel", min: 3475.84, pct: 20 },
    possessoria_imovel: { descricao: "Ação possessória – imóvel: interdito proibitório, manutenção, reintegração", min: 6082.72, pct: 20 },
    nunciacao_obra_nova: { descricao: "Nunciação de obra nova", min: 5392.48, pct: 10 },
    usucapiao: { descricao: "Usucapião", min: 6082.72, pct: 20 },
    divisao_demarcacao: { descricao: "Divisão e demarcação", min: 5392.48, pct: 10 },
    embargos_terceiro: { descricao: "Embargos de terceiro", min: 6082.72, pct: 10 },
    habilitacao: { descricao: "Habilitação", min: 4344.80, pct: 10 },
    restauracao_autos: { descricao: "Restauração de autos", min: 4344.80, pct: 10 },
    vendas_credito_reserva_dominio: { descricao: "Das vendas a crédito com reserva de domínio", min: 4344.80, pct: 10 },
    juizo_arbitral: { descricao: "Do Juízo arbitral", min: 5392.48, pct: 10 },
    acao_monitoria: { descricao: "Da ação monitória", min: 3081.41, pct: 10 },
    desapropriacao_direta: { descricao: "Desapropriação direta", min: 6162.84, pct: 10 },
    desapropriacao_indireta: { descricao: "Desapropriação indireta", min: 10427.52, pct: 20 },
    inominada: { descricao: "Jurisdição voluntária inominada", min: 4344.80, pct: 10 },
    retificacao_registro_publico: { descricao: "Ação de retificação de registro público", min: 4344.80 },
    alvara_judicial: { descricao: "Alvará judicial", min: 3081.41, pct: 20 },
    constituicao_extincao_usufruto_fideicomisso: { descricao: "Ação de constituição, extinção de usufruto ou fideicomisso", min: 4622.13, pct: 10 },
    mandado_seguranca: { descricao: "Mandado de segurança", min: 6951.68, pct: 20 },
    acao_despejo: { descricao: "Ação ordinária de despejo", min: 5392.48, pct: 20 },
    acao_renovatoria_locacao: { descricao: "Ação renovatória de locação", min: 5392.48, pct: 20 },
    revisao_arbitramento_aluguel: { descricao: "Ação de revisão e/ou arbitramento de aluguel", min: 5392.48, pct: 20 },
    consignacao_aluguel: { descricao: "Ação de consignação de aluguel", min: 4344.80, pct: 20 },
    atos_acompanhamento_despejo_reintegracao: { descricao: "Atos/acompanhamento despejo/reintegração", min: 3475.84 },
    dissolucao_sociedade: { descricao: "Ação de dissolução de sociedade", min: 6951.68, pct: 20 },
    cancelamento_protesto: { descricao: "Ação de cancelamento de protesto", min: 4344.80, pct: 15 },
    mandado_injuncao: { descricao: "Mandado de injunção", min: 4344.80 },
    habeas_data: { descricao: "Habeas data", min: 4344.80 },
    acao_negatoria_propriedade_intelectual: { descricao: "Ação negatória ou de abstenção de uso de matéria de propriedade intelectual", min: 18248.15 },
    acao_indenizatoria_contrafacao: { descricao: "Ação indenizadora por prejuízos decorrentes de contrafação ou crime em matéria de propriedade intelectual", min: 12165.43 },
    busca_apreensao_propriedade_intelectual: { descricao: "Busca e apreensão em matéria de propriedade intelectual", min: 14772.31 },
    proc_admin_propriedade_intelectual: { descricao: "Procedimentos administrativos de propriedade intelectual: depósitos de marca ou patente, oposição, recursos, revisão, caducidade, nulidade etc.", min: 5392.48 },
    registro_loteamento_desmembramento: { descricao: "Análise da documentação e pedido de registro de loteamento ou desmembramento, por grupo de dez lotes", min: 4344.80, pct: 10 },
    opcao_nacionalidade: { descricao: "Opção de nacionalidade", min: 3475.84 },
  },
  falencias_recuperacao: {
    pedido_falencia: { descricao: "Pedido de falência e acompanhamento até a decretação", min: 5213.74, pct: 20 },
    acao_restituicao_reivindicatoria: { descricao: "Ação de restituição e ação reivindicatória, até a decisão final", min: 5213.74, pct: 20 },
    pedido_recuperacao_empresa: { descricao: "Pedido de recuperação de empresa", min: 9244.25, pct_min: 2, pct_max: 10 },
    pedido_declaracao_insolvencia: { descricao: "Pedido de declaração de insolvência", min: 4344.80, pct: 20 },
    habilitacao_credito: { descricao: "Habilitação tempestiva ou retardatária e divergência de crédito", min: 4344.80, pct: 20 },
    representacao_falido: { descricao: "Representação do falido (sobre o montante do passivo)", min: 8689.58, pct: 20 },
    representacao_devedor_insolvente: { descricao: "Representação do devedor insolvente (sobre o montante do passivo)", min: 8689.58, pct: 20 },
    representacao_administrador_judicial: { descricao: "Representação do administrador judicial na falência ou na recuperação judicial", min: 10427.52, pct: 10 },
  },
  familia_sucessoes: {
    divorcio_judicial_consensual: { descricao: "Divórcio judicial consensual", min: 7820.64 },
    divorcio_judicial_com_alimentos_bens: { descricao: "Divórcio judicial consensual, cumulado com alimentos e/ou bens, acrescido do percentual", min: 7820.64, pct: 6 },
    divorcio_judicial_litigioso: { descricao: "Divórcio judicial litigioso", min: 12165.42 },
    divorcio_judicial_litigioso_com_alimentos_bens: { descricao: "Divórcio judicial litigioso, cumulado com alimentos e/ou bens, acrescido do percentual", min: 12165.42, pct: 10 },
    reconvencao_divorcio: { descricao: "Reconvenção em divórcio", min: 12165.42, pct: 8 },
    acao_anulatoria_separacao_judicial_divorcio_rescisoria: { descricao: "Ação anulatória de separação judicial, divórcio e/ou rescisória (acrescido do percentual sobre o patrimônio)", min: 11968.22, pct: 8 },
    divorcio_extrajudicial_cartorio: { descricao: "Divórcio extrajudicial em cartório (acrescido do percentual sobre alimentos, patrimônio e/ou quinhão)", min: 4344.80, pct: 6 },
    dissolucao_uniao_estavel_consensual: { descricao: "Dissolução de união estável consensual", min: 7820.64 },
    dissolucao_uniao_estavel_com_alimentos_bens: { descricao: "Dissolução de união estável consensual, cumulada com alimentos e/ou bens, acrescida do percentual", min: 7820.64, pct: 6 },
    dissolucao_uniao_estavel_litigiosa: { descricao: "Dissolução de união estável litigiosa", min: 12165.42 },
    dissolucao_uniao_estavel_litigiosa_com_alimentos_bens: { descricao: "Dissolução de união estável litigiosa, cumulada com alimentos e/ou bens, acrescida do percentual", min: 12165.42, pct: 10 },
    investigacao_paternidade_com_heranca: { descricao: "Investigação de paternidade cumulada com petição de herança, acrescida do percentual sobre o quinhão", min: 12165.42 },
    investigacao_paternidade_com_alimentos: { descricao: "Investigação de paternidade cumulada com petição de alimentos, acrescida do percentual sobre o valor da causa", min: 12165.42 },
    acao_negatoria_paternidade: { descricao: "Ação negatória de paternidade", min: 14772.31 },
    acao_rescisoria_paternidade: { descricao: "Ação rescisória de paternidade", min: 14772.31 },
    acao_nulidade_anulacao_casamento: { descricao: "Ação de nulidade ou anulação de casamento", min: 14772.31 },
    acao_alimentos_provisorios_revisionais: { descricao: "Ação de alimentos: provisórios – provisionais (majoração – redução – exoneração) e ação revisional de alimentos. Proposição e/ou contestação – valor de 3 (três) pensões mensais", min: 2606.88, pct_base: "3 pensões mensais" },
    execucao_alimentos: { descricao: "Execução de alimentos – pena de prisão/penhora. Proposição e/ou contestação: valor de 3 (três) pensões mensais", min: 2606.88, pct_base: "3 pensões mensais" },
    curatela: { descricao: "Curatela", min: 10427.52 },
    tutela: { descricao: "Tutela", min: 10427.52 },
    emancipacao: { descricao: "Emancipação ou suprimento", min: 4344.80 },
    suprimento_judicial_outorga_consentimento: { descricao: "Suprimento judicial de outorga de consentimento", min: 6082.72 },
    adocao_nacional: { descricao: "Adoção por nacional", min: 8689.58 },
    adocao_estrangeira: { descricao: "Adoção por estrangeiro", min: 16510.22 },
    cautelar_arrolamento_bens: { descricao: "Ação cautelar – arrolamento de bens", min: 6082.72 },
    cautelar_busca_apreensao_criancas_bens: { descricao: "Ação cautelar – busca e apreensão de crianças e adolescentes ou bens", min: 6082.72 },
    cautelar_guarda_provisoria: { descricao: "Ação cautelar – guarda provisória", min: 6082.72, pct: 20 },
    cautelar_regulamentacao_visitas: { descricao: "Ação cautelar – regulamentação de visitas", min: 6082.72 },
    cautelar_separacao_corpos: { descricao: "Ação cautelar – separação de corpos", min: 6082.72 },
    cautelar_sequestro_bens: { descricao: "Ação cautelar – sequestro de bens", min: 7820.64 },
    acao_regulamentacao_visitas: { descricao: "Ação ordinária de regulamentação de visitas", min: 7820.64 },
    busca_apreensao_criancas: { descricao: "Ação ordinária de busca e apreensão de crianças e adolescentes", min: 7820.64 },
    interdito_levantamento: { descricao: "Ação de interdição ou levantamento", min: 8689.58 },
    alteracao_guarda: { descricao: "Ação de alteração de guarda", min: 6082.72 },
    habeas_corpus_prisao_civil: { descricao: "Habeas corpus (prisão civil)", min: 16510.22 },
    desconsideracao_personalidade_juridica: { descricao: "Desconsideração da personalidade jurídica", min: 10427.52, pct: 20 },
    inventario_sem_litigio: { descricao: "Inventário, arrolamento e sobrepartilha judicial sem litígio: 8% sobre o valor real do monte-mor ou sobre o valor real do quinhão de cada herdeiro", min: 6082.72, pct_monte_mor: 8 },
    inventario_com_litigio: { descricao: "Inventário, arrolamento e sobrepartilha judicial com litígio: 10% sobre o valor real do monte-mor ou sobre o valor real do quinhão de cada herdeiro", min: 6082.72, pct_monte_mor: 10 },
    inventario_extrajudicial: { descricao: "Inventário, arrolamento e sobrepartilha extrajudicial: 6% sobre o valor real do monte-mor ou 6% sobre o valor real do quinhão de cada herdeiro", min: 4344.80, pct_monte_mor: 6 },
    inventario_negativo: { descricao: "Inventário negativo", min: 4344.80 },
    reserva_bens: { descricao: "Reserva de bens", min: 4344.80, pct: 10 },
    remocao_inventariante: { descricao: "Remoção de inventariante", min: 10427.52 },
    acao_colacao: { descricao: "Ação de colação", min: 6082.72, pct: 10 },
    acao_doacao_inoficiosa: { descricao: "Ação de doação inoficiosa – 10% sobre os bens excedentes", min: 6082.72, pct: 10 },
    acao_sonegados: { descricao: "Ação de sonegados", min: 10427.52, pct: 20 },
    acao_nulidade_testamento: { descricao: "Ação de nulidade de testamento", min: 12165.42 },
    acao_anulatoria_testamento: { descricao: "Ação anulatória de testamento", min: 12165.42 },
    acao_nulidade_partilha: { descricao: "Ação de nulidade de partilha", min: 12165.42 },
    acao_habilitacao_herdeiros: { descricao: "Ação de habilitação de herdeiros (sobre o valor habilitado)", min: 4344.80, pct: 10 },
    acao_habilitacao_credito: { descricao: "Ação de habilitação de crédito (sobre o valor habilitado)", min: 4344.80, pct: 10 },
    acao_declaratoria_indignidade: { descricao: "Ação declaratória de indignidade (sobre o valor do quinhão do excluído)", min: 8168.22, pct: 20 },
    acao_declaratoria_deserdacao: { descricao: "Ação declaratória de deserdação (sobre o quinhão do deserdado)", min: 8168.22, pct: 20 },
    retificacao_partilha: { descricao: "Retificação de partilha", min: 4344.80 },
    minuta_testamento: { descricao: "Minuta de testamento e/ou assistência ao ato e a abertura de testamento", min: 6082.72 },
  },
  trabalhista: {
    patrocinio_reclamante: { descricao: "Patrocínio de reclamante: sobre o valor econômico da questão ou da condenação, ou do acordo", min: 1737.91, pct_min: 20, pct_max: 30 },
    acrescimo_recurso_ordinario_reclamante: { descricao: "Acréscimo no caso de recurso ordinário (reclamante)", min: 1216.54, pct: 5 },
    acrescimo_recurso_revista_reclamante: { descricao: "Acréscimo no caso de recurso de revista e/ou contrarrazões (reclamante)", min: 1216.54, pct: 5 },
    patrocinio_reclamado: { descricao: "Patrocínio do reclamado: sobre o valor real do pedido ou do valor econômico da questão com pagamento no início da ação", min: 4344.80, pct_min: 20, pct_max: 30 },
    acrescimo_recurso_ordinario_reclamado: { descricao: "Acréscimo no caso de recurso ordinário sobre o valor do pedido (reclamado)", min: 3128.26, pct: 5 },
    acrescimo_recurso_revista_reclamado: { descricao: "Acréscimo no caso de recurso de revista sobre o valor do pedido e/ou contrarrazões (reclamado)", min: 4344.80, pct: 10 },
    execucao_sentenca_mandatario_especifico: { descricao: "Execução de sentença ou embargos – como mandatário específico para o ato", min: 4344.80, pct: 20 },
    execucao_sentenca_mandatario_causa: { descricao: "Execução de sentença ou embargos – se já for mandatário da causa principal, acrescer", min: 2085.51, pct: 5 },
    processo_cautelar_autonomo: { descricao: "Processos cautelares – como medida autônoma", min: 3128.26, pct: 20 },
    reintegracao_empregado: { descricao: "Processos cautelares – para reintegração de empregado", min: 5213.74, pct: 20 },
    homologacao_judicial_demissao_estavel: { descricao: "Pedido de homologação judicial de demissão de estável e de transação com opção pelo FGTS (sobre o valor da transação)", min: 4344.80, pct: 20 },
    dissidio_coletivo_ate_100_empregados: { descricao: "Dissídios coletivos: representação em dissídio, acordo ou convenção coletiva – empresa de até 100 empregados", min: 8689.58 },
    dissidio_coletivo_101_300_empregados: { descricao: "Dissídios coletivos – empresa de 101 até 300 empregados", min: 10427.52 },
    dissidio_coletivo_301_600_empregados: { descricao: "Dissídios coletivos – empresa de 301 até 600 empregados", min: 12165.42 },
    dissidio_coletivo_acima_600_empregados: { descricao: "Dissídios coletivos – empresa com mais de 600 empregados", min: 16510.22 },
    dissidio_sindicato_ate_50_empresas: { descricao: "Dissídios coletivos – sindicato com até 50 empresas", min: 12165.42 },
    dissidio_sindicato_acima_50_empresas: { descricao: "Dissídios coletivos – sindicato com mais de 50 empresas", min: 20855.02 },
    dissidio_sindicato_empregados: { descricao: "Dissídios coletivos – sindicato de empregados: aplicam-se os mesmos valores ou valor recolhido pelo sindicato a título de contribuição assistencial", pct: 20 },
    inquerito_apuracao_falta_grave_defesa: { descricao: "O inquérito judicial para a apuração de falta grave de empregado – defesa do empregado", min: 3475.84, pct: 20 },
    inquerito_apuracao_falta_grave_proposicao: { descricao: "O inquérito judicial para a apuração de falta grave de empregado – propositura do inquérito", min: 6082.72, pct: 20 },
    consultoria_sindicato_associado: { descricao: "Consultoria s/vínculo de sindicato de trabalhadores – na reclamatória do associado, sobre o valor auferido", min: 4344.80, pct: 20 },
    consultoria_sindicato_nao_associado: { descricao: "Consultoria s/vínculo de sindicato de trabalhadores – na reclamatória do não associado, sobre o valor auferido", min: 4344.80, pct: 20 },
    consultoria_empresa_ate_50_empregados: { descricao: "Consultoria s/vínculo empregatício de empresas com menos de 50 empregados", min: 8689.58 },
    consultoria_empresa_acima_50_empregados: { descricao: "Consultoria s/vínculo empregatício de empresa com mais de 50 empregados", min: 12165.42 },
    habilitacao_credito_trabalhista: { descricao: "Habilitação de crédito trabalhista tempestiva/retardatária", pct: 10 },
    acao_indenizatoria_acidente_trabalho: { descricao: "Ação de indenização por acidente de trabalho – sobre o valor econômico da questão", min: 5392.48, pct_min: 20, pct_max: 30 },
  },
  criminal: {
    diligencia_tco_diurno: { descricao: "Diligência em termo circunstanciado de Juizados Especiais Criminais – horário diurno (das 7 às 19 horas)", min: 2311.05 },
    diligencia_tco_noturno: { descricao: "Diligência em termo circunstanciado de Juizados Especiais Criminais – horário noturno (das 19h às 7h)", min: 4171.01 },
    atuacao_inquerito_policial: { descricao: "Atuação em inquérito policial (e outras investigações criminais) desde a instauração de portaria até a apresentação de relatório final", min: 10427.52 },
    ato_judicial: { descricao: "Ato judicial", min: 5213.74 },
    atos_orgaos_policiais_diurno: { descricao: "Atos em órgãos policiais – horário diurno (das 7 às 19h)", min: 2085.51 },
    atos_orgaos_policiais_noturno: { descricao: "Atos em órgãos policiais – horário noturno (das 19 às 7h)", min: 5213.74 },
    exame_processo_penal_parecer_verbal: { descricao: "Exame de processo penal com parecer verbal", min: 6082.72 },
    defesa_procedimento_sumario: { descricao: "Defesa em procedimento sumário (desde a denúncia até a publicação da sentença)", min: 12165.42 },
    defesa_procedimento_comum: { descricao: "Defesa em procedimento comum (desde a denúncia até a publicação da sentença)", min: 16510.22 },
    defesa_procedimento_especial: { descricao: "Defesa em procedimentos especiais (desde a denúncia até a publicação da sentença)", min: 24330.86 },
    defesa_procedimento_especial_foro_privilegiado: { descricao: "Defesa em procedimentos especiais, com foro privilegiado (desde a denúncia até a publicação da sentença)", min: 36496.28 },
    defesa_juri_ate_pronuncia: { descricao: "Defesa em procedimento de júri (desde a denúncia até a sentença de pronúncia)", min: 36496.28 },
    defesa_juri_plenario: { descricao: "Defesa em procedimento de júri: atuação em plenário e recursos inerentes no Tribunal do Estado", min: 36496.28 },
    queixa_crime_representacao: { descricao: "Assistência à acusação – oferecimento de queixa-crime ou representação", min: 6082.72 },
    acompanhamento_acusacao: { descricao: "Assistência à acusação – acompanhamento", min: 9210.96 },
    defesa_execucao_penal: { descricao: "Defesa em processo de execução penal", min: 12165.42 },
    liberdade_provisoria_relaxamento_flagrante: { descricao: "Pedido de suspensão condicional da pena, de reabilitação, de liberdade provisória, de relaxamento de flagrante ou concessão de fiança", min: 8168.22 },
    livramento_condicional_progressao_regime: { descricao: "Pedido de concessão de graça, indulto, anistia, livramento condicional, progressão de regime ou qualquer pedido incidental de benefício em processo de execução penal", min: 8168.22 },
    acompanhamento_busca_apreensao: { descricao: "Acompanhamento de busca e apreensão", min: 5213.74 },
    acompanhamento_busca_apreensao_propriedade_imaterial: { descricao: "Acompanhamento de busca e apreensão em procedimento de crime contra a propriedade imaterial", min: 10427.52 },
    habeas_corpus_autonomo: { descricao: "Impetração de ação autônoma de habeas corpus preventivo ou liberatório", min: 16510.22 },
    habeas_corpus_plantao: { descricao: "Impetração de ação autônoma de habeas corpus preventivo ou liberatório, em horário de plantão", min: 24330.86 },
    habeas_corpus_trancamento: { descricao: "Impetração de ação autônoma de habeas corpus para trancamento de ação penal", min: 16510.22 },
    mandado_seguranca_penal: { descricao: "Impetração de ação autônoma de mandado de segurança contra ato jurisdicional penal", min: 16510.22 },
    revisao_criminal: { descricao: "Impetração de ação autônoma de revisão criminal", min: 16510.22 },
    apelacao_2_grau: { descricao: "Atuação em segundo grau – interposição de apelação", min: 12165.42 },
    memoriais_2_grau: { descricao: "Atuação em segundo grau – elaboração e apresentação de memoriais", min: 6082.72 },
    sustentacao_oral_2_grau: { descricao: "Atuação em segundo grau – sustentação oral", min: 6082.72 },
    embargos_infringentes: { descricao: "Atuação em segundo grau – embargos infringentes", min: 6082.72 },
    embargos_declaratorios: { descricao: "Atuação em segundo grau – embargos declaratórios", min: 5213.74 },
    agravo_execucao_penal: { descricao: "Agravo em execução penal", min: 7661.85 },
    habeas_corpus_tribunais_superiores_execucao: { descricao: "Impetração de habeas corpus perante os Tribunais Superiores em sede de execução penal (nas hipóteses de cabimento)", min: 16418.25 },
    atendimento_preso_videoconferencia: { descricao: "Atendimento ao cliente preso/a pelo sistema de videoconferência", min: 547.28 },
    sindicancia_administracao_penitenciaria_administrativa: { descricao: "Atuação em sindicância no âmbito da administração Penitenciária, por acusação e falta disciplinar – fase administrativa", min: 3830.93 },
    sindicancia_administracao_penitenciaria_judicial: { descricao: "Atuação em sindicância no âmbito da administração Penitenciária, por acusação e falta disciplinar – fase judicial (1ª instância)", min: 5472.75 },
    transferencia_unidades_sp: { descricao: "Pedido de transferência entre unidades prisionais do Estado de São Paulo, no âmbito da Administração Penitenciária", min: 3283.65 },
    transferencia_outro_estado: { descricao: "Pedido de transferência para unidade prisional de outro Estado da Federação", min: 7661.85 },
    atuacao_eca: { descricao: "Atuação em processo relativo ao Estatuto da Criança e do Adolescente", min: 14250.93 },
    cumprimento_precatoria_criminal: { descricao: "Cumprimento de precatória", min: 3128.26 },
    audiencia_nomeacao_juiz: { descricao: "Atuação em audiência por nomeação de juiz", min: 3128.26 },
  },
  fiscal_tributario: {
    proc_defesa_admin_1_instancia: { descricao: "Procedimento ou defesa administrativa – 1ª instância", min: 4344.80, pct: 10 },
    proc_defesa_admin_2_instancia: { descricao: "Procedimento ou defesa administrativa – 2ª instância", min: 4344.80, pct: 10 },
    parecer_normas_tributarias: { descricao: "Parecer sobre interpretação de normas tributárias, planejamento tributário ou qualquer tipo de lançamento realizado contra o interessado pelo fisco", min: 8689.58, pct: 10 },
    acao_anulatoria_debito_tributario: { descricao: "Ação anulatória de débito tributário (sobre o montante excluído)", min: 10427.52, pct: 15 },
    defesa_execucao_fiscal: { descricao: "Defesa em execução de natureza fiscal, sobre o valor da ação", min: 10427.52, pct: 15 },
    acao_repeticao_indebito: { descricao: "Ação de repetição de indébito (sobre o montante repetido)", min: 8689.58, pct: 15 },
    liberacao_mercadorias: { descricao: "Liberação de mercadorias", min: 4344.80, pct: 10 },
    outros_proc_fiscal: { descricao: "Outros procedimentos em matéria fiscal ou tributária", min: 4344.80, pct: 10 },
    consultoria_micro_pequena_empresa: { descricao: "Consultoria s/vínculo empregatício – micro e pequena empresa", min: 2085.51 },
    consultoria_ltda: { descricao: "Consultoria s/vínculo empregatício – Ltda.", min: 6082.72 },
    consultoria_sa: { descricao: "Consultoria s/vínculo empregatício – S/A", min: 10427.52 },
    consultoria_demais_entidades: { descricao: "Consultoria s/vínculo empregatício – demais entidades (cooperativas, sociedades civis etc.)", min: 4344.80 },
  },
  consumidor: {
    proc_defesa_admin_empresa: { descricao: "Procedimento ou defesa administrativa sobre o valor econômico envolvido, como mandatário da empresa", min: 6082.72, pct: 20 },
    parecer_normas_consumo: { descricao: "Parecer sobre normas de relação de consumo", min: 4344.80, pct: 20 },
    acao_consumidor_fato_produto_servico: { descricao: "Ação movida pelo consumidor, visando responsabilizar o fornecedor pelo fato do produto e do serviço", min: 6082.72, pct: 20 },
    acao_consumidor_vicio_produto: { descricao: "Ação movida pelo consumidor, visando responsabilizar o fornecedor por vício do produto e do serviço", min: 6082.72, pct: 20 },
    acao_consumidor_publicidade_enganosa: { descricao: "Ação movida pelo consumidor, visando responsabilizar o fornecedor por publicidade enganosa ou abusiva", min: 6082.72, pct: 20 },
    acao_consumidor_clausulas_abusivas: { descricao: "Ação movida pelo consumidor, visando à nulidade de cláusulas abusivas constantes em contratos de consumo", min: 6082.72, pct: 20 },
    defesa_acao_consumidor: { descricao: "Defesa em ação judicial movida pelo consumidor, sobre o valor atualizado da ação", min: 10427.52, pct: 20 },
    audiencia_isolada_prova_oral: { descricao: "Atuação em audiência isolada, para coleta de prova oral", min: 2433.09 },
    representacao_convencao_coletiva_entidade_consumidores: { descricao: "Representação em convenção coletiva de consumo – entidade civil de consumidores", min: 4344.80 },
    representacao_convencao_coletiva_associacao_fornecedores: { descricao: "Representação em convenção coletiva de consumo – associação de fornecedores", min: 6082.72 },
    representacao_convencao_coletiva_sindicato: { descricao: "Representação em convenção coletiva de consumo – sindicato de categoria econômica de consumidores e de fornecedores", min: 8689.58 },
    consultoria_empresa_pequeno_porte: { descricao: "Consultoria s/vínculo empregatício – empresas de pequeno porte", min: 6951.68 },
    consultoria_empresa_medio_porte: { descricao: "Consultoria s/vínculo empregatício – empresas de médio porte", min: 9558.54 },
    consultoria_empresa_grande_porte: { descricao: "Consultoria s/vínculo empregatício – empresas de grande porte", min: 12165.42 },
    consultoria_entidade_civil_consumidores: { descricao: "Consultoria s/vínculo empregatício – entidade civil de consumidores", min: 10427.52 },
    consultoria_associacao_fornecedores: { descricao: "Consultoria s/vínculo empregatício – associações de fornecedores", min: 10427.52 },
    consultoria_sindicato_categoria: { descricao: "Consultoria s/vínculo empregatício – sindicato de categoria econômica de consumidores e fornecedores", min: 13034.38 },
  },
  ambiental_urbanistico: {
    analise_contrato_ambiental: { descricao: "Análise dos aspectos ambientais e/ou urbanísticos de contrato", min: 3475.84, pct: 3 },
    proc_defesa_admin_auto_infracao: { descricao: "Procedimentos ou defesa administrativa, inclusive auto de infração, sobre o valor econômico", min: 5213.74, pct: 10 },
    acompanhamento_licenciamento: { descricao: "Atuação ou acompanhamento de licenciamento ou certificação ambiental ou urbanística", min: 8689.58, pct: 3 },
    defesa_inquerito_civil: { descricao: "Processo contencioso – defesa em inquérito civil", min: 8689.58 },
    defesa_processo_civil: { descricao: "Processo contencioso – defesa em processo civil", min: 12165.42, pct: 20 },
    acao_civil_publica: { descricao: "Atuação em inquérito civil público ou ação civil pública", min: 17379.18, pct: 20 },
    audiencia_isolada_prova: { descricao: "Atuação em audiência isolada para coleta de prova", min: 2433.09 },
    acompanhamento_estudos_ambientais: { descricao: "Acompanhamento de estudos ambientais ou urbanísticos, sobre projeto ambiental ou urbanístico ou qualquer tipo de lançamento realizado contra o interessado", min: 10427.52, pct: 15 },
    parecer_normas_ambientais: { descricao: "Parecer sobre interpretação de normas ambientais ou urbanísticas, sobre projeto ambiental ou qualquer tipo de lançamento realizado contra o interessado", min: 6951.68, pct: 5 },
    processo_crime_ambiental: { descricao: "Processo-crime ambiental", min: 20855.02 },
    audiencia_publica_ambiental: { descricao: "Atuação em audiência pública em matéria ambiental e urbanística", min: 3081.41 },
    assessoria_regularizacao_ambiental: { descricao: "Assessoria em regularização ambiental ou fundiária", pct: 10 },
    acao_popular: { descricao: "Ação popular", pct: 5 },
    mandado_seguranca_ambiental: { descricao: "Mandado de segurança em matéria ambiental ou urbanística", pct: 10 },
    acao_anulatoria_auto_infracao: { descricao: "Ação anulatória de auto de infração", pct: 10 },
    embargos_execucao_ambiental: { descricao: "Embargos à execução (ambiental/urbanístico)", pct: 10 },
    tutelas_urgencia_ambiental: { descricao: "Tutelas de urgência em matéria ambiental ou urbanística", pct: 5 },
    compliance_ambiental: { descricao: "Assessoria e consultoria em 'compliance' ambiental ou urbanística", min: 10427.52 },
    assessoria_esg: { descricao: "Assessoria e consultoria em ESG", min: 17379.18 },
    due_diligence_ambiental: { descricao: "Assessoria e consultoria em 'due diligence' ambiental ou urbanística", min: 5213.75 },
    assessoria_sustentabilidade: { descricao: "Assessoria e consultoria em questões de sustentabilidade", min: 3081.41 },
    participacao_audiencia_publica: { descricao: "Participação em audiência pública", min: 1545.51 },
    participacao_reunioes_tecnicas: { descricao: "Participação em reuniões técnicas em órgãos urbano e ambientais", min: 875.64 },
  },
  previdenciario: {
    segurado: {
      // Fase Administrativa
      concessao_aposentadoria_bpc_adm: { descricao: "Concessão/Restabelecimento de aposentadoria, auxílio-acidente, pensão por morte e BPC – Fase Administrativa", min: 3503.16, pct_min: 20, pct_max: 30 },
      concessao_auxilio_doenca_adm: { descricao: "Concessão/Restabelecimento de auxílio-doença ou auxílio-reclusão – Fase Administrativa", min: 1167.72, pct_min: 20, pct_max: 30 },
      concessao_salario_maternidade_adm: { descricao: "Concessão de salário-maternidade – Fase Administrativa", min: 1167.72, pct_min: 20, pct_max: 30 },
      revisao_beneficio_adm: { descricao: "Revisão de benefício – Fase Administrativa", min: 3503.16, pct_min: 20, pct_max: 30 },
      certidao_tempo_contribuicao: { descricao: "Solicitação e expedição de Certidão de Tempo de Contribuição", min: 2606.88 },
      justificacao_administrativa: { descricao: "Justificação administrativa, além do valor bruto do benefício", min: 3475.84 },
      retificacao_cnis: { descricao: "Retificação e atualização do CNIS – Cadastro Nacional de Informações Sociais", min: 2606.88 },
      regularizacao_recolhimento: { descricao: "Regularização de recolhimento previdenciário", min: 2606.88 },
      calculo_planejamento_previdenciario: { descricao: "Cálculo e planejamento previdenciário", min: 3475.84 },
      retificacao_ppp: { descricao: "Retificação de PPP", min: 1545.51 },
      pedido_formularios_ppp_ltcat: { descricao: "Pedido e organização de formulários previdenciários (PPP, LTCAT)", min: 1545.51 },
      sustentacao_oral_admin: { descricao: "Sustentação oral perante órgãos recursais administrativos", min: 1737.92 },
      defesa_suspensao_beneficio: { descricao: "Defesa administrativa para evitar a suspensão do benefício previdenciário ou assistencial", min: 3475.84, pct_min: 20, pct_max: 30 },
      restituicao_valores_indevidos_adm: { descricao: "Restituição de valores indevidamente cobrados e/ou declaração de inexigibilidade – Fase Administrativa", min: 3475.84, pct_min: 20, pct_max: 30 },
      // Fase Judicial
      acao_concessao_aposentadoria_bpc: { descricao: "Ação de concessão/restabelecimento de aposentadoria, auxílio-acidente, pensão por morte e BPC", min: 3503.16, pct_min: 20, pct_max: 30 },
      acao_concessao_auxilio_doenca: { descricao: "Ação de concessão/restabelecimento de auxílio-doença ou auxílio-reclusão", min: 1167.72, pct_min: 20, pct_max: 30 },
      acao_concessao_salario_maternidade: { descricao: "Ação para concessão de salário-maternidade", min: 1167.72, pct_min: 20, pct_max: 30 },
      acao_revisao_beneficio: { descricao: "Ação de revisão de benefício", min: 3503.16, pct_min: 20, pct_max: 30 },
      acao_reconhecimento_tempo_servico: { descricao: "Ação de reconhecimento de tempo de serviço/contribuição", min: 3475.84 },
      acao_manutencao_beneficio: { descricao: "Ação visando à manutenção de benefício previdenciário", min: 3503.16, pct_min: 20, pct_max: 30 },
      acao_restituicao_valores_indevidos: { descricao: "Ação de restituição de valores indevidamente cobrados e/ou declaração de inexigibilidade", min: 3475.84, pct_min: 20, pct_max: 30 },
      mandado_injuncao_habeas_data: { descricao: "Mandado de injunção e habeas data individual", min: 5213.76 },
      mandado_seguranca_individual: { descricao: "Mandado de segurança individual", min: 5213.76 },
      acao_rescisoria: { descricao: "Ação rescisória previdenciária", min: 5213.76 },
      acoes_coletivas: { descricao: "Ações coletivas", min: 5213.76 },
      sustentacao_oral_judicial: { descricao: "Sustentação oral – Fase Judicial", min: 1737.92 },
      atuacao_fase_recursal_judicial: { descricao: "Atuação somente a partir da fase recursal – Judicial", min: 3503.16, pct_min: 20, pct_max: 30 },
    },
    empresarial: {
      consultoria_hora: { descricao: "Consultoria mensal sem vínculo empregatício – por hora trabalhada", min: 868.96 },
      consultoria_ate_20_empregados: { descricao: "Consultoria para empresas com até 20 empregados", min: 3475.84 },
      consultoria_21_40_empregados: { descricao: "Consultoria para empresas com 21 a 40 empregados", min: 6951.68 },
      consultoria_acima_41_empregados: { descricao: "Consultoria para empresas com acima de 41 empregados", min: 8689.60 },
      parecer_normas_previdenciarias: { descricao: "Parecer sobre interpretação de normas previdenciárias, planejamento ou enquadramento pelo MPS/INSS", min: 8689.60 },
      proc_admin_acidente_trabalho: { descricao: "Processo Administrativo – Acidente do Trabalho", min: 5213.76 },
      proc_admin_recursal_acidente: { descricao: "Processo Administrativo Fase Recursal – Acidente do Trabalho", min: 2606.88 },
      programa_reabilitacao_profissional: { descricao: "Atuação no Programa de Reabilitação Profissional junto ao INSS", min: 5213.76 },
      contestacao_fap: { descricao: "Contestação FAP", min: 8689.60 },
      acao_descaracterizacao_acidente: { descricao: "Ação de Descaracterização de Acidente do Trabalho", min: 5213.76 },
      acao_reducao_fap_sat: { descricao: "Ação de Redução Alíquota FAP/SAT", min: 5213.76, pct_min: 20, pct_max: 30 },
      acao_repeticao_indebito: { descricao: "Ação de Repetição de Indébito ou Compensação", min: 5213.76, pct_min: 20, pct_max: 30 },
      defesa_acao_regressiva: { descricao: "Defesa em Ação Regressiva Previdenciária – Acidente do Trabalho", min: 5213.76, pct_min: 20, pct_max: 30 },
      defesa_penal_apropriao_indebita: { descricao: "Defesa em ação penal de apropriação indébito previdenciário", min: 8378.99, pct: 30 },
    },
  },
  eleitoral: {
    representacao_impugnacao: { descricao: "Representação ou impugnação", min: 10427.52 },
    defesa_processo_eleitoral: { descricao: "Defesa em processo eleitoral (investigação judicial ou impugnação de mandato)", min: 16510.22 },
    defesa_crime_eleitoral: { descricao: "Defesa por crime eleitoral", min: 24330.86 },
    outros_procedimentos_justica_eleitoral: { descricao: "Outros procedimentos ou atos perante a Justiça Eleitoral", min: 8689.58 },
  },
  transito: {
    defesa_previa_recurso_infracao: { descricao: "Assistência a defesa prévia e recursos de infração de trânsito – Fase Administrativa", min: 521.37, pct: 20 },
    suspensao_habilitacao_pontuacao: { descricao: "Suspensão do direito de dirigir por pontuação", min: 1172.18, pct: 20 },
    suspensao_habilitacao_infracao: { descricao: "Suspensão do direito de dirigir por infração que preveja essa penalidade administrativa", min: 2085.51, pct: 20 },
    sumario_cfc: { descricao: "Sumário de Centro de Formação de Condutores", min: 4344.80, pct: 20 },
    sumario_crd: { descricao: "Sumário de Centro de Remoção e Depósito", min: 4344.80, pct: 20 },
    sumario_crva: { descricao: "Sumário de Centro de Registros de Veículos Automotores", min: 4344.80, pct: 20 },
    perante_detran_cetran: { descricao: "Perante o Departamento Estadual de Trânsito / Conselho Estadual de Trânsito", min: 4344.80 },
    acao_defesa_judicial: { descricao: "Ação ou defesa – Fase Judicial", min: 6951.68, pct: 20 },
  },
  desportivo: {
    defesa_tjd_1_grau: { descricao: "Defesa Justiça Desportiva por denunciado (1º grau CD – Pleno do TJD)", min: 1390.33 },
    defesa_stjd_2_grau: { descricao: "Defesa Justiça Desportiva por denunciado (2º grau oriundo dos TJDs, CD e Pleno do STJD)", min: 2780.67 },
    procedimentos_especiais: { descricao: "Procedimentos Especiais na Justiça Desportiva", min: 3475.84 },
    acao_civel_ordinaria: { descricao: "Ação Cível – procedimento ordinário (proposição ou defesa)", min: 8689.58, pct: 20 },
    acao_civel_sumaria: { descricao: "Ação Cível – procedimento sumário (proposição ou defesa)", min: 5213.74, pct: 20 },
    patrocinio_reclamante: { descricao: "Ação Trabalhista – patrocínio de reclamante (sobre a condenação ou acordo)", min: 5213.74, pct: 20 },
    patrocinio_reclamado: { descricao: "Ação Trabalhista – patrocínio de reclamado (sobre o valor real do pedido)", min: 5213.74, pct: 20 },
    consultoria_mais_35_atletas: { descricao: "Consultoria jurídica s/vínculo – entidade com mais de 35 atletas e/ou membros de comissões técnicas", min: 17379.18 },
    consultoria_menos_35_atletas: { descricao: "Consultoria jurídica s/vínculo – entidade com menos de 35 atletas e/ou membros de comissões técnicas", min: 8689.58 },
    proc_litigioso_nacional_regional: { descricao: "Procedimento litigioso frente às entidades de administração do desporto – âmbito nacional e regional", min: 8689.58, pct: 20 },
    proc_litigioso_fifa_cas: { descricao: "Procedimento litigioso frente à Fifa e TAS/CAS", min: 34758.37, pct: 20 },
  },
  tribunais_conselhos: {
    agravo_instrumento: { descricao: "Recurso de agravo de instrumento – Tribunais Estaduais e/ou Regionais", min: 6082.72 },
    apelacao_contrarrazoes: { descricao: "Recurso de apelação ou contrarrazões – Tribunais Estaduais e/ou Regionais", min: 8168.22 },
    embargos_declaratorios_infringentes: { descricao: "Embargos declaratórios ou embargos infringentes", min: 6082.72 },
    conflito_jurisdicao: { descricao: "Conflito de jurisdição", min: 6082.72 },
    excecao_suspeicao: { descricao: "Exceção de suspeição", min: 6082.72 },
    outros_tribunais_estaduais: { descricao: "Outros procedimentos – Tribunais Estaduais e/ou Regionais", min: 6082.72 },
    recurso_especial_extraordinario: { descricao: "Recurso especial e extraordinário (interposição/resposta) – Tribunais Superiores", min: 16510.22 },
    outros_recursos_superiores: { descricao: "Outros recursos – Tribunais Superiores", min: 12165.42 },
    outros_procedimentos_superiores: { descricao: "Outros procedimentos – Tribunais Superiores", min: 8168.22 },
    acao_rescisoria: { descricao: "Ação rescisória – proposição ou defesa", min: 10427.52, pct: 20 },
    mandado_injuncao_tribunal: { descricao: "Mandado de Injunção perante Tribunais", min: 12165.42 },
    mandado_seguranca_tribunal: { descricao: "Mandado de segurança perante Tribunais", min: 12165.42 },
    tribunal_contas: { descricao: "Atuação perante Tribunal de Contas", min: 16510.22 },
    conselho_profissional: { descricao: "Atuação perante Conselho Profissional", min: 10427.52 },
    conselho_administrativo: { descricao: "Atuação perante Conselho Administrativo", min: 12165.42 },
    sustentacao_oral_estaduais: { descricao: "Sustentação oral – Tribunais estaduais, regionais e conselhos estaduais", min: 8689.58 },
    sustentacao_oral_superiores: { descricao: "Sustentação oral – Tribunais superiores e conselhos federais", min: 12165.42 },
  },
  diligencias_correspondente: {
    distribuicao_peticoes: { descricao: "Distribuição de petições em qualquer área", min: 154.08 },
    distribuicao_acao_1_instancia: { descricao: "Distribuição de ação em qualquer área (primeira instância)", min: 231.10 },
    distribuicao_recurso: { descricao: "Distribuição de qualquer recurso", min: 308.13 },
    audiencia_conciliacao: { descricao: "Audiência de conciliação em qualquer área como advogado/a ou representante", min: 539.25 },
    audiencia_instrucao: { descricao: "Audiência de instrução em qualquer área como advogado/a ou representante", min: 1078.49 },
    acompanhamento_cliente_policial: { descricao: "Acompanhamento a cliente em repartição policial por ato", min: 924.43 },
    despacho_juiz_secretaria: { descricao: "Despacho com juiz ou chefe de secretaria", min: 539.25 },
    despacho_orgao_publico: { descricao: "Despacho em qualquer órgão público", min: 539.25 },
    acompanhamento_exames_periciais: { descricao: "Acompanhamento a clientes em exames periciais", min: 924.43 },
    requerimento_certidoes: { descricao: "Requerimentos de certidões ou qualquer outro documento e envio", min: 308.13 },
    retirada_alvara: { descricao: "Retirada/levantamento, envio de alvará", min: 308.13 },
    acompanhamento_busca_apreensao_veiculo: { descricao: "Acompanhamento de busca e apreensão de veículo ou outros bens", min: 770.35 },
    extracao_copia_autos: { descricao: "Extração de cópia de autos (até 100 cópias)", min: 154.08 },
    digitalizacao_autos: { descricao: "Digitalização dos autos", min: 154.08 },
    acompanhamento_movimentacao_processual: { descricao: "Acompanhamento de movimentação processual (processo físico ou PJE)", min: 462.21 },
    distribuicao_carta_precatoria: { descricao: "Distribuição de carta precatória", min: 231.10 },
    preenchimento_guias_custas: { descricao: "Preenchimento de guias e pagamentos de custas", min: 231.10 },
  },
  autocompositivos: {
    consulta_generica: { descricao: "Consulta genérica acerca dos benefícios e características da utilização dos métodos autocompositivos", min: 492.66 },
    consulta_identificacao_metodo: { descricao: "Consulta para identificação do método autocompositivo adequado, com análise detalhada de documentos", min: 1055.70 },
    hora_tecnica: { descricao: "Hora técnica e intelectual para análise dos elementos do conflito e assessoria jurídico-estratégica", min: 793.90 },
    acompanhamento_sessao_mediacao: { descricao: "Acompanhamento em sessão ou reunião de Práticas Colaborativas, Mediação, Conciliação, Negociação ou qualquer método autocompositivo (por ato)", min: 2222.92 },
    elaboracao_termo_acordo: { descricao: "Elaboração e/ou revisão de Termo de Acordo total ou parcial resultante de método autocompositivo", min: 4504.37, pct: 3 },
    homologacao_acordo_extrajudicial: { descricao: "Requerimento de homologação de acordo extrajudicial perante o Poder Judiciário", min: 3764.42 },
    assessoria_procedimento_completo: { descricao: "Assessoria jurídica exclusivamente para procedimento autocompositivo (todas as etapas)", min: 9034.61, pct_min: 6, pct_max: 10 },
  },
  condominial: {
    assessoria_consultoria_mensal: { descricao: "Assessoria e Consultoria mensal especializada (até 100 unidades)", min: 1545.51 },
    consulta: { descricao: "Consulta âmbito condominial", min: 875.64 },
    cobranca_extrajudicial_cotas: { descricao: "Cobrança extrajudicial de cotas condominiais/multas", pct: 10 },
    elaboracao_convencao_estatuto: { descricao: "Elaboração/alteração de Convenção ou Estatuto condominial", min: 10945.50 },
    elaboracao_regimento_interno: { descricao: "Elaboração/alteração de Regimento Interno de associação ou condomínio", min: 10945.50 },
    participacao_assembleia: { descricao: "Participação e assessoria ao condomínio em assembleia ou reunião", min: 1587.10 },
    acao_prestacao_contas: { descricao: "Ação de Prestação de contas", min: 6348.39 },
    acao_restituicao_valores: { descricao: "Ação de restituição de valores", min: 4159.29 },
    acao_impugnacao_assembleia: { descricao: "Ação de impugnação de assembleia", min: 5691.66 },
    acao_impugnacao_assembleia_liminar: { descricao: "Ação de impugnação de assembleia c/c pedido de liminar", min: 7114.58 },
    acao_vicios_construtivos: { descricao: "Ação de vícios construtivos", min: 16418.25 },
    acao_antecipacao_provas_vicios: { descricao: "Ação de antecipação de provas (vícios construtivos)", min: 10945.50 },
    acao_exclusao_condominial_antissocial: { descricao: "Ação exclusão de condômino antissocial", min: 16418.25 },
    acao_defesa_sindico: { descricao: "Ação defesa do(a) síndico(a)", min: 6567.30 },
    acao_indenizatoria: { descricao: "Ação indenizatória (favorável ou contra gestão)", min: 6567.30 },
  },
  privacidade_lgpd: {
    mapeamento_dados: { descricao: "Mapeamento de dados pessoais (por processo)", min: 492.55 },
    elaboracao_politicas: { descricao: "Elaboração de políticas ou procedimentos (por política/procedimento)", min: 3562.76 },
    elaboracao_dpia: { descricao: "Elaboração de Relatório de Impacto à Proteção de Dados Pessoais (DPIA)", min: 8001.16 },
    avaliacao_legitimo_interesse: { descricao: "Avaliação do Legítimo Interesse (LIA)", min: 2850.21 },
    plano_atendimento_titulares: { descricao: "Elaboração de plano de atendimento aos titulares de dados", min: 4987.87 },
    plano_resposta_incidentes: { descricao: "Elaboração do Plano de Resposta a Incidentes com Dados Pessoais", min: 7125.52 },
    privacy_by_design: { descricao: "Suporte e orientação para aplicação do Privacy by Design, por produto/serviço/solução", min: 4987.87 },
    programa_governanca: { descricao: "Elaboração do programa de governança em proteção de dados pessoais", min: 11400.84 },
    termo_consentimento: { descricao: "Elaboração de termo de consentimento (por termo)", min: 1532.37 },
    gap_analysis: { descricao: "Análise dos processos internos e proposição de melhorias – GAP Analysis (por processo)", min: 492.55 },
    comunicacao_incidente_anpd: { descricao: "Elaboração da comunicação de incidente à ANPD / titulares e demais notificações", min: 4987.87 },
    resposta_oficio_anpd: { descricao: "Resposta à ofício da ANPD e outros órgãos competentes", min: 2850.21 },
    resposta_requisicao_titular: { descricao: "Resposta a requisição do titular de dados pessoais (por requisição)", min: 766.19 },
    treinamento_palestras: { descricao: "Treinamento, palestras, workshops (por evento)", min: 7125.52 },
    gestao_incidentes_pequeno_porte: { descricao: "Suporte na gestão de incidentes – agentes de tratamento de pequeno porte (por incidente)", min: 9211.74 },
    gestao_incidentes_demais: { descricao: "Suporte na gestão de incidentes – demais agentes de tratamento (por incidente)", min: 25629.99 },
    dpo_as_service_hora: { descricao: "Atuação como DPO as a Service (por hora)", min: 997.57 },
    proc_defesa_admin_pequeno_porte: { descricao: "Procedimento ou defesa administrativa – agentes de tratamento de pequeno porte", min: 8001.16, pct: 20 },
    proc_defesa_admin_demais: { descricao: "Procedimento ou defesa administrativa – demais agentes de tratamento", min: 5177.22, pct: 20 },
    proc_defesa_admin_titular: { descricao: "Procedimento ou defesa administrativa como mandatário do titular de dados", min: 5177.22, pct: 20 },
    defesa_controlador_judicial: { descricao: "Defesa dos interesses do controlador – Fase Judicial", min: 10288.77, pct: 20 },
    defesa_titular_judicial: { descricao: "Defesa dos interesses do titular de dados – Fase Judicial", min: 5700.42, pct: 20 },
  },
};


// ─────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────
const HON_LABELS: Record<string, Record<string, string>> = {
  extrajudicial: {
    consulta: "Consulta", consulta_excepcional_com_documentos: "Consulta Excepcional c/ Documentos",
    hora_intelectual: "Hora Intelectual", acompanhamento_documentos_orgao_publico: "Acompanhamento em Órgão Público",
    acompanhamento_citacao_notificacao_intimacao: "Acompanhamento Citação/Notificação/Intimação",
    acompanhamento_depoimento_testemunhas: "Acompanhamento Depoimento/Testemunhas",
    cobranca_amigavel: "Cobrança Amigável", consignacao_pagamento_extrajudicial: "Consignação Extrajudicial",
    exame_instrumento_constituicao_pj: "Exame de Instrumento / Constituição PJ",
    elaboracao_notificacao_extrajudicial: "Elaboração de Notificação Extrajudicial",
    elaboracao_minuta_contrato_testamento: "Minuta de Contrato ou Testamento",
    parecer_ou_memorial: "Parecer ou Memorial", requerimento_ou_peticoes: "Requerimentos e Petições",
    exame_processo_geral: "Exame de Processo", intervencao_amigavel: "Intervenção Amigável",
  },
  administrativo: {
    sindicancia_processo_admin_defesa: "Sindicância / Processo Admin. (Defesa)",
    processo_admin_recurso: "Recurso Administrativo",
    acao_defesa_fase_administrativa: "Ação/Defesa — Fase Administrativa",
    recurso_fase_administrativa: "Recurso — Fase Administrativa",
    acao_defesa_fase_judicial: "Ação/Defesa — Fase Judicial",
    recurso_fase_judicial: "Recurso — Fase Judicial",
  },
  juizados_especiais: {
    inicial_contestacao_audiencia: "Inicial / Contestação / Audiência",
    segunda_instancia: "Segunda Instância (Turma Recursal)",
    sustentacao_oral_turmas_recursais: "Sustentação Oral — Turmas Recursais",
  },
  civel: {
    procedimento_ordinario: "Procedimento Ordinário", procedimento_sumario: "Procedimento Sumário",
    cumprimento_sentenca: "Cumprimento de Sentença", impugnacao_cumprimento_sentenca: "Impugnação ao Cumprimento de Sentença",
    execucao_titulo_extrajudicial: "Execução de Título Extrajudicial",
    impugnacao_embargos_execucao_extrajudicial: "Impugnação / Embargos à Execução",
    processo_cautelar_especifico: "Processo Cautelar Específico", processo_cautelar_inominado: "Processo Cautelar Inominado",
    consignacao_pagamento: "Consignação em Pagamento", deposito: "Ação de Depósito",
    anulacao_substituicao_titulo_portador: "Anulação / Substituição de Título ao Portador",
    prestacao_contas: "Prestação de Contas", possessoria_movel: "Possessória (Bem Móvel)", possessoria_imovel: "Possessória (Imóvel)",
    nunciacao_obra_nova: "Nunciação de Obra Nova", usucapiao: "Usucapião", divisao_demarcacao: "Divisão e Demarcação",
    embargos_terceiro: "Embargos de Terceiro", habilitacao: "Habilitação", restauracao_autos: "Restauração de Autos",
    vendas_credito_reserva_dominio: "Vendas a Crédito / Reserva de Domínio", juizo_arbitral: "Juízo Arbitral",
    acao_monitoria: "Ação Monitória", desapropriacao_direta: "Desapropriação Direta", desapropriacao_indireta: "Desapropriação Indireta",
    inominada: "Ação Inominada", retificacao_registro_publico: "Retificação de Registro Público", alvara_judicial: "Alvará Judicial",
    constituicao_extincao_usufruto_fideicomisso: "Constituição/Extinção de Usufruto/Fideicomisso",
    mandado_seguranca: "Mandado de Segurança", acao_despejo: "Ação de Despejo", acao_renovatoria_locacao: "Ação Renovatória de Locação",
    revisao_arbitramento_aluguel: "Revisão / Arbitramento de Aluguel", consignacao_aluguel: "Consignação de Aluguel",
    atos_acompanhamento_despejo_reintegracao: "Atos de Acompanhamento — Despejo/Reintegração",
    dissolucao_sociedade: "Dissolução de Sociedade", cancelamento_protesto: "Cancelamento de Protesto",
    mandado_injuncao: "Mandado de Injunção", habeas_data: "Habeas Data",
    acao_negatoria_propriedade_intelectual: "Ação Negatória — Propriedade Intelectual",
    acao_indenizatoria_contrafacao: "Ação Indenizatória — Contrafação",
    busca_apreensao_propriedade_intelectual: "Busca e Apreensão — Prop. Intelectual",
    proc_admin_propriedade_intelectual: "Proc. Admin. — Prop. Intelectual",
    registro_loteamento_desmembramento: "Registro de Loteamento / Desmembramento", opcao_nacionalidade: "Opção de Nacionalidade",
  },
  falencias_recuperacao: {
    pedido_falencia: "Pedido de Falência", acao_restituicao_reivindicatoria: "Ação de Restituição / Reivindicatória",
    pedido_recuperacao_empresa: "Pedido de Recuperação de Empresa", pedido_declaracao_insolvencia: "Pedido de Declaração de Insolvência",
    habilitacao_credito: "Habilitação de Crédito", representacao_falido: "Representação do Falido",
    representacao_devedor_insolvente: "Representação do Devedor Insolvente", representacao_administrador_judicial: "Representação do Administrador Judicial",
  },
  familia_sucessoes: {
    divorcio_judicial_consensual: "Divórcio Judicial Consensual", divorcio_judicial_com_alimentos_bens: "Divórcio c/ Alimentos / Bens",
    divorcio_judicial_litigioso: "Divórcio Judicial Litigioso", divorcio_judicial_litigioso_com_alimentos_bens: "Divórcio Litigioso c/ Alimentos / Bens",
    reconvencao_divorcio: "Reconvenção em Divórcio", dissolucao_uniao_estavel_consensual: "Dissolução União Estável Consensual",
    dissolucao_uniao_estavel_com_alimentos_bens: "Dissolução União Estável c/ Alimentos / Bens",
    dissolucao_uniao_estavel_litigiosa: "Dissolução União Estável Litigiosa",
    dissolucao_uniao_estavel_litigiosa_com_alimentos_bens: "Dissolução União Estável Litigiosa c/ Alimentos",
    investigacao_paternidade_com_heranca: "Investigação de Paternidade c/ Herança",
    investigacao_paternidade_com_alimentos: "Investigação de Paternidade c/ Alimentos",
    acao_alimentos_provisorios_revisionais: "Ação de Alimentos / Provisórios / Revisional",
    execucao_alimentos: "Execução de Alimentos", curatela: "Curatela", tutela: "Tutela", emancipacao: "Emancipação",
    adocao_nacional: "Adoção Nacional", adocao_estrangeira: "Adoção Estrangeira",
    acao_regulamentacao_visitas: "Ação de Regulamentação de Visitas",
    busca_apreensao_criancas: "Busca e Apreensão de Criança/Adolescente",
    interdito_levantamento: "Interdito / Levantamento", alteracao_guarda: "Alteração de Guarda",
    habeas_corpus_prisao_civil: "Habeas Corpus — Prisão Civil",
    desconsideracao_personalidade_juridica: "Desconsideração da Personalidade Jurídica",
    inventario_sem_litigio: "Inventário sem Litígio", inventario_com_litigio: "Inventário com Litígio",
    inventario_extrajudicial: "Inventário Extrajudicial", acao_declaratoria_indignidade: "Ação Declaratória de Indignidade",
    acao_declaratoria_deserdacao: "Ação Declaratória de Deserdação", retificacao_partilha: "Retificação de Partilha",
    minuta_testamento: "Minuta de Testamento",
  },
  trabalhista: {
    patrocinio_reclamante: "Patrocínio Reclamante", acrescimo_recurso_ordinario_reclamante: "Recurso Ordinário (Reclamante)",
    acrescimo_recurso_revista_reclamante: "Recurso de Revista (Reclamante)", patrocinio_reclamado: "Patrocínio Reclamado",
    acrescimo_recurso_ordinario_reclamado: "Recurso Ordinário (Reclamado)", acrescimo_recurso_revista_reclamado: "Recurso de Revista (Reclamado)",
    execucao_sentenca_mandatario_especifico: "Execução — Mandato Específico", execucao_sentenca_mandatario_causa: "Execução — Mandato na Causa",
    processo_cautelar_autonomo: "Processo Cautelar Autônomo", reintegracao_empregado: "Reintegração de Empregado",
    homologacao_judicial_demissao_estavel: "Homologação Judicial — Demissão de Estável",
    dissidio_coletivo_ate_100_empregados: "Dissídio Coletivo (até 100 emp.)", dissidio_coletivo_101_300_empregados: "Dissídio Coletivo (101–300 emp.)",
    dissidio_coletivo_301_600_empregados: "Dissídio Coletivo (301–600 emp.)", dissidio_coletivo_acima_600_empregados: "Dissídio Coletivo (acima 600 emp.)",
    dissidio_sindicato_ate_50_empresas: "Dissídio Sindical (até 50 emp.)", dissidio_sindicato_acima_50_empresas: "Dissídio Sindical (acima 50 emp.)",
    inquerito_apuracao_falta_grave_defesa: "Inquérito — Falta Grave (Defesa)", inquerito_apuracao_falta_grave_proposicao: "Inquérito — Falta Grave (Proposição)",
    consultoria_empresa_ate_50_empregados: "Consultoria Empresa até 50 Emp.", consultoria_empresa_acima_50_empregados: "Consultoria Empresa acima 50 Emp.",
    habilitacao_credito_trabalhista: "Habilitação de Crédito Trabalhista", acao_indenizatoria_acidente_trabalho: "Indenização — Acidente de Trabalho",
  },
  criminal: {
    diligencia_tco_diurno: "Diligência TCO — Diurno", diligencia_tco_noturno: "Diligência TCO — Noturno",
    atuacao_inquerito_policial: "Atuação em Inquérito Policial", ato_judicial: "Ato Judicial Isolado",
    atos_orgaos_policiais_diurno: "Atos em Órgãos Policiais — Diurno", atos_orgaos_policiais_noturno: "Atos em Órgãos Policiais — Noturno",
    exame_processo_penal_parecer_verbal: "Exame de Processo / Parecer Verbal",
    defesa_procedimento_sumario: "Defesa — Procedimento Sumário", defesa_procedimento_comum: "Defesa — Procedimento Comum",
    defesa_procedimento_especial: "Defesa — Procedimento Especial",
    defesa_procedimento_especial_foro_privilegiado: "Defesa — Proc. Especial / Foro Privilegiado",
    defesa_juri_ate_pronuncia: "Defesa no Júri (até Pronúncia)", defesa_juri_plenario: "Defesa no Júri Plenário",
    queixa_crime_representacao: "Queixa-Crime / Representação", acompanhamento_acusacao: "Acompanhamento de Acusação",
    defesa_execucao_penal: "Defesa na Execução Penal",
    liberdade_provisoria_relaxamento_flagrante: "Liberdade Provisória / Relaxamento de Flagrante",
    livramento_condicional_progressao_regime: "Livramento Condicional / Progressão de Regime",
    acompanhamento_busca_apreensao: "Acompanhamento de Busca e Apreensão",
    habeas_corpus_autonomo: "Habeas Corpus Autônomo", habeas_corpus_plantao: "Habeas Corpus — Plantão",
    habeas_corpus_trancamento: "HC — Trancamento de Ação Penal", mandado_seguranca_penal: "Mandado de Segurança Penal",
    revisao_criminal: "Revisão Criminal", apelacao_2_grau: "Apelação — 2º Grau", memoriais_2_grau: "Memoriais — 2º Grau",
    sustentacao_oral_2_grau: "Sustentação Oral — 2º Grau", embargos_infringentes: "Embargos Infringentes",
    embargos_declaratorios: "Embargos de Declaração", agravo_execucao_penal: "Agravo em Execução Penal",
    habeas_corpus_tribunais_superiores_execucao: "HC — Tribunais Superiores (Execução)",
    atendimento_preso_videoconferencia: "Atendimento ao Preso — Videoconferência",
  },
  fiscal_tributario: {
    proc_defesa_admin_1_instancia: "Defesa Admin. — 1ª Instância", proc_defesa_admin_2_instancia: "Defesa Admin. — 2ª Instância",
    parecer_normas_tributarias: "Parecer sobre Normas Tributárias", acao_anulatoria_debito_tributario: "Ação Anulatória de Débito Tributário",
    defesa_execucao_fiscal: "Defesa em Execução Fiscal", acao_repeticao_indebito: "Ação de Repetição de Indébito",
    liberacao_mercadorias: "Liberação de Mercadorias", outros_proc_fiscal: "Outros Proc. Fiscais",
    consultoria_micro_pequena_empresa: "Consultoria — ME / EPP", consultoria_ltda: "Consultoria — Ltda",
    consultoria_sa: "Consultoria — S/A", consultoria_demais_entidades: "Consultoria — Demais Entidades",
  },
  consumidor: {
    proc_defesa_admin_empresa: "Defesa Admin. — Empresa", parecer_normas_consumo: "Parecer sobre Normas de Consumo",
    acao_consumidor_fato_produto_servico: "Ação Consumidor — Fato do Produto / Serviço",
    acao_consumidor_vicio_produto: "Ação Consumidor — Vício do Produto",
    acao_consumidor_publicidade_enganosa: "Ação Consumidor — Publicidade Enganosa",
    acao_consumidor_clausulas_abusivas: "Ação Consumidor — Cláusulas Abusivas",
    defesa_acao_consumidor: "Defesa em Ação de Consumidor", audiencia_isolada_prova_oral: "Audiência Isolada — Prova Oral",
    consultoria_empresa_pequeno_porte: "Consultoria — Empresa Pequeno Porte",
    consultoria_empresa_medio_porte: "Consultoria — Empresa Médio Porte",
    consultoria_empresa_grande_porte: "Consultoria — Empresa Grande Porte",
  },
  ambiental_urbanistico: {
    analise_contrato_ambiental: "Análise de Contrato Ambiental", proc_defesa_admin_auto_infracao: "Defesa Admin. — Auto de Infração",
    acompanhamento_licenciamento: "Acompanhamento de Licenciamento", defesa_inquerito_civil: "Defesa em Inquérito Civil",
    defesa_processo_civil: "Defesa em Processo Civil Ambiental", acao_civil_publica: "Ação Civil Pública",
    audiencia_isolada_prova: "Audiência Isolada — Prova", parecer_normas_ambientais: "Parecer sobre Normas Ambientais",
    processo_crime_ambiental: "Processo — Crime Ambiental", acao_popular: "Ação Popular",
    mandado_seguranca_ambiental: "Mandado de Segurança Ambiental", compliance_ambiental: "Compliance Ambiental",
    assessoria_esg: "Assessoria ESG", due_diligence_ambiental: "Due Diligence Ambiental",
  },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getLabel(cat: string, key: string, cfg?: any) {
  // Prioridade: descricao do próprio item JSON > HON_LABELS estático > fallback por chave
  if (cfg?.descricao) return cfg.descricao;
  return HON_LABELS[cat]?.[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLabelFromTabela(tabela: any, cat: string, key: string) {
  const cfg = cat === "previdenciario_segurado"
    ? tabela.previdenciario?.segurado?.[key]
    : cat === "previdenciario_empresarial"
    ? tabela.previdenciario?.empresarial?.[key]
    : tabela[cat]?.[key];
  return getLabel(cat, key, cfg);
}

function fmtBRL(v: number) {
  if (!v && v !== 0) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(s: string) {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
}

function getTabelaOAB(): any {
  try {
    const s = localStorage.getItem("jurismonitor_tabela_oab");
    if (s) {
      const salva = JSON.parse(s);
      const merged: any = { ...salva };
      // Para cada chave do default, se ausente na salva OU vazia (objeto sem chaves), usa o default
      for (const key of Object.keys(TABELA_OABSP_DEFAULT)) {
        const defVal = (TABELA_OABSP_DEFAULT as any)[key];
        const salvaVal = salva[key];
        if (typeof defVal !== "object") continue;
        if (!salvaVal || Object.keys(salvaVal).length === 0) {
          merged[key] = defVal;
        } else if (typeof salvaVal === "object") {
          // Deep merge de um nível extra (ex: previdenciario.segurado, previdenciario.empresarial)
          const deepMerged: any = { ...salvaVal };
          for (const subKey of Object.keys(defVal)) {
            if (!salvaVal[subKey] || (typeof salvaVal[subKey] === "object" && Object.keys(salvaVal[subKey]).length === 0)) {
              deepMerged[subKey] = defVal[subKey];
            }
          }
          merged[key] = deepMerged;
        }
      }
      return merged;
    }
  } catch {}
  return TABELA_OABSP_DEFAULT;
}

function salvarTabelaOAB(t: any) {
  localStorage.setItem("jurismonitor_tabela_oab", JSON.stringify(t));
}

// ─────────────────────────────────────────────
// RESULT BOX COMPONENT
// ─────────────────────────────────────────────
interface CalcResult {
  label: string;
  rawMin: number;
  pctValor: number;
  pctLabel: string;
  valorLabel: string;
  minVal: number;
  pctInfo: string;
}

function ResultBox({ result, acordado, tipo, onProposta }: {
  result: CalcResult | null;
  multi?: { results: CalcResult[]; total: number };
  acordado?: number;
  tipo: string;
  onProposta: () => void;
}) {
  if (!result) return null;
  const usarVal = (acordado && acordado > 0) ? acordado : result.minVal;
  const rawMin = result.rawMin;
  const pctValor = result.pctValor;
  const destMin = !pctValor || pctValor <= 0 || rawMin >= pctValor;
  const destPct = pctValor > 0 && pctValor > rawMin;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#0d2a1e" }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: "#c9a84c" }}>
        {result.label}
      </div>
      {/* composição */}
      <div className="text-[0.6rem] font-bold uppercase tracking-wider opacity-40 text-white">
        Composição do valor (✅ = maior)
      </div>
      {rawMin > 0 && (
        <div className={`flex justify-between items-center ${destMin ? "" : "opacity-50"}`}>
          <span className="text-xs text-white">Mínimo fixo OAB-SP 2026{destMin ? " ✅" : ""}</span>
          <span className="font-mono font-bold text-white">{fmtBRL(rawMin)}</span>
        </div>
      )}
      {pctValor > 0 && (
        <div className={`flex justify-between items-center ${destPct ? "" : "opacity-50"}`}>
          <span className="text-xs text-white">{result.pctLabel ? `${result.pctLabel} s/ ${result.valorLabel || "valor"}` : result.pctInfo}{destPct ? " ✅" : ""}</span>
          <span className="font-mono font-bold text-white">{fmtBRL(pctValor)}</span>
        </div>
      )}
      {/* total */}
      <div className="border-t pt-3 flex justify-between items-center" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
        <div>
          <div className="text-xs font-bold" style={{ color: "#e8874a" }}>
            {acordado && acordado > 0 ? "Valor Acordado" : "Valor Mínimo Sugerido"}
          </div>
        </div>
        <div className="text-2xl font-black font-mono" style={{ color: "#e8874a" }}>{fmtBRL(usarVal)}</div>
      </div>
      <div className="text-[0.65rem] opacity-40 text-white">
        ⓘ Valores mínimos conforme Tabela OAB-SP 2026 · art. 22 §2º Estatuto OAB
      </div>
      {/* ações */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onProposta}
          className="flex-1 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1"
          style={{ background: "#1a6b3a" }}
        >
          📄 Gerar Proposta
        </button>
        <button
          onClick={() => {
            const txt = `PROPOSTA — ${result.label}\nValor mínimo OAB-SP: ${fmtBRL(usarVal)}`;
            navigator.clipboard.writeText(txt).then(() => toast.success("Copiado!"));
          }}
          className="px-3 py-2 rounded-lg text-xs font-bold border"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "#ccc" }}
        >
          📋 Copiar
        </button>
      </div>
    </div>
  );
}

function MultiResultBox({ results, total, acordado, tipo, onProposta }: {
  results: CalcResult[]; total: number; acordado?: number; tipo: string; onProposta: () => void;
}) {
  const usarVal = (acordado && acordado > 0) ? acordado : total;
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#0d2a1e" }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: "#c9a84c" }}>
        {results.length} Tipos Selecionados — Soma dos Mínimos
      </div>
      {results.map((r) => (
        <div key={r.label} className="flex justify-between items-center py-1 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="text-xs text-white opacity-80">{r.label}</span>
          <span className="font-mono text-sm font-bold text-white">{fmtBRL(r.minVal)}</span>
        </div>
      ))}
      <div className="border-t pt-3 flex justify-between items-center" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
        <div className="text-xs font-bold" style={{ color: "#e8874a" }}>Total Mínimo OAB-SP 2026</div>
        <div className="text-2xl font-black font-mono" style={{ color: "#e8874a" }}>{fmtBRL(usarVal)}</div>
      </div>
      <div className="text-[0.65rem] opacity-40 text-white">
        ⓘ Valores mínimos conforme Tabela OAB-SP 2026 · art. 22 §2º Estatuto OAB
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={onProposta} className="flex-1 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1" style={{ background: "#1a6b3a" }}>
          📄 Gerar Proposta
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROPOSTA MODAL
// ─────────────────────────────────────────────
function PropostaModal({ texto, onClose }: { texto: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="font-bold text-sm">📄 Proposta de Honorários</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted" onClick={() => { navigator.clipboard.writeText(texto); toast.success("Copiado!"); }}>📋 Copiar</button>
            <button className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted" onClick={onClose}>✕</button>
          </div>
        </div>
        <pre className="p-5 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">{texto}</pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MULTISELECT CHECKBOXES
// ─────────────────────────────────────────────
function MultiSelect({ cat, opcoes, selected, onToggle }: {
  cat: string; opcoes: { value: string; label: string }[];
  selected: Set<string>; onToggle: (v: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
      {opcoes.map((op) => {
        const checked = selected.has(op.value);
        return (
          <label key={op.value}
            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors ${checked ? "bg-accent/10 font-semibold" : "hover:bg-muted/60"}`}
            style={checked ? { borderLeft: "3px solid #c9a84c" } : { borderLeft: "3px solid transparent" }}
          >
            <input type="checkbox" checked={checked} onChange={() => onToggle(op.value)} className="w-4 h-4 accent-amber-600" />
            <span>{op.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// TABELA COMPLETA
// ─────────────────────────────────────────────
function TabelaCompleta() {
  const tabela = getTabelaOAB();
  const cats: [string, string][] = [
    ["extrajudicial", "📄 Extrajudicial"], ["administrativo", "🏛️ Administrativo"],
    ["juizados_especiais", "⚖️ Juizados Especiais"], ["civel", "⚖️ Cível"],
    ["falencias_recuperacao", "📉 Falências e Recuperação"], ["familia_sucessoes", "👨‍👩‍👧 Família e Sucessões"],
    ["trabalhista", "👷 Trabalhista"], ["fiscal_tributario", "💰 Fiscal / Tributário"],
    ["consumidor", "🛒 Consumidor"], ["ambiental_urbanistico", "🌿 Ambiental / Urbanístico"],
    ["criminal", "🔏 Criminal"],
  ];
  return (
    <div className="space-y-6">
      {tabela.observacoes?.geral && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(200,170,60,0.08)", border: "1px solid rgba(200,170,60,0.2)", color: "#7a6200" }}>
          <strong>ⓘ Regra Geral OAB-SP:</strong> {tabela.observacoes.geral}
        </div>
      )}
      {cats.map(([catKey, titulo]) => {
        const dados = tabela[catKey];
        if (!dados) return null;
        return (
          <div key={catKey}>
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{titulo}</div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground">Serviço / Ato</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Mínimo OAB-SP</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">% sobre Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dados).map(([key, cfg]: [string, any]) => {
                    const partes: string[] = [];
                    if (cfg.pct != null && cfg.pct !== "") partes.push(`${cfg.pct}%`);
                    if (cfg.pct_min != null && cfg.pct_max != null) partes.push(`${cfg.pct_min}%–${cfg.pct_max}%`);
                    if (cfg.pct_monte_mor != null) partes.push(`${cfg.pct_monte_mor}% monte-mor`);
                    if (cfg.pct_base) partes.push(String(cfg.pct_base));
                    if (cfg.pct_se_interesse_economico != null) partes.push(`${cfg.pct_se_interesse_economico}% s/ interesse econômico`);
                    const pctStr = partes.length > 0 ? partes.join(" · ") : "—";
                    return (
                      <tr key={key} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{cfg.descricao || getLabel(catKey, key)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm">
                          {cfg.min ? <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(201,168,76,0.12)", color: "#8b6914" }}>{fmtBRL(cfg.min)}</span> : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{pctStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
type TabKey = "consulta" | "judicial" | "extrajudicial" | "trabalhista" | "familia" | "criminal" | "juizados" | "civel" | "falencias" | "fiscal" | "consumidor" | "previdenciario" | "ambiental" | "eleitoral" | "transito" | "desportivo" | "tribunais" | "diligencias" | "autocompositivos" | "condominial" | "lgpd" | "tabela" | "importar";

export function HonorariosPage() {
  const { data: processos = [] } = useProcessos();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("judicial");
  const [tabela, setTabela] = useState(() => getTabelaOAB());
  const [tabelaLoading, setTabelaLoading] = useState(true);
  const [propostaTexto, setPropostaTexto] = useState<string | null>(null);

  // ── Consulta rápida
  const [consultaCat, setConsultaCat] = useState("extrajudicial");
  const [consultaKey, setConsultaKey] = useState("");
  const [consultaValor, setConsultaValor] = useState("");
  const [consultaCliente, setConsultaCliente] = useState("");

  // ── Judicial
  const [judCat, setJudCat] = useState("civel");
  const [judSel, setJudSel] = useState<Set<string>>(new Set());
  const [judValor, setJudValor] = useState("");
  const [judAcordado, setJudAcordado] = useState("");
  const [judCliente, setJudCliente] = useState("");
  const [judResult, setJudResult] = useState<CalcResult | null>(null);
  const [judMulti, setJudMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Extrajudicial
  const [extSel, setExtSel] = useState<Set<string>>(new Set());
  const [extValor, setExtValor] = useState("");
  const [extCliente, setExtCliente] = useState("");
  const [extResult, setExtResult] = useState<CalcResult | null>(null);
  const [extMulti, setExtMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Trabalhista
  const [trabSel, setTrabSel] = useState<Set<string>>(new Set());
  const [trabValor, setTrabValor] = useState("");
  const [trabCliente, setTrabCliente] = useState("");
  const [trabResult, setTrabResult] = useState<CalcResult | null>(null);
  const [trabMulti, setTrabMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Família
  const [famSel, setFamSel] = useState<Set<string>>(new Set());
  const [famValor, setFamValor] = useState("");
  const [famCliente, setFamCliente] = useState("");
  const [famResult, setFamResult] = useState<CalcResult | null>(null);
  const [famMulti, setFamMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Criminal
  const [crimSel, setCrimSel] = useState<Set<string>>(new Set());
  const [crimCliente, setCrimCliente] = useState("");
  const [crimResult, setCrimResult] = useState<CalcResult | null>(null);
  const [crimMulti, setCrimMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Consulta result
  // ── Juizados Especiais
  const [juizSel, setJuizSel] = useState<Set<string>>(new Set());
  const [juizValor, setJuizValor] = useState("");
  const [juizAcordado, setJuizAcordado] = useState("");
  const [juizCliente, setJuizCliente] = useState("");
  const [juizResult, setJuizResult] = useState<CalcResult | null>(null);
  const [juizMulti, setJuizMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Cível
  const [civelSel, setCivelSel] = useState<Set<string>>(new Set());
  const [civelValor, setCivelValor] = useState("");
  const [civelAcordado, setCivelAcordado] = useState("");
  const [civelCliente, setCivelCliente] = useState("");
  const [civelResult, setCivelResult] = useState<CalcResult | null>(null);
  const [civelMulti, setCivelMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Falências e Recuperação
  const [falSel, setFalSel] = useState<Set<string>>(new Set());
  const [falValor, setFalValor] = useState("");
  const [falAcordado, setFalAcordado] = useState("");
  const [falCliente, setFalCliente] = useState("");
  const [falResult, setFalResult] = useState<CalcResult | null>(null);
  const [falMulti, setFalMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Fiscal / Tributário
  const [fiscSel, setFiscSel] = useState<Set<string>>(new Set());
  const [fiscValor, setFiscValor] = useState("");
  const [fiscAcordado, setFiscAcordado] = useState("");
  const [fiscCliente, setFiscCliente] = useState("");
  const [fiscResult, setFiscResult] = useState<CalcResult | null>(null);
  const [fiscMulti, setFiscMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Consumidor
  const [consSel, setConsSel] = useState<Set<string>>(new Set());
  const [consValor, setConsValor] = useState("");
  const [consAcordado, setConsAcordado] = useState("");
  const [consCliente, setConsCliente] = useState("");
  const [consResult, setConsResult] = useState<CalcResult | null>(null);
  const [consMulti, setConsMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  const [consultaResult, setConsultaResult] = useState<CalcResult | null>(null);

  // ── Previdenciário
  const [prevSubcat, setPrevSubcat] = useState<"segurado" | "empresarial">("segurado");
  const [prevSel, setPrevSel] = useState<Set<string>>(new Set());
  const [prevValor, setPrevValor] = useState("");
  const [prevCliente, setPrevCliente] = useState("");
  const [prevResult, setPrevResult] = useState<CalcResult | null>(null);
  const [prevMulti, setPrevMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Ambiental
  const [ambSel, setAmbSel] = useState<Set<string>>(new Set());
  const [ambValor, setAmbValor] = useState("");
  const [ambCliente, setAmbCliente] = useState("");
  const [ambResult, setAmbResult] = useState<CalcResult | null>(null);
  const [ambMulti, setAmbMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Eleitoral
  const [eleSel, setEleSel] = useState<Set<string>>(new Set());
  const [eleCliente, setEleCliente] = useState("");
  const [eleResult, setEleResult] = useState<CalcResult | null>(null);
  const [eleMulti, setEleMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Trânsito
  const [tranSel, setTranSel] = useState<Set<string>>(new Set());
  const [tranValor, setTranValor] = useState("");
  const [tranCliente, setTranCliente] = useState("");
  const [tranResult, setTranResult] = useState<CalcResult | null>(null);
  const [tranMulti, setTranMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Desportivo
  const [despSel, setDespSel] = useState<Set<string>>(new Set());
  const [despValor, setDespValor] = useState("");
  const [despCliente, setDespCliente] = useState("");
  const [despResult, setDespResult] = useState<CalcResult | null>(null);
  const [despMulti, setDespMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Tribunais e Conselhos
  const [tribSel, setTribSel] = useState<Set<string>>(new Set());
  const [tribValor, setTribValor] = useState("");
  const [tribCliente, setTribCliente] = useState("");
  const [tribResult, setTribResult] = useState<CalcResult | null>(null);
  const [tribMulti, setTribMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Diligências Correspondente
  const [dilSel, setDilSel] = useState<Set<string>>(new Set());
  const [dilCliente, setDilCliente] = useState("");
  const [dilResult, setDilResult] = useState<CalcResult | null>(null);
  const [dilMulti, setDilMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Métodos Autocompositivos
  const [autoSel, setAutoSel] = useState<Set<string>>(new Set());
  const [autoValor, setAutoValor] = useState("");
  const [autoCliente, setAutoCliente] = useState("");
  const [autoResult, setAutoResult] = useState<CalcResult | null>(null);
  const [autoMulti, setAutoMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Condominial
  const [condSel, setCondSel] = useState<Set<string>>(new Set());
  const [condValor, setCondValor] = useState("");
  const [condCliente, setCondCliente] = useState("");
  const [condResult, setCondResult] = useState<CalcResult | null>(null);
  const [condMulti, setCondMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Privacidade / LGPD
  const [lgpdSel, setLgpdSel] = useState<Set<string>>(new Set());
  const [lgpdValor, setLgpdValor] = useState("");
  const [lgpdCliente, setLgpdCliente] = useState("");
  const [lgpdResult, setLgpdResult] = useState<CalcResult | null>(null);
  const [lgpdMulti, setLgpdMulti] = useState<{ results: CalcResult[]; total: number } | null>(null);

  // ── Importar
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vigencia = `Tabela OAB-SP v${tabela.versao || "—"} · ${(tabela.fonte || "OAB-SP").replace("Tabela de Honorários ", "")}`;

  // ── Carrega tabela do Supabase ao montar (sincroniza entre dispositivos)
  const carregarTabelaSupabase = useCallback(async () => {
    if (!user) { setTabelaLoading(false); return; }
    try {
      const { data } = await supabase
        .from("user_configs" as any)
        .select("valor")
        .eq("user_id", user.id)
        .eq("chave", "tabela_honorarios")
        .maybeSingle();

      if (data?.valor) {
        const tabelaRemota = data.valor as any;
        if (tabelaRemota?.versao) {
          // Salva remota no localStorage e aplica merge para garantir novas categorias
          salvarTabelaOAB(tabelaRemota);
          setTabela(getTabelaOAB()); // usa getTabelaOAB() que já faz o merge com o default
        }
      }
    } catch (err) {
      console.error("[honorarios] Erro ao carregar tabela do Supabase:", err);
    } finally {
      setTabelaLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregarTabelaSupabase();
  }, [carregarTabelaSupabase]);

  // ── Init selects with first item
  useEffect(() => {
    const extKeys = Object.keys(tabela.extrajudicial || {});
    if (extSel.size === 0 && extKeys.length) setExtSel(new Set([extKeys[0]]));
    const trabKeys = Object.keys(tabela.trabalhista || {});
    if (trabSel.size === 0 && trabKeys.length) setTrabSel(new Set([trabKeys[0]]));
    const famKeys = Object.keys(tabela.familia_sucessoes || {});
    if (famSel.size === 0 && famKeys.length) setFamSel(new Set([famKeys[0]]));
    const crimKeys = Object.keys(tabela.criminal || {});
    if (crimSel.size === 0 && crimKeys.length) setCrimSel(new Set([crimKeys[0]]));
    const juizKeys = Object.keys(tabela.juizados_especiais || {});
    if (juizSel.size === 0 && juizKeys.length) setJuizSel(new Set([juizKeys[0]]));
    const civelKeys = Object.keys(tabela.civel || {});
    if (civelSel.size === 0 && civelKeys.length) setCivelSel(new Set([civelKeys[0]]));
    const falKeys = Object.keys(tabela.falencias_recuperacao || {});
    if (falSel.size === 0 && falKeys.length) setFalSel(new Set([falKeys[0]]));
    const fiscKeys = Object.keys(tabela.fiscal_tributario || {});
    if (fiscSel.size === 0 && fiscKeys.length) setFiscSel(new Set([fiscKeys[0]]));
    const consKeys = Object.keys(tabela.consumidor || {});
    if (consSel.size === 0 && consKeys.length) setConsSel(new Set([consKeys[0]]));
    // Novos
    const prevKeys = Object.keys(tabela.previdenciario?.segurado || {});
    if (prevSel.size === 0 && prevKeys.length) setPrevSel(new Set([prevKeys[0]]));
    const ambKeys = Object.keys(tabela.ambiental_urbanistico || {});
    if (ambSel.size === 0 && ambKeys.length) setAmbSel(new Set([ambKeys[0]]));
    const eleKeys = Object.keys(tabela.eleitoral || {});
    if (eleSel.size === 0 && eleKeys.length) setEleSel(new Set([eleKeys[0]]));
    const tranKeys = Object.keys(tabela.transito || {});
    if (tranSel.size === 0 && tranKeys.length) setTranSel(new Set([tranKeys[0]]));
    const despKeys = Object.keys(tabela.desportivo || {});
    if (despSel.size === 0 && despKeys.length) setDespSel(new Set([despKeys[0]]));
    const tribKeys = Object.keys(tabela.tribunais_conselhos || {});
    if (tribSel.size === 0 && tribKeys.length) setTribSel(new Set([tribKeys[0]]));
    const dilKeys = Object.keys(tabela.diligencias_correspondente || {});
    if (dilSel.size === 0 && dilKeys.length) setDilSel(new Set([dilKeys[0]]));
    const autoKeys = Object.keys(tabela.autocompositivos || {});
    if (autoSel.size === 0 && autoKeys.length) setAutoSel(new Set([autoKeys[0]]));
    const condKeys = Object.keys(tabela.condominial || {});
    if (condSel.size === 0 && condKeys.length) setCondSel(new Set([condKeys[0]]));
    const lgpdKeys = Object.keys(tabela.privacidade_lgpd || {});
    if (lgpdSel.size === 0 && lgpdKeys.length) setLgpdSel(new Set([lgpdKeys[0]]));
  }, [tabela]);

  useEffect(() => {
    const keys = Object.keys(tabela[judCat] || {});
    if (keys.length) setJudSel(new Set([keys[0]]));
  }, [judCat, tabela]);

  // ── Consulta: popular serviço inicial
  useEffect(() => {
    let fonte: any = null;
    if (consultaCat === "previdenciario_segurado") fonte = tabela.previdenciario?.segurado;
    else if (consultaCat === "previdenciario_empresarial") fonte = tabela.previdenciario?.empresarial;
    else fonte = tabela[consultaCat];
    const keys = Object.keys(fonte || {});
    if (keys.length) setConsultaKey(keys[0]);
  }, [consultaCat, tabela]);

  // ── Helpers de cálculo
  function calcItem(cfg: any, valor: number, pctKey = "pct"): CalcResult & { label: string } {
    const rawMin = cfg.min || 0;
    let minVal = rawMin, pctValor = 0, pctLabel = "", pctInfo = "", valorLabel = "";
    const pct = cfg[pctKey] != null ? cfg[pctKey] : cfg.pct;
    if (pct != null && pct !== "" && valor > 0) {
      pctValor = valor * (Number(pct) / 100);
      minVal = Math.max(rawMin, pctValor);
      pctLabel = `${pct}%`;
      valorLabel = fmtBRL(valor);
      pctInfo = `${pct}% s/ ${fmtBRL(valor)}`;
    } else if (pct != null && pct !== "") {
      // tem pct mas valor não foi informado — mostra só o percentual
      pctInfo = `${pct}%`;
    } else if (cfg.pct_min != null && cfg.pct_max != null) {
      pctInfo = `${cfg.pct_min}%–${cfg.pct_max}%`;
      if (valor > 0) { pctValor = valor * (Number(cfg.pct_min) / 100); minVal = Math.max(rawMin, pctValor); pctLabel = `${cfg.pct_min}%`; valorLabel = fmtBRL(valor); }
    } else if (cfg.pct_monte_mor != null && valor > 0) {
      pctValor = valor * (Number(cfg.pct_monte_mor) / 100); minVal = Math.max(rawMin, pctValor);
      pctLabel = `${cfg.pct_monte_mor}%`; valorLabel = `${fmtBRL(valor)} (monte-mor)`; pctInfo = `${cfg.pct_monte_mor}% sobre o monte-mor`;
    } else if (cfg.pct_base) { pctInfo = String(cfg.pct_base); }
    else if (cfg.pct_se_interesse_economico != null) { pctInfo = `${cfg.pct_se_interesse_economico}% s/ interesse econômico`; }
    return { label: "", rawMin, pctValor, pctLabel, pctInfo, valorLabel, minVal };
  }

  function calcMulti(fonte: any, cat: string, sel: Set<string>, valor: number) {
    const results: CalcResult[] = [];
    sel.forEach((key) => {
      const cfg = fonte?.[key];
      if (!cfg) return;
      const r = calcItem(cfg, valor);
      results.push({ ...r, label: getLabel(cat, key, cfg) });
    });
    const total = results.reduce((s, r) => s + r.minVal, 0);
    return { results, total };
  }

  // ── Calcular judicial
  function calcJudicial() {
    const valor = parseBRL(judValor);
    const { results, total } = calcMulti(tabela[judCat], judCat, judSel, valor);
    if (!results.length) { setJudResult(null); setJudMulti(null); return; }
    if (results.length === 1) { setJudResult(results[0]); setJudMulti(null); }
    else { setJudResult(null); setJudMulti({ results, total }); }
  }

  function calcExtrajudicial() {
    const valor = parseBRL(extValor);
    const { results, total } = calcMulti(tabela.extrajudicial, "extrajudicial", extSel, valor);
    if (!results.length) { setExtResult(null); setExtMulti(null); return; }
    if (results.length === 1) { setExtResult(results[0]); setExtMulti(null); }
    else { setExtResult(null); setExtMulti({ results, total }); }
  }

  function calcTrabalhista() {
    const valor = parseBRL(trabValor);
    const { results, total } = calcMulti(tabela.trabalhista, "trabalhista", trabSel, valor);
    if (!results.length) { setTrabResult(null); setTrabMulti(null); return; }
    if (results.length === 1) { setTrabResult(results[0]); setTrabMulti(null); }
    else { setTrabResult(null); setTrabMulti({ results, total }); }
  }

  function calcFamilia() {
    const valor = parseBRL(famValor);
    const { results, total } = calcMulti(tabela.familia_sucessoes, "familia_sucessoes", famSel, valor);
    if (!results.length) { setFamResult(null); setFamMulti(null); return; }
    if (results.length === 1) { setFamResult(results[0]); setFamMulti(null); }
    else { setFamResult(null); setFamMulti({ results, total }); }
  }

  function calcCriminal() {
    const { results, total } = calcMulti(tabela.criminal, "criminal", crimSel, 0);
    if (!results.length) { setCrimResult(null); setCrimMulti(null); return; }
    if (results.length === 1) { setCrimResult(results[0]); setCrimMulti(null); }
    else { setCrimResult(null); setCrimMulti({ results, total }); }
  }

  function calcJuizados() {
    const { results, total } = calcMulti(tabela.juizados_especiais, "juizados_especiais", juizSel, parseBRL(juizValor));
    if (!results.length) { setJuizResult(null); setJuizMulti(null); return; }
    if (results.length === 1) { setJuizResult(results[0]); setJuizMulti(null); }
    else { setJuizResult(null); setJuizMulti({ results, total }); }
  }

  function calcCivel() {
    const { results, total } = calcMulti(tabela.civel, "civel", civelSel, parseBRL(civelValor));
    if (!results.length) { setCivelResult(null); setCivelMulti(null); return; }
    if (results.length === 1) { setCivelResult(results[0]); setCivelMulti(null); }
    else { setCivelResult(null); setCivelMulti({ results, total }); }
  }

  function calcFalencias() {
    const { results, total } = calcMulti(tabela.falencias_recuperacao, "falencias_recuperacao", falSel, parseBRL(falValor));
    if (!results.length) { setFalResult(null); setFalMulti(null); return; }
    if (results.length === 1) { setFalResult(results[0]); setFalMulti(null); }
    else { setFalResult(null); setFalMulti({ results, total }); }
  }

  function calcFiscal() {
    const { results, total } = calcMulti(tabela.fiscal_tributario, "fiscal_tributario", fiscSel, parseBRL(fiscValor));
    if (!results.length) { setFiscResult(null); setFiscMulti(null); return; }
    if (results.length === 1) { setFiscResult(results[0]); setFiscMulti(null); }
    else { setFiscResult(null); setFiscMulti({ results, total }); }
  }

  function calcConsumidor() {
    const { results, total } = calcMulti(tabela.consumidor, "consumidor", consSel, parseBRL(consValor));
    if (!results.length) { setConsResult(null); setConsMulti(null); return; }
    if (results.length === 1) { setConsResult(results[0]); setConsMulti(null); }
    else { setConsResult(null); setConsMulti({ results, total }); }
  }

  // ── init previdenciario select when subcat changes
  useEffect(() => {
    const keys = Object.keys(tabela.previdenciario?.[prevSubcat] || {});
    if (keys.length) setPrevSel(new Set([keys[0]]));
  }, [prevSubcat, tabela]);

  function calcPrevidenciario() {
    const fonte = tabela.previdenciario?.[prevSubcat];
    const { results, total } = calcMulti(fonte, `previdenciario_${prevSubcat}`, prevSel, parseBRL(prevValor));
    if (!results.length) { setPrevResult(null); setPrevMulti(null); return; }
    if (results.length === 1) { setPrevResult(results[0]); setPrevMulti(null); }
    else { setPrevResult(null); setPrevMulti({ results, total }); }
  }

  function calcAmbiental() {
    const { results, total } = calcMulti(tabela.ambiental_urbanistico, "ambiental_urbanistico", ambSel, parseBRL(ambValor));
    if (!results.length) { setAmbResult(null); setAmbMulti(null); return; }
    if (results.length === 1) { setAmbResult(results[0]); setAmbMulti(null); }
    else { setAmbResult(null); setAmbMulti({ results, total }); }
  }

  function calcEleitoral() {
    const { results, total } = calcMulti(tabela.eleitoral, "eleitoral", eleSel, 0);
    if (!results.length) { setEleResult(null); setEleMulti(null); return; }
    if (results.length === 1) { setEleResult(results[0]); setEleMulti(null); }
    else { setEleResult(null); setEleMulti({ results, total }); }
  }

  function calcTransito() {
    const { results, total } = calcMulti(tabela.transito, "transito", tranSel, parseBRL(tranValor));
    if (!results.length) { setTranResult(null); setTranMulti(null); return; }
    if (results.length === 1) { setTranResult(results[0]); setTranMulti(null); }
    else { setTranResult(null); setTranMulti({ results, total }); }
  }

  function calcDesportivo() {
    const { results, total } = calcMulti(tabela.desportivo, "desportivo", despSel, parseBRL(despValor));
    if (!results.length) { setDespResult(null); setDespMulti(null); return; }
    if (results.length === 1) { setDespResult(results[0]); setDespMulti(null); }
    else { setDespResult(null); setDespMulti({ results, total }); }
  }

  function calcTribunais() {
    const { results, total } = calcMulti(tabela.tribunais_conselhos, "tribunais_conselhos", tribSel, parseBRL(tribValor));
    if (!results.length) { setTribResult(null); setTribMulti(null); return; }
    if (results.length === 1) { setTribResult(results[0]); setTribMulti(null); }
    else { setTribResult(null); setTribMulti({ results, total }); }
  }

  function calcDiligencias() {
    const { results, total } = calcMulti(tabela.diligencias_correspondente, "diligencias_correspondente", dilSel, 0);
    if (!results.length) { setDilResult(null); setDilMulti(null); return; }
    if (results.length === 1) { setDilResult(results[0]); setDilMulti(null); }
    else { setDilResult(null); setDilMulti({ results, total }); }
  }

  function calcAutocompositivos() {
    const { results, total } = calcMulti(tabela.autocompositivos, "autocompositivos", autoSel, parseBRL(autoValor));
    if (!results.length) { setAutoResult(null); setAutoMulti(null); return; }
    if (results.length === 1) { setAutoResult(results[0]); setAutoMulti(null); }
    else { setAutoResult(null); setAutoMulti({ results, total }); }
  }

  function calcCondominial() {
    const { results, total } = calcMulti(tabela.condominial, "condominial", condSel, parseBRL(condValor));
    if (!results.length) { setCondResult(null); setCondMulti(null); return; }
    if (results.length === 1) { setCondResult(results[0]); setCondMulti(null); }
    else { setCondResult(null); setCondMulti({ results, total }); }
  }

  function calcLgpd() {
    const { results, total } = calcMulti(tabela.privacidade_lgpd, "privacidade_lgpd", lgpdSel, parseBRL(lgpdValor));
    if (!results.length) { setLgpdResult(null); setLgpdMulti(null); return; }
    if (results.length === 1) { setLgpdResult(results[0]); setLgpdMulti(null); }
    else { setLgpdResult(null); setLgpdMulti({ results, total }); }
  }

  function calcConsulta() {
    let fonte: any = null;
    if (consultaCat === "previdenciario_segurado") fonte = tabela.previdenciario?.segurado;
    else if (consultaCat === "previdenciario_empresarial") fonte = tabela.previdenciario?.empresarial;
    else fonte = tabela[consultaCat];
    const cfg = fonte?.[consultaKey];
    if (!cfg) { setConsultaResult(null); return; }
    const valor = parseBRL(consultaValor);
    const r = calcItem(cfg, valor);
    setConsultaResult({ ...r, label: getLabel(consultaCat, consultaKey, cfg) });
  }

  // ── Importar JSON — salva no Supabase (sincroniza entre dispositivos) e localStorage (cache)
  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const nova = JSON.parse(e.target?.result as string);
        if (!nova.versao) throw new Error('Campo "versao" ausente.');
        if (!nova.extrajudicial && !nova.civel && !nova.trabalhista && !nova.criminal)
          throw new Error("Nenhuma categoria de honorários encontrada.");
        nova.importadoEm = new Date().toLocaleDateString("pt-BR");

        // Salva no localStorage (cache local imediato)
        salvarTabelaOAB(nova);
        setTabela(nova);
        const cats = Object.keys(nova).filter((k) => typeof nova[k] === "object" && k !== "observacoes").length;

        // Salva no Supabase (sincroniza com mobile e outros dispositivos)
        if (user) {
          // Salva na tabela user_configs (JSONB) — requer migration abaixo
          const { error } = await supabase
            .from("user_configs" as any)
            .upsert(
              { user_id: user.id, chave: "tabela_honorarios", valor: nova },
              { onConflict: "user_id,chave" }
            );
          if (error) {
            console.error("[honorarios] Erro ao salvar no Supabase:", error.message);
            // Fallback: só localStorage se a tabela ainda não existir
            setImportResult(`✅ Tabela salva localmente. Para sincronizar entre dispositivos, execute a migration SQL. Versão: ${nova.versao} · ${cats} categorias.`);
            toast.success("✅ Tabela OAB-SP atualizada localmente!");
          } else {
            setImportResult(`✅ Tabela importada e sincronizada! Versão: ${nova.versao} · ${nova.fonte || ""} · ${cats} categorias.`);
            toast.success("✅ Tabela OAB-SP sincronizada em todos os dispositivos!");
          }
        } else {
          setImportResult(`✅ Tabela importada com sucesso! Versão: ${nova.versao} · ${nova.fonte || ""} · ${cats} categorias.`);
          toast.success("✅ Tabela OAB-SP atualizada!");
        }
      } catch (err: any) {
        setImportResult(`❌ Erro: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function baixarModelo() {
    const blob = new Blob([JSON.stringify(tabela, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tabela_oab_sp_${tabela.versao || "atual"}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("⬇ Modelo JSON baixado!");
  }

  // ── Gerar proposta simples
  function buildProposta(tipo: string, label: string, minVal: number, pctInfo: string, valorBase: number, cliente: string) {
    const hoje = new Date().toLocaleDateString("pt-BR");
    return `PROPOSTA DE HONORÁRIOS ADVOCATÍCIOS
Data: ${hoje}
Cliente: ${cliente || "[CLIENTE]"}

─────────────────────────────────────────

MODALIDADE: ${tipo}
SERVIÇO: ${label}${valorBase > 0 ? `\nValor da causa: ${fmtBRL(valorBase)}` : ""}${pctInfo ? `\nBase de cálculo: ${pctInfo}` : ""}

HONORÁRIOS CONFORME TABELA OAB-SP ${tabela.versao || "2026"}
  Valor mínimo sugerido: ${fmtBRL(minVal)}

VALOR PROPOSTO: ${fmtBRL(minVal)}

─────────────────────────────────────────

FORMA DE PAGAMENTO (sugestão)
  — 50% no ato da contratação: ${fmtBRL(minVal * 0.5)}
  — 50% ao final / êxito:      ${fmtBRL(minVal * 0.5)}

OBSERVAÇÕES
• Honorários contratuais, independentes dos sucumbenciais (art. 85, §14 CPC).
• Recursos ou instâncias superiores objeto de aditivo.
• Base: Tabela OAB-SP, vigência ${tabela.vigencia || tabela.versao || "2026"}.`;
  }

  // ── Tabs config
  const tabs: { key: TabKey; label: string }[] = [
    { key: "consulta", label: "🔍 Consultar" },
    { key: "judicial", label: "⚖️ Judiciais" },
    { key: "juizados", label: "⚖️ Juizados" },
    { key: "civel", label: "🏛️ Cível" },
    { key: "falencias", label: "📉 Falências" },
    { key: "previdenciario", label: "🏥 Previdenciário" },
    { key: "fiscal", label: "💰 Fiscal/Trib." },
    { key: "consumidor", label: "🛒 Consumidor" },
    { key: "ambiental", label: "🌿 Ambiental" },
    { key: "eleitoral", label: "🗳️ Eleitoral" },
    { key: "transito", label: "🚦 Trânsito" },
    { key: "desportivo", label: "🏆 Desportivo" },
    { key: "tribunais", label: "🏛️ Tribunais" },
    { key: "diligencias", label: "📋 Diligências" },
    { key: "autocompositivos", label: "🤝 Autocomp." },
    { key: "condominial", label: "🏢 Condominial" },
    { key: "lgpd", label: "🔒 LGPD" },
    { key: "extrajudicial", label: "📄 Extrajudiciais" },
    { key: "trabalhista", label: "👷 Trabalhista" },
    { key: "familia", label: "👨‍👩‍👧 Família" },
    { key: "criminal", label: "⚖️ Criminal" },
    { key: "tabela", label: "📋 Tabela Completa" },
    { key: "importar", label: "⬆ Importar" },
  ];

  const FIELD = "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none";
  const LABEL = "text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground mb-1 block";

  function judOpcoes() {
    return Object.keys(tabela[judCat] || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, judCat, k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  function extOpcoes() { return Object.keys(tabela.extrajudicial || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "extrajudicial", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function trabOpcoes() { return Object.keys(tabela.trabalhista || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "trabalhista", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function famOpcoes() { return Object.keys(tabela.familia_sucessoes || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "familia_sucessoes", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function crimOpcoes() { return Object.keys(tabela.criminal || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "criminal", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function juizOpcoes() { return Object.keys(tabela.juizados_especiais || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "juizados_especiais", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function civelOpcoes() { return Object.keys(tabela.civel || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "civel", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function falOpcoes() { return Object.keys(tabela.falencias_recuperacao || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "falencias_recuperacao", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function fiscOpcoes() { return Object.keys(tabela.fiscal_tributario || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "fiscal_tributario", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function consOpcoes() { return Object.keys(tabela.consumidor || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "consumidor", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }

  function prevOpcoes() {
    const fonte = tabela.previdenciario?.[prevSubcat] || {};
    return Object.keys(fonte).map((k) => ({ value: k, label: getLabelFromTabela(tabela, `previdenciario_${prevSubcat}`, k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  function ambOpcoes() { return Object.keys(tabela.ambiental_urbanistico || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "ambiental_urbanistico", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function eleOpcoes() { return Object.keys(tabela.eleitoral || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "eleitoral", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function tranOpcoes() { return Object.keys(tabela.transito || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "transito", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function despOpcoes() { return Object.keys(tabela.desportivo || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "desportivo", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function tribOpcoes() { return Object.keys(tabela.tribunais_conselhos || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "tribunais_conselhos", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function dilOpcoes() { return Object.keys(tabela.diligencias_correspondente || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "diligencias_correspondente", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function autoOpcoes() { return Object.keys(tabela.autocompositivos || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "autocompositivos", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function condOpcoes() { return Object.keys(tabela.condominial || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "condominial", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function lgpdOpcoes() { return Object.keys(tabela.privacidade_lgpd || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, "privacidade_lgpd", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }

  function consultaOpcoes() {
    let fonte: any = null;
    if (consultaCat === "previdenciario_segurado") fonte = tabela.previdenciario?.segurado;
    else if (consultaCat === "previdenciario_empresarial") fonte = tabela.previdenciario?.empresarial;
    else fonte = tabela[consultaCat];
    return Object.keys(fonte || {}).map((k) => ({ value: k, label: getLabelFromTabela(tabela, consultaCat, k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  return (
    <div>
      {propostaTexto && <PropostaModal texto={propostaTexto} onClose={() => setPropostaTexto(null)} />}

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Calculadora de Honorários</h1>
          <p className="text-sm text-muted-foreground mt-1">Tabela OAB-SP · Judiciais · Extrajudiciais · Êxito · Trabalhista</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{vigencia}</span>
          <button onClick={() => setTab("tabela")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted flex items-center gap-1">📋 Ver Tabela</button>
          <button onClick={() => setTab("importar")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted flex items-center gap-1">⬆ Atualizar Tabela</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-muted/30 rounded-xl border border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? "text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            style={tab === t.key ? { background: "#1a6b3a", color: "#fff" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONSULTA ── */}
      {tab === "consulta" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🔍 Consultar Honorário por Serviço</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Categoria</label>
                <select className={FIELD} value={consultaCat} onChange={(e) => setConsultaCat(e.target.value)}>
                  <option value="extrajudicial">Extrajudicial</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="juizados_especiais">Juizados Especiais</option>
                  <option value="civel">Cível</option>
                  <option value="falencias_recuperacao">Falências e Recuperação</option>
                  <option value="familia_sucessoes">Família e Sucessões</option>
                  <option value="previdenciario_segurado">Previdenciário (Segurado)</option>
                  <option value="previdenciario_empresarial">Previdenciário (Empresarial)</option>
                  <option value="trabalhista">Trabalhista</option>
                  <option value="fiscal_tributario">Fiscal / Tributário</option>
                  <option value="consumidor">Consumidor</option>
                  <option value="ambiental_urbanistico">Ambiental / Urbanístico</option>
                  <option value="eleitoral">Eleitoral</option>
                  <option value="transito">Trânsito</option>
                  <option value="desportivo">Desportivo</option>
                  <option value="tribunais_conselhos">Tribunais e Conselhos</option>
                  <option value="diligencias_correspondente">Diligências Correspondente</option>
                  <option value="autocompositivos">Métodos Autocompositivos</option>
                  <option value="condominial">Condominial</option>
                  <option value="privacidade_lgpd">Privacidade / LGPD</option>
                  <option value="criminal">Criminal</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <select className={FIELD} value={consultaKey} onChange={(e) => setConsultaKey(e.target.value)}>
                  {consultaOpcoes().map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={consultaValor} onChange={(e) => setConsultaValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={consultaCliente} onChange={(e) => setConsultaCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcConsulta} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {consultaResult && (
              <ResultBox result={consultaResult} tipo="consulta"
                onProposta={() => setPropostaTexto(buildProposta("Consulta", consultaResult.label, consultaResult.minVal, consultaResult.pctInfo, parseBRL(consultaValor), consultaCliente))} />
            )}
          </div>
        </div>
      )}

      {/* ── JUDICIAL ── */}
      {tab === "judicial" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">⚖️ Honorários Judiciais</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Vincular a Processo (opcional)</label>
                <select className={FIELD} onChange={(e) => { const p = processos.find((x: any) => x.id === e.target.value); if (p) setJudCliente((p as any).clienteNome || ""); }}>
                  <option value="">— nenhum —</option>
                  {processos.map((p: any) => <option key={p.id} value={p.id}>{p.numero} · {p.clienteNome || "—"}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Categoria</label>
                <select className={FIELD} value={judCat} onChange={(e) => setJudCat(e.target.value)}>
                  <option value="civel">Cível</option>
                  <option value="juizados_especiais">Juizados Especiais</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="falencias_recuperacao">Falências e Recuperação</option>
                  <option value="fiscal_tributario">Fiscal / Tributário</option>
                  <option value="consumidor">Consumidor</option>
                  <option value="ambiental_urbanistico">Ambiental / Urbanístico</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Tipo de Ação</label>
                <MultiSelect cat={judCat} opcoes={judOpcoes()} selected={judSel} onToggle={(v) => { const s = new Set(judSel); s.has(v) ? s.delete(v) : s.add(v); setJudSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={judValor} onChange={(e) => setJudValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={judCliente} onChange={(e) => setJudCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={judAcordado} onChange={(e) => setJudAcordado(e.target.value)} />
              </div>
              <button onClick={calcJudicial} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {judResult && <ResultBox result={judResult} acordado={parseBRL(judAcordado)} tipo="judicial"
              onProposta={() => setPropostaTexto(buildProposta("Judicial", judResult.label, judResult.minVal, judResult.pctInfo, parseBRL(judValor), judCliente))} />}
            {judMulti && <MultiResultBox {...judMulti} acordado={parseBRL(judAcordado)} tipo="judicial"
              onProposta={() => setPropostaTexto(buildProposta("Judicial", `${judMulti.results.length} tipos`, judMulti.total, "", parseBRL(judValor), judCliente))} />}
          </div>
        </div>
      )}

      {/* ── EXTRAJUDICIAL ── */}
      {tab === "extrajudicial" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">📄 Honorários Extrajudiciais</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="extrajudicial" opcoes={extOpcoes()} selected={extSel} onToggle={(v) => { const s = new Set(extSel); s.has(v) ? s.delete(v) : s.add(v); setExtSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais serviços — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Envolvido / Base (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={extValor} onChange={(e) => setExtValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={extCliente} onChange={(e) => setExtCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcExtrajudicial} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {extResult && <ResultBox result={extResult} tipo="extrajudicial"
              onProposta={() => setPropostaTexto(buildProposta("Extrajudicial", extResult.label, extResult.minVal, extResult.pctInfo, parseBRL(extValor), extCliente))} />}
            {extMulti && <MultiResultBox {...extMulti} tipo="extrajudicial"
              onProposta={() => setPropostaTexto(buildProposta("Extrajudicial", `${extMulti.results.length} serviços`, extMulti.total, "", parseBRL(extValor), extCliente))} />}
          </div>
        </div>
      )}

      {/* ── TRABALHISTA ── */}
      {tab === "trabalhista" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">👷 Honorários Trabalhistas</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Vincular a Processo (opcional)</label>
                <select className={FIELD} onChange={(e) => { const p = processos.find((x: any) => x.id === e.target.value); if (p) setTrabCliente((p as any).clienteNome || ""); }}>
                  <option value="">— nenhum —</option>
                  {processos.map((p: any) => <option key={p.id} value={p.id}>{p.numero} · {p.clienteNome || "—"}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tipo de Atuação</label>
                <MultiSelect cat="trabalhista" opcoes={trabOpcoes()} selected={trabSel} onToggle={(v) => { const s = new Set(trabSel); s.has(v) ? s.delete(v) : s.add(v); setTrabSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa / Condenação (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={trabValor} onChange={(e) => setTrabValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={trabCliente} onChange={(e) => setTrabCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcTrabalhista} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {trabResult && <ResultBox result={trabResult} tipo="trabalhista"
              onProposta={() => setPropostaTexto(buildProposta("Trabalhista", trabResult.label, trabResult.minVal, trabResult.pctInfo, parseBRL(trabValor), trabCliente))} />}
            {trabMulti && <MultiResultBox {...trabMulti} tipo="trabalhista"
              onProposta={() => setPropostaTexto(buildProposta("Trabalhista", `${trabMulti.results.length} tipos`, trabMulti.total, "", parseBRL(trabValor), trabCliente))} />}
          </div>
        </div>
      )}

      {/* ── FAMÍLIA ── */}
      {tab === "familia" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">👨‍👩‍👧 Família e Sucessões</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Ação</label>
                <MultiSelect cat="familia_sucessoes" opcoes={famOpcoes()} selected={famSel} onToggle={(v) => { const s = new Set(famSel); s.has(v) ? s.delete(v) : s.add(v); setFamSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor do Monte-Mor / Patrimônio (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={famValor} onChange={(e) => setFamValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={famCliente} onChange={(e) => setFamCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcFamilia} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {famResult && <ResultBox result={famResult} tipo="familia"
              onProposta={() => setPropostaTexto(buildProposta("Família e Sucessões", famResult.label, famResult.minVal, famResult.pctInfo, parseBRL(famValor), famCliente))} />}
            {famMulti && <MultiResultBox {...famMulti} tipo="familia"
              onProposta={() => setPropostaTexto(buildProposta("Família e Sucessões", `${famMulti.results.length} tipos`, famMulti.total, "", parseBRL(famValor), famCliente))} />}
          </div>
        </div>
      )}

      {/* ── CRIMINAL ── */}
      {tab === "criminal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">⚖️ Criminal</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Atuação</label>
                <MultiSelect cat="criminal" opcoes={crimOpcoes()} selected={crimSel} onToggle={(v) => { const s = new Set(crimSel); s.has(v) ? s.delete(v) : s.add(v); setCrimSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div>
                <label className={LABEL}>Nome do Cliente</label>
                <input className={FIELD} placeholder="Para a proposta" value={crimCliente} onChange={(e) => setCrimCliente(e.target.value)} />
              </div>
              <button onClick={calcCriminal} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {crimResult && <ResultBox result={crimResult} tipo="criminal"
              onProposta={() => setPropostaTexto(buildProposta("Criminal", crimResult.label, crimResult.minVal, crimResult.pctInfo, 0, crimCliente))} />}
            {crimMulti && <MultiResultBox {...crimMulti} tipo="criminal"
              onProposta={() => setPropostaTexto(buildProposta("Criminal", `${crimMulti.results.length} tipos`, crimMulti.total, "", 0, crimCliente))} />}
          </div>
        </div>
      )}

      {/* ── JUIZADOS ESPECIAIS ── */}
      {tab === "juizados" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">⚖️ Juizados Especiais</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="juizados_especiais" opcoes={juizOpcoes()} selected={juizSel} onToggle={(v) => { const s = new Set(juizSel); s.has(v) ? s.delete(v) : s.add(v); setJuizSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={juizValor} onChange={(e) => setJuizValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={juizCliente} onChange={(e) => setJuizCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={juizAcordado} onChange={(e) => setJuizAcordado(e.target.value)} />
              </div>
              <button onClick={calcJuizados} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {juizResult && <ResultBox result={juizResult} acordado={parseBRL(juizAcordado)} tipo="juizados_especiais"
              onProposta={() => setPropostaTexto(buildProposta("Juizados Especiais", juizResult.label, juizResult.minVal, juizResult.pctInfo, parseBRL(juizValor), juizCliente))} />}
            {juizMulti && <MultiResultBox {...juizMulti} acordado={parseBRL(juizAcordado)} tipo="juizados_especiais"
              onProposta={() => setPropostaTexto(buildProposta("Juizados Especiais", `${juizMulti.results.length} tipos`, juizMulti.total, "", parseBRL(juizValor), juizCliente))} />}
          </div>
        </div>
      )}

      {/* ── CÍVEL ── */}
      {tab === "civel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🏛️ Honorários Cível</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Ação</label>
                <MultiSelect cat="civel" opcoes={civelOpcoes()} selected={civelSel} onToggle={(v) => { const s = new Set(civelSel); s.has(v) ? s.delete(v) : s.add(v); setCivelSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={civelValor} onChange={(e) => setCivelValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={civelCliente} onChange={(e) => setCivelCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={civelAcordado} onChange={(e) => setCivelAcordado(e.target.value)} />
              </div>
              <button onClick={calcCivel} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {civelResult && <ResultBox result={civelResult} acordado={parseBRL(civelAcordado)} tipo="civel"
              onProposta={() => setPropostaTexto(buildProposta("Cível", civelResult.label, civelResult.minVal, civelResult.pctInfo, parseBRL(civelValor), civelCliente))} />}
            {civelMulti && <MultiResultBox {...civelMulti} acordado={parseBRL(civelAcordado)} tipo="civel"
              onProposta={() => setPropostaTexto(buildProposta("Cível", `${civelMulti.results.length} tipos`, civelMulti.total, "", parseBRL(civelValor), civelCliente))} />}
          </div>
        </div>
      )}

      {/* ── FALÊNCIAS E RECUPERAÇÃO ── */}
      {tab === "falencias" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">📉 Falências e Recuperação</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="falencias_recuperacao" opcoes={falOpcoes()} selected={falSel} onToggle={(v) => { const s = new Set(falSel); s.has(v) ? s.delete(v) : s.add(v); setFalSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={falValor} onChange={(e) => setFalValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={falCliente} onChange={(e) => setFalCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={falAcordado} onChange={(e) => setFalAcordado(e.target.value)} />
              </div>
              <button onClick={calcFalencias} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {falResult && <ResultBox result={falResult} acordado={parseBRL(falAcordado)} tipo="falencias_recuperacao"
              onProposta={() => setPropostaTexto(buildProposta("Falências e Recuperação", falResult.label, falResult.minVal, falResult.pctInfo, parseBRL(falValor), falCliente))} />}
            {falMulti && <MultiResultBox {...falMulti} acordado={parseBRL(falAcordado)} tipo="falencias_recuperacao"
              onProposta={() => setPropostaTexto(buildProposta("Falências e Recuperação", `${falMulti.results.length} tipos`, falMulti.total, "", parseBRL(falValor), falCliente))} />}
          </div>
        </div>
      )}

      {/* ── FISCAL / TRIBUTÁRIO ── */}
      {tab === "fiscal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">💰 Fiscal / Tributário</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="fiscal_tributario" opcoes={fiscOpcoes()} selected={fiscSel} onToggle={(v) => { const s = new Set(fiscSel); s.has(v) ? s.delete(v) : s.add(v); setFiscSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Envolvido (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={fiscValor} onChange={(e) => setFiscValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={fiscCliente} onChange={(e) => setFiscCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={fiscAcordado} onChange={(e) => setFiscAcordado(e.target.value)} />
              </div>
              <button onClick={calcFiscal} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {fiscResult && <ResultBox result={fiscResult} acordado={parseBRL(fiscAcordado)} tipo="fiscal_tributario"
              onProposta={() => setPropostaTexto(buildProposta("Fiscal / Tributário", fiscResult.label, fiscResult.minVal, fiscResult.pctInfo, parseBRL(fiscValor), fiscCliente))} />}
            {fiscMulti && <MultiResultBox {...fiscMulti} acordado={parseBRL(fiscAcordado)} tipo="fiscal_tributario"
              onProposta={() => setPropostaTexto(buildProposta("Fiscal / Tributário", `${fiscMulti.results.length} tipos`, fiscMulti.total, "", parseBRL(fiscValor), fiscCliente))} />}
          </div>
        </div>
      )}

      {/* ── CONSUMIDOR ── */}
      {tab === "consumidor" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🛒 Consumidor</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="consumidor" opcoes={consOpcoes()} selected={consSel} onToggle={(v) => { const s = new Set(consSel); s.has(v) ? s.delete(v) : s.add(v); setConsSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Envolvido (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={consValor} onChange={(e) => setConsValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={consCliente} onChange={(e) => setConsCliente(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Valor Acordado (R$) — opcional</label>
                <input className={FIELD} placeholder="Deixe em branco para usar o mínimo" value={consAcordado} onChange={(e) => setConsAcordado(e.target.value)} />
              </div>
              <button onClick={calcConsumidor} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {consResult && <ResultBox result={consResult} acordado={parseBRL(consAcordado)} tipo="consumidor"
              onProposta={() => setPropostaTexto(buildProposta("Consumidor", consResult.label, consResult.minVal, consResult.pctInfo, parseBRL(consValor), consCliente))} />}
            {consMulti && <MultiResultBox {...consMulti} acordado={parseBRL(consAcordado)} tipo="consumidor"
              onProposta={() => setPropostaTexto(buildProposta("Consumidor", `${consMulti.results.length} tipos`, consMulti.total, "", parseBRL(consValor), consCliente))} />}
          </div>
        </div>
      )}

      {/* ── PREVIDENCIÁRIO ── */}
      {tab === "previdenciario" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🏥 Honorários Previdenciários</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Subcategoria</label>
                <select className={FIELD} value={prevSubcat} onChange={(e) => setPrevSubcat(e.target.value as any)}>
                  <option value="segurado">Segurado / Dependente</option>
                  <option value="empresarial">Empresarial</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat={`previdenciario_${prevSubcat}`} opcoes={prevOpcoes()} selected={prevSel} onToggle={(v) => { const s = new Set(prevSel); s.has(v) ? s.delete(v) : s.add(v); setPrevSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor do Benefício / Proveito Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={prevValor} onChange={(e) => setPrevValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={prevCliente} onChange={(e) => setPrevCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcPrevidenciario} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {prevResult && <ResultBox result={prevResult} tipo="previdenciario"
              onProposta={() => setPropostaTexto(buildProposta("Previdenciário", prevResult.label, prevResult.minVal, prevResult.pctInfo, parseBRL(prevValor), prevCliente))} />}
            {prevMulti && <MultiResultBox {...prevMulti} tipo="previdenciario"
              onProposta={() => setPropostaTexto(buildProposta("Previdenciário", `${prevMulti.results.length} tipos`, prevMulti.total, "", parseBRL(prevValor), prevCliente))} />}
          </div>
        </div>
      )}

      {/* ── AMBIENTAL ── */}
      {tab === "ambiental" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🌿 Honorários Ambiental / Urbanístico</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="ambiental_urbanistico" opcoes={ambOpcoes()} selected={ambSel} onToggle={(v) => { const s = new Set(ambSel); s.has(v) ? s.delete(v) : s.add(v); setAmbSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={ambValor} onChange={(e) => setAmbValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={ambCliente} onChange={(e) => setAmbCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcAmbiental} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {ambResult && <ResultBox result={ambResult} tipo="ambiental"
              onProposta={() => setPropostaTexto(buildProposta("Ambiental/Urbanístico", ambResult.label, ambResult.minVal, ambResult.pctInfo, parseBRL(ambValor), ambCliente))} />}
            {ambMulti && <MultiResultBox {...ambMulti} tipo="ambiental"
              onProposta={() => setPropostaTexto(buildProposta("Ambiental/Urbanístico", `${ambMulti.results.length} tipos`, ambMulti.total, "", parseBRL(ambValor), ambCliente))} />}
          </div>
        </div>
      )}

      {/* ── ELEITORAL ── */}
      {tab === "eleitoral" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🗳️ Honorários Eleitorais</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="eleitoral" opcoes={eleOpcoes()} selected={eleSel} onToggle={(v) => { const s = new Set(eleSel); s.has(v) ? s.delete(v) : s.add(v); setEleSel(s); }} />
              </div>
              <div>
                <label className={LABEL}>Nome do Cliente</label>
                <input className={FIELD} placeholder="Para a proposta" value={eleCliente} onChange={(e) => setEleCliente(e.target.value)} />
              </div>
              <button onClick={calcEleitoral} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {eleResult && <ResultBox result={eleResult} tipo="eleitoral"
              onProposta={() => setPropostaTexto(buildProposta("Eleitoral", eleResult.label, eleResult.minVal, eleResult.pctInfo, 0, eleCliente))} />}
            {eleMulti && <MultiResultBox {...eleMulti} tipo="eleitoral"
              onProposta={() => setPropostaTexto(buildProposta("Eleitoral", `${eleMulti.results.length} tipos`, eleMulti.total, "", 0, eleCliente))} />}
          </div>
        </div>
      )}

      {/* ── TRÂNSITO ── */}
      {tab === "transito" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🚦 Honorários — Matéria de Trânsito</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="transito" opcoes={tranOpcoes()} selected={tranSel} onToggle={(v) => { const s = new Set(tranSel); s.has(v) ? s.delete(v) : s.add(v); setTranSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={tranValor} onChange={(e) => setTranValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={tranCliente} onChange={(e) => setTranCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcTransito} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {tranResult && <ResultBox result={tranResult} tipo="transito"
              onProposta={() => setPropostaTexto(buildProposta("Trânsito", tranResult.label, tranResult.minVal, tranResult.pctInfo, parseBRL(tranValor), tranCliente))} />}
            {tranMulti && <MultiResultBox {...tranMulti} tipo="transito"
              onProposta={() => setPropostaTexto(buildProposta("Trânsito", `${tranMulti.results.length} tipos`, tranMulti.total, "", parseBRL(tranValor), tranCliente))} />}
          </div>
        </div>
      )}

      {/* ── DESPORTIVO ── */}
      {tab === "desportivo" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🏆 Honorários — Matéria Desportiva</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="desportivo" opcoes={despOpcoes()} selected={despSel} onToggle={(v) => { const s = new Set(despSel); s.has(v) ? s.delete(v) : s.add(v); setDespSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={despValor} onChange={(e) => setDespValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={despCliente} onChange={(e) => setDespCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcDesportivo} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {despResult && <ResultBox result={despResult} tipo="desportivo"
              onProposta={() => setPropostaTexto(buildProposta("Desportivo", despResult.label, despResult.minVal, despResult.pctInfo, parseBRL(despValor), despCliente))} />}
            {despMulti && <MultiResultBox {...despMulti} tipo="desportivo"
              onProposta={() => setPropostaTexto(buildProposta("Desportivo", `${despMulti.results.length} tipos`, despMulti.total, "", parseBRL(despValor), despCliente))} />}
          </div>
        </div>
      )}

      {/* ── TRIBUNAIS E CONSELHOS ── */}
      {tab === "tribunais" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🏛️ Honorários — Tribunais e Conselhos</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="tribunais_conselhos" opcoes={tribOpcoes()} selected={tribSel} onToggle={(v) => { const s = new Set(tribSel); s.has(v) ? s.delete(v) : s.add(v); setTribSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor da Causa (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={tribValor} onChange={(e) => setTribValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={tribCliente} onChange={(e) => setTribCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcTribunais} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {tribResult && <ResultBox result={tribResult} tipo="tribunais"
              onProposta={() => setPropostaTexto(buildProposta("Tribunais/Conselhos", tribResult.label, tribResult.minVal, tribResult.pctInfo, parseBRL(tribValor), tribCliente))} />}
            {tribMulti && <MultiResultBox {...tribMulti} tipo="tribunais"
              onProposta={() => setPropostaTexto(buildProposta("Tribunais/Conselhos", `${tribMulti.results.length} tipos`, tribMulti.total, "", parseBRL(tribValor), tribCliente))} />}
          </div>
        </div>
      )}

      {/* ── DILIGÊNCIAS CORRESPONDENTE ── */}
      {tab === "diligencias" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">📋 Diligências — Advogado/a Correspondente</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Diligência</label>
                <MultiSelect cat="diligencias_correspondente" opcoes={dilOpcoes()} selected={dilSel} onToggle={(v) => { const s = new Set(dilSel); s.has(v) ? s.delete(v) : s.add(v); setDilSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div>
                <label className={LABEL}>Nome do Cliente</label>
                <input className={FIELD} placeholder="Para a proposta" value={dilCliente} onChange={(e) => setDilCliente(e.target.value)} />
              </div>
              <button onClick={calcDiligencias} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {dilResult && <ResultBox result={dilResult} tipo="diligencias"
              onProposta={() => setPropostaTexto(buildProposta("Diligências", dilResult.label, dilResult.minVal, dilResult.pctInfo, 0, dilCliente))} />}
            {dilMulti && <MultiResultBox {...dilMulti} tipo="diligencias"
              onProposta={() => setPropostaTexto(buildProposta("Diligências", `${dilMulti.results.length} tipos`, dilMulti.total, "", 0, dilCliente))} />}
          </div>
        </div>
      )}

      {/* ── MÉTODOS AUTOCOMPOSITIVOS ── */}
      {tab === "autocompositivos" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🤝 Assessoria em Métodos Autocompositivos</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="autocompositivos" opcoes={autoOpcoes()} selected={autoSel} onToggle={(v) => { const s = new Set(autoSel); s.has(v) ? s.delete(v) : s.add(v); setAutoSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={autoValor} onChange={(e) => setAutoValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={autoCliente} onChange={(e) => setAutoCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcAutocompositivos} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {autoResult && <ResultBox result={autoResult} tipo="autocompositivos"
              onProposta={() => setPropostaTexto(buildProposta("Autocompositivos", autoResult.label, autoResult.minVal, autoResult.pctInfo, parseBRL(autoValor), autoCliente))} />}
            {autoMulti && <MultiResultBox {...autoMulti} tipo="autocompositivos"
              onProposta={() => setPropostaTexto(buildProposta("Autocompositivos", `${autoMulti.results.length} tipos`, autoMulti.total, "", parseBRL(autoValor), autoCliente))} />}
          </div>
        </div>
      )}

      {/* ── CONDOMINIAL ── */}
      {tab === "condominial" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🏢 Honorários — Direito Condominial</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="condominial" opcoes={condOpcoes()} selected={condSel} onToggle={(v) => { const s = new Set(condSel); s.has(v) ? s.delete(v) : s.add(v); setCondSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={condValor} onChange={(e) => setCondValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={condCliente} onChange={(e) => setCondCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcCondominial} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {condResult && <ResultBox result={condResult} tipo="condominial"
              onProposta={() => setPropostaTexto(buildProposta("Condominial", condResult.label, condResult.minVal, condResult.pctInfo, parseBRL(condValor), condCliente))} />}
            {condMulti && <MultiResultBox {...condMulti} tipo="condominial"
              onProposta={() => setPropostaTexto(buildProposta("Condominial", `${condMulti.results.length} tipos`, condMulti.total, "", parseBRL(condValor), condCliente))} />}
          </div>
        </div>
      )}

      {/* ── LGPD / PRIVACIDADE ── */}
      {tab === "lgpd" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-bold mb-4">🔒 Honorários — Privacidade e Proteção de Dados (LGPD)</div>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Tipo de Serviço</label>
                <MultiSelect cat="privacidade_lgpd" opcoes={lgpdOpcoes()} selected={lgpdSel} onToggle={(v) => { const s = new Set(lgpdSel); s.has(v) ? s.delete(v) : s.add(v); setLgpdSel(s); }} />
                <p className="text-[0.68rem] text-accent mt-1">☑ Marque um ou mais tipos — os valores serão somados automaticamente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor Econômico (R$)</label>
                  <input className={FIELD} placeholder="0,00" value={lgpdValor} onChange={(e) => setLgpdValor(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Nome do Cliente</label>
                  <input className={FIELD} placeholder="Para a proposta" value={lgpdCliente} onChange={(e) => setLgpdCliente(e.target.value)} />
                </div>
              </div>
              <button onClick={calcLgpd} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a1e" }}>Calcular</button>
            </div>
          </div>
          <div>
            {lgpdResult && <ResultBox result={lgpdResult} tipo="lgpd"
              onProposta={() => setPropostaTexto(buildProposta("Privacidade/LGPD", lgpdResult.label, lgpdResult.minVal, lgpdResult.pctInfo, parseBRL(lgpdValor), lgpdCliente))} />}
            {lgpdMulti && <MultiResultBox {...lgpdMulti} tipo="lgpd"
              onProposta={() => setPropostaTexto(buildProposta("Privacidade/LGPD", `${lgpdMulti.results.length} tipos`, lgpdMulti.total, "", parseBRL(lgpdValor), lgpdCliente))} />}
          </div>
        </div>
      )}

      {/* ── TABELA COMPLETA ── */}
      {tab === "tabela" && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
            <div>
              <div className="font-bold">📋 Tabela de Honorários OAB-SP Vigente</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tabela.fonte} · {tabela.importadoEm ? `importada em ${tabela.importadoEm}` : "padrão 2026"}</div>
            </div>
            <button onClick={baixarModelo} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted flex items-center gap-1">⬇ Baixar modelo .json</button>
          </div>
          <TabelaCompleta key={tabela.versao} />
        </div>
      )}

      {/* ── IMPORTAR ── */}
      {tab === "importar" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl mx-auto">
          <div className="font-bold mb-2">⬆ Atualizar Tabela OAB-SP</div>
          <div className="text-sm text-muted-foreground mb-5">
            Importe um arquivo <code className="bg-muted px-1 rounded">.json</code> com a nova tabela sempre que a OAB-SP publicar atualização.
            Baixe o modelo atual para ver a estrutura esperada.
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-accent transition-colors mb-4"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImport(f); }}
          >
            <div className="text-3xl mb-2">📂</div>
            <div className="font-semibold text-sm">Clique ou arraste o arquivo .json aqui</div>
            <div className="text-xs text-muted-foreground mt-1">Apenas arquivos .json são aceitos</div>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          </div>

          <button onClick={baixarModelo} className="w-full py-2.5 mb-4 rounded-xl text-sm font-semibold border border-border hover:bg-muted flex items-center justify-center gap-2">
            ⬇ Baixar modelo atual (.json)
          </button>

          {importResult && (
            <div className={`rounded-xl p-4 text-sm ${importResult.startsWith("✅") ? "bg-green-500/10 border border-green-500/30 text-green-700" : "bg-red-500/10 border border-red-500/30 text-red-700"}`}>
              {importResult}
            </div>
          )}

          {/* Estrutura esperada */}
          <div className="mt-6">
            <div className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground mb-3">Estrutura Esperada do JSON</div>
            <pre className="bg-muted/60 rounded-xl p-4 text-[0.7rem] font-mono overflow-x-auto text-foreground leading-relaxed">{`{
  "versao": "2026",
  "fonte": "Tabela de Honorários OAB/SP 2026",
  "observacoes": {
    "geral": "Salvo outra disposição...",
    "valores_minimos": "As importâncias...",
    "cartas_precatorias_min": 1407.61
  },
  "extrajudicial": {
    "consulta":         { "min": 516.47 },
    "hora_intelectual": { "min": 832.25 },
    "cobranca_amigavel": { "min": 1165.15, "pct": 10 },
    ...
  },
  "civel": {
    "procedimento_ordinario": { "min": 5992.22, "pct": 20 },
    "mandado_seguranca":      { "min": 6658.02, "pct": 20 },
    ...
  },
  "criminal": { ... },
  "trabalhista": { ... },
  "familia_sucessoes": { ... },
  "previdenciario": {
    "segurado":    { ... },
    "empresarial": { ... }
  },
  "fiscal_tributario": { ... },
  "consumidor":         { ... },
  "privacidade_lgpd":   { ... }
}`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
