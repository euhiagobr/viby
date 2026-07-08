# Backfill User Identities - Quick Start

## 🚀 Execução Rápida

### 1. Simular (Recomendado Primeiro)
```bash
npm run backfill:dry-run
```

### 2. Executar de Verdade
```bash
npm run backfill:execute
```

### 3. Validar Resultado
```bash
npm run backfill:validate
```

---

## 📋 Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| **Migração** | `npm run backfill:dry-run` | Simula migração (sem alterações) |
| | `npm run backfill:execute` | Executa migração real |
| **Validação** | `npm run backfill:validate` | Valida integridade pós-migração |
| **Testes** | `npm run backfill:test` | Executa suite de testes |
| **Rollback** | `npm run backfill:rollback:dry-run` | Simula reversão |
| | `npm run backfill:rollback:execute` | Executa reversão (CUIDADO!) |

---

## 🔧 Opções Avançadas

### Customizar Tamanho de Lote
```bash
ts-node scripts/backfill-user-identities.ts --dry-run --batch-size=100
ts-node scripts/backfill-user-identities.ts --execute --batch-size=200
```

### Com Relatório Detalhado
```bash
npm run backfill:dry-run > backfill.log 2>&1
```

---

## 📊 Fluxo Recomendado

```
1. Backup Firestore
   ↓
2. npm run backfill:dry-run
   ↓ Revisar relatório
3. npm run backfill:execute
   ↓ Aguardar conclusão
4. npm run backfill:validate
   ↓ Verificar integridade
5. Documentar resultado em CHANGELOG
```

---

## ✅ Checklist

- [ ] Backup realizado
- [ ] Equipe notificada
- [ ] Dry-run executado com sucesso
- [ ] Relatório revisado
- [ ] Execução agendada em off-peak
- [ ] Validação planejada
- [ ] Rollback testado

---

## 📚 Documentação Completa

Veja [BACKFILL-IDENTITIES.md](../docs/BACKFILL-IDENTITIES.md) para:
- Explicação detalhada da migração
- Validação pós-migração
- Troubleshooting
- Casos de uso especiais

---

## 🆘 Suporte

Se houver problema:

1. **Revisar relatório:**
   ```bash
   cat reports/backfill-report-*.json | jq '.'
   ```

2. **Rollback (emergência):**
   ```bash
   npm run backfill:rollback:execute
   ```

3. **Contactar DevOps**
