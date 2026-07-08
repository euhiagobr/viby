#!/bin/bash

# Backfill Migration - Checklist de Deploy
# Este script verifica que todos os componentes estão em lugar e prontos

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   BACKFILL USER IDENTITIES - PRÉ-DEPLOY CHECKLIST        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar arquivo
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅${NC} $1"
    return 0
  else
    echo -e "${RED}❌${NC} $1 (NÃO ENCONTRADO)"
    return 1
  fi
}

# Função para verificar diretório
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✅${NC} $1/"
    return 0
  else
    echo -e "${RED}❌${NC} $1/ (NÃO ENCONTRADO)"
    return 1
  fi
}

# Función para verificar script npm
check_script() {
  if grep -q "\"$1\":" package.json; then
    echo -e "${GREEN}✅${NC} npm run $1"
    return 0
  else
    echo -e "${RED}❌${NC} npm run $1 (NÃO CONFIGURADO)"
    return 1
  fi
}

ERRORS=0

echo "📋 Verificando Arquivos..."
echo ""

# Scripts
echo "Scripts:"
check_file "scripts/backfill-user-identities.ts" || ((ERRORS++))
check_file "scripts/backfill-user-identities.test.ts" || ((ERRORS++))
check_file "scripts/backfill-utils.ts" || ((ERRORS++))
check_file "scripts/validate-backfill.ts" || ((ERRORS++))
check_file "scripts/rollback-backfill.ts" || ((ERRORS++))

echo ""
echo "Documentação:"
check_file "docs/BACKFILL-IDENTITIES.md" || ((ERRORS++))
check_file "docs/README-BACKFILL.md" || ((ERRORS++))
check_file "docs/BACKFILL-EXECUTIVE-SUMMARY.md" || ((ERRORS++))
check_file "docs/BACKFILL-SETUP.md" || ((ERRORS++))
check_file "docs/BACKFILL-IMPLEMENTATION.md" || ((ERRORS++))

echo ""
echo "Dependências npm:"
echo "  Verificando se as dependências estão instaladas..."
npm list firebase-admin > /dev/null 2>&1 && echo -e "${GREEN}✅${NC} firebase-admin" || echo -e "${YELLOW}⚠️ ${NC} firebase-admin (verificar npm install)"
npm list ts-node > /dev/null 2>&1 && echo -e "${GREEN}✅${NC} ts-node" || echo -e "${YELLOW}⚠️ ${NC} ts-node (verificar npm install)"
npm list vitest > /dev/null 2>&1 && echo -e "${GREEN}✅${NC} vitest" || echo -e "${YELLOW}⚠️ ${NC} vitest (verificar npm install)"

echo ""
echo "Scripts npm:"
check_script "backfill:dry-run" || ((ERRORS++))
check_script "backfill:execute" || ((ERRORS++))
check_script "backfill:test" || ((ERRORS++))
check_script "backfill:validate" || ((ERRORS++))
check_script "backfill:rollback:dry-run" || ((ERRORS++))
check_script "backfill:rollback:execute" || ((ERRORS++))

echo ""
echo "Diretórios:"
check_dir "scripts" || ((ERRORS++))
check_dir "docs" || ((ERRORS++))
check_dir "firebase" || ((ERRORS++))

echo ""
echo "═════════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ TODOS OS COMPONENTES PRONTOS PARA DEPLOY${NC}"
  echo ""
  echo "Próximos passos:"
  echo "  1. npm run backfill:dry-run          # Simular"
  echo "  2. npm run backfill:execute          # Executar"
  echo "  3. npm run backfill:validate         # Validar"
  echo ""
  exit 0
else
  echo ""
  echo -e "${RED}❌ ENCONTRADOS $ERRORS PROBLEMAS${NC}"
  echo ""
  echo "Solução:"
  echo "  1. Verificar se todos os arquivos existem"
  echo "  2. Executar: npm install"
  echo "  3. Executar: npm run build"
  echo "  4. Repetir checklist"
  echo ""
  exit 1
fi
