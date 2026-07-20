# 🚀 Guia Rápido de Instalação - Melhorias JurisMonitor

## ⚡ Instalação em 5 Passos

### 📋 Passo 1: Executar Migration do Banco de Dados

1. Acesse o **Supabase Dashboard** (https://supabase.com)
2. Selecione seu projeto JurisMonitor
3. Clique em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo `docs/feriados-schema.sql`
6. Clique em **RUN** para executar
7. Aguarde a mensagem de sucesso ✅

**O que isso faz?**
- Cria a tabela `feriados`
- Adiciona políticas de segurança (RLS)
- Pré-cadastra feriados nacionais de 2025 e 2026

---

### 📁 Passo 2: Adicionar Novo Hook

Copie o arquivo:
```
src/hooks/useFeriados.tsx
```

**O que esse arquivo faz?**
- Gerencia operações de CRUD para feriados
- Fornece funções de cálculo de dias úteis
- Integra com Supabase

---

### 🔄 Passo 3: Atualizar Arquivos Existentes

#### 3.1 Atualizar Página de Tarefas
O arquivo `src/pages/TarefasPage.tsx` foi completamente reescrito com:
- ✅ Função de editar tarefas
- ✅ Gerenciamento de feriados integrado
- ✅ Visualização de próximos feriados
- ✅ Formulário para adicionar feriados

**Backup criado:** `src/pages/TarefasPage_OLD.tsx`

#### 3.2 Atualizar Página de Intimações
O arquivo `src/pages/IntimacoesPage.tsx` foi atualizado:
- ✅ Coluna PUBLICAÇÃO mostra órgão julgador
- ✅ Coluna PUBLICAÇÃO mostra nome das partes
- ✅ Coluna PARTES removida (dados agora na PUBLICAÇÃO)

---

### 🧪 Passo 4: Testar as Funcionalidades

#### Testar Tarefas
1. Acesse a tela de **Tarefas**
2. Crie uma nova tarefa
3. Clique no ícone de **lápis** para editar
4. Modifique os dados e salve
5. Verifique se as alterações foram aplicadas ✅

#### Testar Feriados
1. Na tela de Tarefas, veja a seção **"FERIADOS E SUSPENSÕES"**
2. Clique em **"+ Adicionar"**
3. Preencha:
   - Data: Escolha uma data futura
   - Descrição: Ex: "Feriado Municipal - Aniversário da Cidade"
   - Tipo: Feriado
   - Abrangência: Municipal
4. Clique em **Salvar**
5. Verifique se o feriado aparece na lista ✅
6. Clique em **"Ver Todos"** para ver a lista completa

#### Testar Intimações
1. Acesse a tela de **Intimações**
2. Busque intimações (clique em "Atualizar")
3. Na tabela, observe a coluna **PUBLICAÇÃO**
4. Verifique se aparecem:
   - 📍 Órgão (quando disponível)
   - 👤 Partes (quando disponível)
5. Confirme que os dados estão corretos ✅

---

### 📊 Passo 5: Verificar no Banco de Dados

#### Verificar Tabela de Feriados
Execute no SQL Editor do Supabase:
```sql
SELECT * FROM feriados ORDER BY data;
```

Você deve ver:
- Feriados nacionais de 2025 e 2026
- Feriados que você cadastrou
- Campos: id, user_id, data, descricao, tipo, abrangencia

#### Verificar Tarefas Atualizadas
```sql
SELECT id, titulo, data_vencimento, prioridade, status 
FROM tarefas 
WHERE user_id = auth.uid()
ORDER BY data_vencimento;
```

---

## 🎯 Funcionalidades Implementadas

### ✅ Tela de Tarefas

| Funcionalidade | Status | Descrição |
|---------------|--------|-----------|
| Editar Tarefa | ✅ | Botão de lápis em cada tarefa |
| Excluir Tarefa | ✅ | Botão de lixeira com confirmação |
| Adicionar Feriado | ✅ | Formulário completo |
| Visualizar Feriados | ✅ | Lista expansível |
| Excluir Feriado | ✅ | Apenas feriados locais |
| Cálculo de Prazos | ✅ | Considera feriados e fins de semana |

### ✅ Tela de Intimações

| Funcionalidade | Status | Descrição |
|---------------|--------|-----------|
| Mostrar Órgão | ✅ | Na coluna PUBLICAÇÃO |
| Mostrar Partes | ✅ | Na coluna PUBLICAÇÃO |
| Layout Otimizado | ✅ | Coluna duplicada removida |

---

## 🔍 Troubleshooting

### Problema: Tabela feriados não existe
**Solução:** Execute novamente o script `docs/feriados-schema.sql`

### Problema: Hook useFeriados não encontrado
**Solução:** Verifique se o arquivo está em `src/hooks/useFeriados.tsx`

### Problema: Erro ao editar tarefa
**Solução:** 
1. Verifique se o hook `useUpdateTarefa` está importado
2. Verifique permissões no Supabase (RLS)

### Problema: Feriados nacionais não aparecem
**Solução:** 
Execute no SQL Editor:
```sql
-- Verificar se existem feriados
SELECT COUNT(*) FROM feriados WHERE abrangencia = 'nacional';

-- Se retornar 0, execute novamente a parte de INSERT do script
```

### Problema: Órgão/Partes não aparecem nas intimações
**Solução:**
- Esses dados vêm da API AASP
- Nem todas as intimações têm esses campos
- Verifique se a API está retornando os dados
- Se não aparecer nada, a API pode não ter essa informação

---

## 📱 Compatibilidade

### Navegadores Testados
- ✅ Chrome/Edge (Recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile (iOS/Android)

### Versões
- ✅ React 18+
- ✅ TypeScript 5+
- ✅ Supabase (última versão)
- ✅ TailwindCSS 3+

---

## 🎨 Personalização

### Alterar Cores dos Feriados
Edite em `src/pages/TarefasPage.tsx`:
```tsx
// Linha do card de feriado
className="bg-primary/5 border border-primary/20"
```

### Mudar Quantidade de Feriados Exibidos
```tsx
// Altere de 5 para o número desejado
.slice(0, 5);
```

### Adicionar Novos Tipos de Feriado
1. Edite o tipo no hook: `src/hooks/useFeriados.tsx`
2. Adicione opção no select do formulário

---

## 📚 Arquivos Importantes

```
📦 jurismonitoredson-main
 ┣ 📂 docs
 ┃ ┣ 📜 feriados-schema.sql          ⭐ SQL para criar tabela
 ┃ ┗ 📜 MELHORIAS_TAREFAS_INTIMACOES.md ⭐ Documentação completa
 ┣ 📂 src
 ┃ ┣ 📂 hooks
 ┃ ┃ ┗ 📜 useFeriados.tsx            ⭐ NOVO - Hook de feriados
 ┃ ┗ 📂 pages
 ┃   ┣ 📜 TarefasPage.tsx            ⭐ ATUALIZADO
 ┃   ┣ 📜 TarefasPage_OLD.tsx        💾 Backup
 ┃   ┗ 📜 IntimacoesPage.tsx         ⭐ ATUALIZADO
```

---

## ✨ Próximos Passos

Após a instalação, você pode:

1. **Cadastrar Feriados Municipais** da sua comarca
2. **Importar Feriados Estaduais** (São Paulo, por exemplo)
3. **Criar Tarefas** com prazos que consideram feriados
4. **Testar o Cálculo de Prazos** criando uma tarefa com vencimento

---

## 💡 Dicas de Uso

### Feriados
- Cadastre feriados com antecedência
- Use tipo "Suspensão" para recessos forenses
- Marque a abrangência correta para facilitar filtros futuros

### Tarefas
- Edite tarefas para ajustar prazos
- Use prioridades para organizar trabalho
- Vincule tarefas a processos para rastreabilidade

### Intimações
- Órgão e Partes ajudam a identificar rapidamente
- Use os filtros para encontrar intimações específicas
- Marque como "Finalizada" após providências

---

## 🆘 Suporte

Problemas? Verifique:
1. ✅ Migration executada no Supabase
2. ✅ Arquivos nos locais corretos
3. ✅ Sem erros no console do navegador (F12)
4. ✅ Permissões RLS configuradas

---

**🎉 Instalação Concluída!**

Agora você tem:
- ✅ Edição de tarefas
- ✅ Gerenciamento completo de feriados
- ✅ Cálculo de prazos automático
- ✅ Intimações com mais informações

**Bom trabalho! 🚀**
