import React, { useState, useEffect, useRef } from "react";
import { useProcessos } from "@/hooks/useProcessos";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// TABELA OAB-SP 2024 (default embutida)
// ─────────────────────────────────────────────
const TABELA_OABSP_DEFAULT: any = {
  versao: "2024",
  fonte: "Tabela de Honorários OAB/SP 2024",
  observacoes: {
    geral: "Salvo outra disposição, serão devidos honorários no percentual de 20% sobre o valor econômico da questão, havendo ou não benefício patrimonial.",
    valores_minimos: "As importâncias anotadas, em reais, são sugeridas como valores mínimos.",
    cartas_precatorias_min: 1407.61,
    advocacia_partido_mensal_min: 2815.24,
  },
  extrajudicial: {
    consulta: { min: 516.47 },
    consulta_excepcional_com_documentos: { min: 1106.71 },
    hora_intelectual: { min: 832.25 },
    acompanhamento_documentos_orgao_publico: { min: 1165.15, pct: 10 },
    acompanhamento_citacao_notificacao_intimacao: { min: 832.25 },
    acompanhamento_depoimento_testemunhas: { min: 2330.31 },
    cobranca_amigavel: { min: 1165.15, pct: 10 },
    consignacao_pagamento_extrajudicial: { min: 1997.42, pct: 10 },
    exame_instrumento_constituicao_pj: { min: 1997.42 },
    elaboracao_notificacao_extrajudicial: { min: 832.25 },
    elaboracao_minuta_contrato_testamento: { min: 4722.0, pct: 3 },
    parecer_ou_memorial: { min: 3329.01 },
    requerimento_ou_peticoes: { min: 1165.15 },
    exame_processo_geral: { min: 737.81 },
    intervencao_amigavel: { min: 2951.25, pct_se_interesse_economico: 10 },
  },
  administrativo: {
    sindicancia_processo_admin_defesa: { min: 2996.12, pct: 10 },
    processo_admin_recurso: { min: 5825.77, pct: 5 },
    acao_defesa_fase_administrativa: { min: 9987.04, pct: 20 },
    recurso_fase_administrativa: { min: 4993.5, pct: 10 },
    acao_defesa_fase_judicial: { min: 16645.05, pct: 20 },
    recurso_fase_judicial: { min: 8322.52, pct: 10 },
  },
  juizados_especiais: {
    inicial_contestacao_audiencia: { min: 1331.6, pct: 20 },
    segunda_instancia: { min: 998.7, pct: 10 },
    sustentacao_oral_turmas_recursais: { min: 998.7, pct: 10 },
  },
  civel: {
    procedimento_ordinario: { min: 5992.22, pct: 20 },
    procedimento_sumario: { min: 4161.27, pct: 20 },
    cumprimento_sentenca: { min: 3329.01, pct: 20 },
    impugnacao_cumprimento_sentenca: { min: 3329.01, pct: 20 },
    execucao_titulo_extrajudicial: { min: 3329.01, pct: 20 },
    impugnacao_embargos_execucao_extrajudicial: { min: 3329.01, pct: 20 },
    processo_cautelar_especifico: { min: 3329.01, pct: 10 },
    processo_cautelar_inominado: { min: 4161.27, pct: 20 },
    consignacao_pagamento: { min: 4161.27, pct: 20 },
    deposito: { min: 3329.01, pct: 10 },
    anulacao_substituicao_titulo_portador: { min: 3329.01, pct: 10 },
    prestacao_contas: { min: 9987.04 },
    possessoria_movel: { min: 3329.01, pct: 20 },
    possessoria_imovel: { min: 5825.77, pct: 20 },
    nunciacao_obra_nova: { min: 5164.69, pct: 10 },
    usucapiao: { min: 5825.77, pct: 20 },
    divisao_demarcacao: { min: 5164.69, pct: 10 },
    embargos_terceiro: { min: 5825.77, pct: 10 },
    habilitacao: { min: 4161.27, pct: 10 },
    restauracao_autos: { min: 4161.27, pct: 10 },
    vendas_credito_reserva_dominio: { min: 4161.27, pct: 10 },
    juizo_arbitral: { min: 5164.69, pct: 10 },
    acao_monitoria: { min: 2951.25, pct: 10 },
    desapropriacao_direta: { min: 5902.51, pct: 10 },
    desapropriacao_indireta: { min: 9987.04, pct: 20 },
    inominada: { min: 4161.27, pct: 10 },
    retificacao_registro_publico: { min: 4161.27 },
    alvara_judicial: { min: 2951.25, pct: 20 },
    constituicao_extincao_usufruto_fideicomisso: { min: 4426.88, pct: 10 },
    mandado_seguranca: { min: 6658.02, pct: 20 },
    acao_despejo: { min: 5164.69, pct: 20 },
    acao_renovatoria_locacao: { min: 5164.69, pct: 20 },
    revisao_arbitramento_aluguel: { min: 5164.69, pct: 20 },
    consignacao_aluguel: { min: 4161.27, pct: 20 },
    atos_acompanhamento_despejo_reintegracao: { min: 3329.01 },
    dissolucao_sociedade: { min: 6658.02, pct: 20 },
    cancelamento_protesto: { min: 4161.27, pct: 15 },
    mandado_injuncao: { min: 4161.27 },
    habeas_data: { min: 4161.27 },
    acao_negatoria_propriedade_intelectual: { min: 17477.31 },
    acao_indenizatoria_contrafacao: { min: 11651.53 },
    busca_apreensao_propriedade_intelectual: { min: 14148.3 },
    proc_admin_propriedade_intelectual: { min: 5164.69 },
    registro_loteamento_desmembramento: { min: 4161.27, pct: 10 },
    opcao_nacionalidade: { min: 3329.01 },
  },
  falencias_recuperacao: {
    pedido_falencia: { min: 4993.5, pct: 20 },
    acao_restituicao_reivindicatoria: { min: 4993.5, pct: 20 },
    pedido_recuperacao_empresa: { min: 8853.75, pct_min: 2, pct_max: 10 },
    pedido_declaracao_insolvencia: { min: 4161.27, pct: 20 },
    habilitacao_credito: { min: 4161.27, pct: 20 },
    representacao_falido: { min: 8322.52, pct: 20 },
    representacao_devedor_insolvente: { min: 8322.52, pct: 20 },
    representacao_administrador_judicial: { min: 9987.04, pct: 10 },
  },
  familia_sucessoes: {
    divorcio_judicial_consensual: { min: 7490.28 },
    divorcio_judicial_com_alimentos_bens: { min: 7490.28, pct: 6 },
    divorcio_judicial_litigioso: { min: 11651.53 },
    divorcio_judicial_litigioso_com_alimentos_bens: { min: 11651.53, pct: 10 },
    reconvencao_divorcio: { min: 11651.53, pct: 8 },
    dissolucao_uniao_estavel_consensual: { min: 7490.28 },
    dissolucao_uniao_estavel_com_alimentos_bens: { min: 7490.28, pct: 6 },
    dissolucao_uniao_estavel_litigiosa: { min: 11651.53 },
    dissolucao_uniao_estavel_litigiosa_com_alimentos_bens: { min: 11651.53, pct: 10 },
    investigacao_paternidade_com_heranca: { min: 11651.53 },
    investigacao_paternidade_com_alimentos: { min: 11651.53 },
    acao_alimentos_provisorios_revisionais: { pct_base: "3 pensões mensais" },
    execucao_alimentos: { pct_base: "3 pensões mensais" },
    curatela: { min: 4161.27 },
    tutela: { min: 4161.27 },
    emancipacao: { min: 2496.76 },
    adocao_nacional: { min: 9987.04 },
    adocao_estrangeira: { min: 5825.77 },
    acao_regulamentacao_visitas: { min: 5825.77 },
    busca_apreensao_criancas: { min: 5825.77 },
    interdito_levantamento: { min: 5825.77 },
    alteracao_guarda: { min: 5825.77 },
    habeas_corpus_prisao_civil: { min: 7490.28 },
    desconsideracao_personalidade_juridica: { min: 8322.52 },
    inventario_sem_litigio: { pct_monte_mor: 8 },
    inventario_com_litigio: { pct_monte_mor: 10 },
    inventario_extrajudicial: { pct_monte_mor: 6 },
    acao_declaratoria_indignidade: { min: 7823.17, pct: 20 },
    acao_declaratoria_deserdacao: { min: 7823.17, pct: 20 },
    retificacao_partilha: { min: 4161.27 },
    minuta_testamento: { min: 5825.77 },
  },
  trabalhista: {
    patrocinio_reclamante: { min: 0, pct_min: 15, pct_max: 30 },
    acrescimo_recurso_ordinario_reclamante: { min: 1165.15, pct: 5 },
    acrescimo_recurso_revista_reclamante: { min: 1165.15, pct: 5 },
    patrocinio_reclamado: { min: 4161.27, pct_min: 20, pct_max: 30 },
    acrescimo_recurso_ordinario_reclamado: { min: 2996.12, pct: 5 },
    acrescimo_recurso_revista_reclamado: { min: 4161.27, pct: 10 },
    execucao_sentenca_mandatario_especifico: { min: 4161.27, pct: 20 },
    execucao_sentenca_mandatario_causa: { min: 1997.42, pct: 5 },
    processo_cautelar_autonomo: { min: 2996.12, pct: 20 },
    reintegracao_empregado: { min: 4993.5, pct: 20 },
    homologacao_judicial_demissao_estavel: { min: 4161.27, pct: 20 },
    dissidio_coletivo_ate_100_empregados: { min: 8322.52 },
    dissidio_coletivo_101_300_empregados: { min: 9987.04 },
    dissidio_coletivo_301_600_empregados: { min: 11651.53 },
    dissidio_coletivo_acima_600_empregados: { min: 15812.79 },
    dissidio_sindicato_ate_50_empresas: { min: 11651.53 },
    dissidio_sindicato_acima_50_empresas: { min: 19974.06 },
    inquerito_apuracao_falta_grave_defesa: { min: 3329.01, pct: 20 },
    inquerito_apuracao_falta_grave_proposicao: { min: 5825.77, pct: 20 },
    consultoria_empresa_ate_50_empregados: { min: 8322.52 },
    consultoria_empresa_acima_50_empregados: { min: 11651.53 },
    habilitacao_credito_trabalhista: { pct: 10 },
    acao_indenizatoria_acidente_trabalho: { min: 5164.69, pct_min: 20, pct_max: 30 },
  },
  criminal: {
    diligencia_tco_diurno: { min: 832.25 },
    diligencia_tco_noturno: { min: 1330.12 },
    atuacao_inquerito_policial: { min: 9987.04 },
    ato_judicial: { min: 4993.5 },
    atos_orgaos_policiais_diurno: { min: 1997.42 },
    atos_orgaos_policiais_noturno: { min: 4993.5 },
    exame_processo_penal_parecer_verbal: { min: 5825.77 },
    defesa_procedimento_sumario: { min: 11651.53 },
    defesa_procedimento_comum: { min: 15812.79 },
    defesa_procedimento_especial: { min: 23303.07 },
    defesa_procedimento_especial_foro_privilegiado: { min: 34954.6 },
    defesa_juri_ate_pronuncia: { min: 34954.6 },
    defesa_juri_plenario: { min: 34954.6 },
    queixa_crime_representacao: { min: 5825.77 },
    acompanhamento_acusacao: { min: 8821.87 },
    defesa_execucao_penal: { min: 11651.53 },
    liberdade_provisoria_relaxamento_flagrante: { min: 7823.7 },
    livramento_condicional_progressao_regime: { min: 7823.7 },
    acompanhamento_busca_apreensao: { min: 4993.5 },
    habeas_corpus_autonomo: { min: 15812.79 },
    habeas_corpus_plantao: { min: 23303.07 },
    habeas_corpus_trancamento: { min: 15812.79 },
    mandado_seguranca_penal: { min: 15812.79 },
    revisao_criminal: { min: 15812.79 },
    apelacao_2_grau: { min: 11651.53 },
    memoriais_2_grau: { min: 5825.77 },
    sustentacao_oral_2_grau: { min: 5825.77 },
    embargos_infringentes: { min: 5825.77 },
    embargos_declaratorios: { min: 4993.5 },
    agravo_execucao_penal: { min: 7338.2 },
    habeas_corpus_tribunais_superiores_execucao: { min: 15724.71 },
    atendimento_preso_videoconferencia: { min: 524.16 },
  },
  fiscal_tributario: {
    proc_defesa_admin_1_instancia: { min: 4161.27, pct: 10 },
    proc_defesa_admin_2_instancia: { min: 4161.27, pct: 10 },
    parecer_normas_tributarias: { min: 8322.52, pct: 10 },
    acao_anulatoria_debito_tributario: { min: 9987.04, pct: 15 },
    defesa_execucao_fiscal: { min: 9987.04, pct: 15 },
    acao_repeticao_indebito: { min: 8322.52, pct: 15 },
    liberacao_mercadorias: { min: 4161.27, pct: 10 },
    outros_proc_fiscal: { min: 4161.27, pct: 10 },
    consultoria_micro_pequena_empresa: { min: 1997.42 },
    consultoria_ltda: { min: 5825.77 },
    consultoria_sa: { min: 9987.04 },
    consultoria_demais_entidades: { min: 4161.27 },
  },
  consumidor: {
    proc_defesa_admin_empresa: { min: 5164.69, pct: 10 },
    parecer_normas_consumo: { min: 4161.27, pct: 20 },
    acao_consumidor_fato_produto_servico: { min: 5825.77, pct: 20 },
    acao_consumidor_vicio_produto: { min: 5825.77, pct: 20 },
    acao_consumidor_publicidade_enganosa: { min: 5825.77, pct: 20 },
    acao_consumidor_clausulas_abusivas: { min: 5825.77, pct: 20 },
    defesa_acao_consumidor: { min: 9987.04, pct: 20 },
    audiencia_isolada_prova_oral: { min: 2330.31 },
    consultoria_empresa_pequeno_porte: { min: 6658.02 },
    consultoria_empresa_medio_porte: { min: 9154.77 },
    consultoria_empresa_grande_porte: { min: 11651.53 },
  },
  ambiental_urbanistico: {
    analise_contrato_ambiental: { min: 3329.01, pct: 3 },
    proc_defesa_admin_auto_infracao: { pct: 10 },
    acompanhamento_licenciamento: { min: 8322.52, pct: 3 },
    defesa_inquerito_civil: { min: 8322.52 },
    defesa_processo_civil: { min: 11651.53, pct: 20 },
    acao_civil_publica: { min: 16645.05, pct: 20 },
    audiencia_isolada_prova: { min: 2330.31 },
    parecer_normas_ambientais: { min: 6658.02, pct: 5 },
    processo_crime_ambiental: { min: 19974.06 },
    acao_popular: { pct: 5 },
    mandado_seguranca_ambiental: { pct: 10 },
    compliance_ambiental: { min: 9987.04 },
    assessoria_esg: { min: 16645.05 },
    due_diligence_ambiental: { min: 4993.51 },
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
function getLabel(cat: string, key: string) {
  return HON_LABELS[cat]?.[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    if (s) return JSON.parse(s);
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
          <span className="text-xs text-white">Mínimo fixo OAB-SP 2024{destMin ? " ✅" : ""}</span>
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
        ⓘ Valores mínimos conforme Tabela OAB-SP 2024 · art. 22 §2º Estatuto OAB
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
        <div className="text-xs font-bold" style={{ color: "#e8874a" }}>Total Mínimo OAB-SP 2024</div>
        <div className="text-2xl font-black font-mono" style={{ color: "#e8874a" }}>{fmtBRL(usarVal)}</div>
      </div>
      <div className="text-[0.65rem] opacity-40 text-white">
        ⓘ Valores mínimos conforme Tabela OAB-SP 2024 · art. 22 §2º Estatuto OAB
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
                    let pctStr = "—";
                    if (cfg.pct) pctStr = `${cfg.pct}%`;
                    else if (cfg.pct_min && cfg.pct_max) pctStr = `${cfg.pct_min}%–${cfg.pct_max}%`;
                    else if (cfg.pct_monte_mor) pctStr = `${cfg.pct_monte_mor}% monte-mor`;
                    else if (cfg.pct_base) pctStr = cfg.pct_base;
                    else if (cfg.pct_se_interesse_economico) pctStr = `${cfg.pct_se_interesse_economico}%`;
                    return (
                      <tr key={key} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{getLabel(catKey, key)}</td>
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
type TabKey = "consulta" | "judicial" | "extrajudicial" | "trabalhista" | "familia" | "criminal" | "tabela" | "importar";

export function HonorariosPage() {
  const { data: processos = [] } = useProcessos();
  const [tab, setTab] = useState<TabKey>("judicial");
  const [tabela, setTabela] = useState(() => getTabelaOAB());
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
  const [consultaResult, setConsultaResult] = useState<CalcResult | null>(null);

  // ── Importar
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vigencia = `Tabela OAB-SP v${tabela.versao || "—"} · ${(tabela.fonte || "OAB-SP").replace("Tabela de Honorários ", "")}`;

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
    const pct = cfg[pctKey] || cfg.pct;
    if (pct && valor > 0) {
      pctValor = valor * (pct / 100);
      minVal = Math.max(rawMin, pctValor);
      pctLabel = `${pct}%`;
      valorLabel = fmtBRL(valor);
      pctInfo = `${pct}% s/ ${fmtBRL(valor)}`;
    } else if (cfg.pct_min && cfg.pct_max) {
      pctInfo = `${cfg.pct_min}%–${cfg.pct_max}%`;
      if (valor > 0) { pctValor = valor * (cfg.pct_min / 100); minVal = Math.max(rawMin, pctValor); pctLabel = `${cfg.pct_min}%`; valorLabel = fmtBRL(valor); }
    } else if (cfg.pct_monte_mor && valor > 0) {
      pctValor = valor * (cfg.pct_monte_mor / 100); minVal = Math.max(rawMin, pctValor);
      pctLabel = `${cfg.pct_monte_mor}%`; valorLabel = `${fmtBRL(valor)} (monte-mor)`; pctInfo = `${cfg.pct_monte_mor}% sobre o monte-mor`;
    } else if (cfg.pct_base) { pctInfo = cfg.pct_base; }
    return { label: "", rawMin, pctValor, pctLabel, pctInfo, valorLabel, minVal };
  }

  function calcMulti(fonte: any, cat: string, sel: Set<string>, valor: number) {
    const results: CalcResult[] = [];
    sel.forEach((key) => {
      const cfg = fonte?.[key];
      if (!cfg) return;
      const r = calcItem(cfg, valor);
      results.push({ ...r, label: getLabel(cat, key) });
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

  function calcConsulta() {
    let fonte: any = null;
    if (consultaCat === "previdenciario_segurado") fonte = tabela.previdenciario?.segurado;
    else if (consultaCat === "previdenciario_empresarial") fonte = tabela.previdenciario?.empresarial;
    else fonte = tabela[consultaCat];
    const cfg = fonte?.[consultaKey];
    if (!cfg) { setConsultaResult(null); return; }
    const valor = parseBRL(consultaValor);
    const r = calcItem(cfg, valor);
    setConsultaResult({ ...r, label: getLabel(consultaCat, consultaKey) });
  }

  // ── Importar JSON
  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const nova = JSON.parse(e.target?.result as string);
        if (!nova.versao) throw new Error('Campo "versao" ausente.');
        if (!nova.extrajudicial && !nova.civel && !nova.trabalhista && !nova.criminal)
          throw new Error("Nenhuma categoria de honorários encontrada.");
        nova.importadoEm = new Date().toLocaleDateString("pt-BR");
        salvarTabelaOAB(nova);
        setTabela(nova);
        const cats = Object.keys(nova).filter((k) => typeof nova[k] === "object" && k !== "observacoes").length;
        setImportResult(`✅ Tabela importada com sucesso! Versão: ${nova.versao} · ${nova.fonte || ""} · ${cats} categorias.`);
        toast.success("✅ Tabela OAB-SP atualizada!");
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

HONORÁRIOS CONFORME TABELA OAB-SP ${tabela.versao || "2024"}
  Valor mínimo sugerido: ${fmtBRL(minVal)}

VALOR PROPOSTO: ${fmtBRL(minVal)}

─────────────────────────────────────────

FORMA DE PAGAMENTO (sugestão)
  — 50% no ato da contratação: ${fmtBRL(minVal * 0.5)}
  — 50% ao final / êxito:      ${fmtBRL(minVal * 0.5)}

OBSERVAÇÕES
• Honorários contratuais, independentes dos sucumbenciais (art. 85, §14 CPC).
• Recursos ou instâncias superiores objeto de aditivo.
• Base: Tabela OAB-SP, vigência ${tabela.vigencia || tabela.versao || "2024"}.`;
  }

  // ── Tabs config
  const tabs: { key: TabKey; label: string }[] = [
    { key: "consulta", label: "🔍 Consultar" },
    { key: "judicial", label: "⚖️ Judiciais" },
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
    return Object.keys(tabela[judCat] || {}).map((k) => ({ value: k, label: getLabel(judCat, k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  function extOpcoes() { return Object.keys(tabela.extrajudicial || {}).map((k) => ({ value: k, label: getLabel("extrajudicial", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function trabOpcoes() { return Object.keys(tabela.trabalhista || {}).map((k) => ({ value: k, label: getLabel("trabalhista", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function famOpcoes() { return Object.keys(tabela.familia_sucessoes || {}).map((k) => ({ value: k, label: getLabel("familia_sucessoes", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }
  function crimOpcoes() { return Object.keys(tabela.criminal || {}).map((k) => ({ value: k, label: getLabel("criminal", k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")); }

  function consultaOpcoes() {
    let fonte: any = null;
    if (consultaCat === "previdenciario_segurado") fonte = tabela.previdenciario?.segurado;
    else if (consultaCat === "previdenciario_empresarial") fonte = tabela.previdenciario?.empresarial;
    else fonte = tabela[consultaCat];
    return Object.keys(fonte || {}).map((k) => ({ value: k, label: getLabel(consultaCat, k) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
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

      {/* ── TABELA COMPLETA ── */}
      {tab === "tabela" && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
            <div>
              <div className="font-bold">📋 Tabela de Honorários OAB-SP Vigente</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tabela.fonte} · {tabela.importadoEm ? `importada em ${tabela.importadoEm}` : "padrão 2024"}</div>
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
  "versao": "2024",
  "fonte": "Tabela de Honorários OAB/SP 2024",
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
