# 🚀 Guia Rápido de Instalação

## 📦 Extração

```bash
unzip jurismonitor-corrigido.zip
cd jurismonitoredson-main
```

## 🔧 Instalação de Dependências

```bash
npm install
```

## ⚙️ Configuração

1. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```

2. **Edite o arquivo `.env` com suas credenciais:**
- Supabase URL e API Key
- Outras configurações necessárias

## 🏃 Executar em Desenvolvimento

```bash
npm run dev
```

O sistema estará disponível em: `http://localhost:5173`

## 🧪 Testar o Modal de Intimações

1. **Acesse**: `http://localhost:5173/intimacoes`
2. **Abra o Console**: Pressione `F12`
3. **Clique** em qualquer número de processo
4. **Verifique** os logs de debug no console
5. **Confirme** que o modal aparece na tela

## 📝 O que Você Verá no Console

```
[DEBUG] Clique no processo: 1234567-89.2024.1.00.0000 ID: aasp_12345
[DEBUG] Estado selected atualizado para: {_id: "aasp_12345", ...}
[DEBUG] Estado 'selected' mudou: ID: aasp_12345, Processo: 1234567-89.2024.1.00.0000
[DEBUG] Renderizando ModalDetalhe com intimação: aasp_12345
[DEBUG] ModalDetalhe renderizado para intimação: aasp_12345
```

## ✅ Modal Funcionando!

Você verá uma janela modal com:
- 📋 Título da intimação
- 🔢 Número do processo (CNJ)
- 📅 Data de publicação
- 📰 Órgão de publicação
- ⚖️ Órgão julgador
- 👥 Partes envolvidas
- 🤖 Resumo da IA
- 📄 Texto completo
- 🔘 Botões de ação

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos de produção estarão em `dist/`

## 🚀 Deploy

### Vercel
```bash
vercel --prod
```

### Outras Plataformas
Consulte `docs/DEPLOY.md` para instruções específicas.

## 🔍 Solução de Problemas

### Modal não aparece?
1. Verifique o console para erros
2. Confirme que os logs de debug aparecem
3. Teste em modo anônimo (sem extensões)
4. Limpe o cache do navegador

### Erros de compilação?
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro de porta em uso?
```bash
# Use outra porta
npm run dev -- --port 3001
```

## 📚 Documentação Adicional

- `RESUMO_CORRECOES.md` - Resumo das correções aplicadas
- `CORRECOES_MODAL_INTIMACOES.md` - Documentação completa das correções
- `docs/GUIA_INSTALACAO.md` - Guia de instalação detalhado
- `docs/DEPLOY.md` - Guia de deploy
- `README.md` - Documentação geral do projeto

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs no console (F12)
2. Consulte a documentação em `docs/`
3. Revise as mensagens de erro
4. Verifique as configurações no arquivo `.env`

## 🎉 Pronto!

O sistema está funcionando com o modal de intimações corrigido e pronto para uso!

---

**Desenvolvido com ❤️ para Jurismonitor**
**Correções aplicadas em: Maio 2026**
