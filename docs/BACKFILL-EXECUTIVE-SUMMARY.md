# Backfill de Identidades - Plano Executivo

## 📌 Resumo

Migração de **todos os usuários legados** da coleção `/users` para o novo sistema de identidades em `/user_identities`.

**Status**: ✅ Pronto para Produção  
**Risco**: 🟢 Baixo (Reversível | Idempotente | Auditável)  
**Duração Estimada**: 5-15 minutos (depende de volume)

---

## 🎯 Objetivo

Modernizar o sistema de identidades sem quebrar usuários existentes:

✅ **Preserva CPF criptografado** (não descriptografa)  
✅ **Compatibilidade 100%** com sistema legado  
✅ **Reversível** em caso de emergência  
✅ **Idempotente** (pode ser executado múltiplas vezes)  
✅ **Auditoria completa** (relatório detalhado)

---

## 📊 Escopo

| Item | Antes | Depois | Status |
|------|-------|--------|--------|
| Coleção `/users` | Possui CPF direto | Referencia identidade | ✅ Preservado |
| Coleção `/user_identities` | Vazia | +1 identidade por usuário | ✅ Criada |
| Campo `cpfHash` | Em `/users` | Copiado para `documentHash` | ✅ Duplicado |
| Campo `cpfMasked` | Em `/users` | Copiado para `documentMasked` | ✅ Duplicado |
| Campo `cpfEncrypted` | Em `/users` | Copiado se existir | ✅ Preservado |

---

## 🔒 Segurança

✅ **Sem descriptografia**: Dados sensíveis nunca são descriptografados  
✅ **Sem cópia em texto plano**: Apenas hashes são manipulados  
✅ **Audit trail**: Cada identidade marca `migratedFrom: 'legacy_users'`  
✅ **Validação**: Script verifica integridade antes/depois  

---

## 📈 Impacto

### Positivo
- ✅ Suporte a documentos internacionais
- ✅ Arquitetura escalável
- ✅ Melhor auditoria
- ✅ Preparação para Phase 4+

### Nenhum Impacto Negativo
- ✅ Usuários existentes funcionam normalmente
- ✅ CPF legado continua protegido
- ✅ Fluxo de login inalterado
- ✅ Ingressos/tickets inalterados

---

## 🚀 Execução

### Pré-Migração
```
[ ] Backup Firestore realizado
[ ] Equipe de on-call notificada
[ ] Horário off-peak definido
[ ] Monitoramento ativo
```

### Durante
```bash
# 1. Simular
npm run backfill:dry-run

# 2. Executar
npm run backfill:execute

# 3. Validar
npm run backfill:validate
```

### Pós-Migração
```
[ ] Relatório revisado (0 órfãos, 0 mismatches)
[ ] Testes de smoke realizados
[ ] Documentação atualizada
[ ] Resultado comunicado
```

---

## ⏱️ Timeline

| Fase | Duração | Status |
|------|---------|--------|
| Setup/Teste | 2 horas | ✅ Concluído |
| Dry-run | 5 minutos | ⏳ Na migração |
| Execução | 5-15 minutos | ⏳ Na migração |
| Validação | 5 minutos | ⏳ Na migração |
| **Total** | **~30 minutos** | |

---

## 🔙 Plano de Contingência

Se houver erro:

1. **Identificar** (1 min)
   ```bash
   cat reports/backfill-report-*.json | jq '.summary.errorDetails'
   ```

2. **Decidir** (1-5 min)
   - Erro pequeno → Re-executar dry-run para retry
   - Erro crítico → Executar rollback

3. **Executar** (2-5 min)
   ```bash
   npm run backfill:rollback:execute
   ```

4. **Verificar** (2 min)
   ```bash
   npm run backfill:validate
   ```

---

## 📋 Checklist Executivo

- [ ] Script testado em dev
- [ ] Equipe de DevOps notificada
- [ ] Plano de rollback aprovado
- [ ] Janela de manutenção agendada
- [ ] Stakeholders informados
- [ ] Backup pré-migração confirmado
- [ ] Monitores de erro configurados
- [ ] Pós-migração: Relatório documentado

---

## 👥 Responsabilidades

| Papel | Ação |
|------|-------|
| **DevOps** | Executa migration script em produção |
| **SRE** | Monitora performance/erros durante execução |
| **QA** | Valida integridade pós-migração |
| **PM** | Comunica status aos stakeholders |
| **Backend** | On-call para suporte se necessário |

---

## 📞 Contatos

- **DevOps Lead**: [Definir]
- **SRE On-Call**: [Definir]
- **Backend Tech Lead**: [Definir]

---

## ✅ Aprovações

| Stakeholder | Data | Assinatura |
|------------|------|-----------|
| Tech Lead | | |
| DevOps Lead | | |
| Product Manager | | |

---

## 📚 Referências

- **Script Principal**: `scripts/backfill-user-identities.ts`
- **Documentação Técnica**: `docs/BACKFILL-IDENTITIES.md`
- **Quick Start**: `docs/README-BACKFILL.md`
- **Testes**: `scripts/backfill-user-identities.test.ts`

---

**Última Atualização**: 2024-07-07  
**Versão**: 1.0
