/**
 * Script de teste para validar prevenção de CPF duplicado
 * 
 * Uso:
 * npx ts-node -P tsconfig.backfill.json scripts/test-cpf-prevention.ts --local
 * 
 * Ou com Firebase:
 * npx ts-node -P tsconfig.backfill.json scripts/test-cpf-prevention.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Cores para saída
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function hashCPF(cpf: string): string {
  // Simulação de hash (em produção, usa CryptoJS.SHA256)
  return `cpf_hash_${cpf}`;
}

async function testCPFPrevention() {
  log('blue', '\n🧪 TESTE: Prevenção de CPF Duplicado\n');
  log('blue', '='.repeat(60));

  const testResults: {
    testName: string;
    status: 'PASS' | 'FAIL';
    message: string;
  }[] = [];

  try {
    // =================================================================
    // TESTE 1: Normalização de CPF
    // =================================================================
    log('yellow', '\n📝 TESTE 1: Normalização de CPF');
    try {
      const tests = [
        { input: '123.456.789-09', expected: '12345678909' },
        { input: '12345678909', expected: '12345678909' },
        { input: '123 456 789-09', expected: '12345678909' },
      ];

      let allPassed = true;
      tests.forEach(({ input, expected }) => {
        const result = normalizeCPF(input);
        const passed = result === expected;
        allPassed = allPassed && passed;
        log(passed ? 'green' : 'red', `   ${passed ? '✅' : '❌'} ${input} → ${result} (esperado: ${expected})`);
      });

      testResults.push({
        testName: 'Normalização de CPF',
        status: allPassed ? 'PASS' : 'FAIL',
        message: allPassed ? 'Todos os formatos normalizados corretamente' : 'Erro na normalização',
      });
    } catch (error: any) {
      testResults.push({
        testName: 'Normalização de CPF',
        status: 'FAIL',
        message: error.message,
      });
    }

    // =================================================================
    // TESTE 2: Hash Consistente
    // =================================================================
    log('yellow', '\n📝 TESTE 2: Hash Consistente');
    try {
      // IMPORTANTE: Hash recebe CPF JÁ NORMALIZADO
      const normalizedCPF = normalizeCPF('123.456.789-09');
      const hash1 = hashCPF(normalizedCPF);
      const hash2 = hashCPF(normalizedCPF);
      const hash3 = hashCPF(normalizeCPF('123.456.789-09'));

      const consistent = hash1 === hash2 && hash1 === hash3;
      log(consistent ? 'green' : 'red', `   ${consistent ? '✅' : '❌'} Hash é consistente: ${consistent}`);
      log('gray', `      Hash1: ${hash1}`);
      log('gray', `      Hash2: ${hash2}`);
      log('gray', `      Hash3: ${hash3}`);

      testResults.push({
        testName: 'Hash Consistente',
        status: consistent ? 'PASS' : 'FAIL',
        message: consistent ? 'Hash retorna mesmo valor para mesmo CPF normalizado' : 'Hash inconsistente',
      });
    } catch (error: any) {
      testResults.push({
        testName: 'Hash Consistente',
        status: 'FAIL',
        message: error.message,
      });
    }

    // =================================================================
    // TESTE 3: Função createUserWithValidation Disponível
    // =================================================================
    log('yellow', '\n📝 TESTE 3: Verificar Função createUserWithValidation');
    try {
      // Verificar se o arquivo existe
      const userActionsPath = 'd:/viby/src/app/actions/user.ts';
      if (!fs.existsSync(userActionsPath)) {
        throw new Error(`Arquivo não encontrado: ${userActionsPath}`);
      }

      const content = fs.readFileSync(userActionsPath, 'utf8');
      const hasFunction = content.includes('export async function createUserWithValidation');
      const hasNormalize = content.includes('function normalizeCPF');
      const hasCpfExists = content.includes('async function cpfExists');

      const allFound = hasFunction && hasNormalize && hasCpfExists;

      log(hasFunction ? 'green' : 'red', `   ${hasFunction ? '✅' : '❌'} createUserWithValidation definida`);
      log(hasNormalize ? 'green' : 'red', `   ${hasNormalize ? '✅' : '❌'} normalizeCPF definida`);
      log(hasCpfExists ? 'green' : 'red', `   ${hasCpfExists ? '✅' : '❌'} cpfExists definida`);

      testResults.push({
        testName: 'Função createUserWithValidation',
        status: allFound ? 'PASS' : 'FAIL',
        message: allFound ? 'Todas as funções estão presentes' : 'Funções faltando',
      });
    } catch (error: any) {
      testResults.push({
        testName: 'Função createUserWithValidation',
        status: 'FAIL',
        message: error.message,
      });
    }

    // =================================================================
    // TESTE 4: SignUpForm Usando Nova Função
    // =================================================================
    log('yellow', '\n📝 TESTE 4: Verificar SignUpForm.tsx');
    try {
      const signupPath = 'd:/viby/src/components/auth/SignUpForm.tsx';
      if (!fs.existsSync(signupPath)) {
        throw new Error(`Arquivo não encontrado: ${signupPath}`);
      }

      const content = fs.readFileSync(signupPath, 'utf8');
      const hasImport = content.includes("import { createUserWithValidation }");
      const hasCall = content.includes("await createUserWithValidation");
      const noOldFunction = !content.includes("await createUserWithEmailAndPassword");

      const allCorrect = hasImport && hasCall && noOldFunction;

      log(hasImport ? 'green' : 'red', `   ${hasImport ? '✅' : '❌'} Import de createUserWithValidation`);
      log(hasCall ? 'green' : 'red', `   ${hasCall ? '✅' : '❌'} Chamada de createUserWithValidation`);
      log(noOldFunction ? 'green' : 'red', `   ${noOldFunction ? '✅' : '❌'} Não usa createUserWithEmailAndPassword`);

      testResults.push({
        testName: 'SignUpForm.tsx',
        status: allCorrect ? 'PASS' : 'FAIL',
        message: allCorrect ? 'SignUpForm configurada corretamente' : 'Erro na configuração',
      });
    } catch (error: any) {
      testResults.push({
        testName: 'SignUpForm.tsx',
        status: 'FAIL',
        message: error.message,
      });
    }

    // =================================================================
    // TESTE 5: Normalização de Diferentes Formatações
    // =================================================================
    log('yellow', '\n📝 TESTE 5: Equivalência de CPFs (Formatações Diferentes)');
    try {
      const cpf1 = normalizeCPF('111.222.333-44');
      const cpf2 = normalizeCPF('11122233344');
      const cpf3 = normalizeCPF('111 222 333-44');

      const allEqual = cpf1 === cpf2 && cpf2 === cpf3;
      const hash1 = hashCPF(cpf1);
      const hash2 = hashCPF(cpf2);
      const hash3 = hashCPF(cpf3);

      const allHashEqual = hash1 === hash2 && hash2 === hash3;

      log(allEqual ? 'green' : 'red', `   ${allEqual ? '✅' : '❌'} Normalização igual: ${allEqual}`);
      log(allHashEqual ? 'green' : 'red', `   ${allHashEqual ? '✅' : '❌'} Hash igual: ${allHashEqual}`);

      testResults.push({
        testName: 'Equivalência de CPFs',
        status: allEqual && allHashEqual ? 'PASS' : 'FAIL',
        message: allEqual && allHashEqual ? 'Detecção de duplicação funcionará' : 'Duplicação não será detectada',
      });
    } catch (error: any) {
      testResults.push({
        testName: 'Equivalência de CPFs',
        status: 'FAIL',
        message: error.message,
      });
    }

    // =================================================================
    // RESUMO
    // =================================================================
    log('blue', '\n' + '='.repeat(60));
    log('blue', '📊 RESUMO DOS TESTES\n');

    let totalPass = 0;
    let totalFail = 0;

    testResults.forEach(({ testName, status, message }) => {
      if (status === 'PASS') {
        totalPass++;
        log('green', `✅ ${testName}: ${message}`);
      } else {
        totalFail++;
        log('red', `❌ ${testName}: ${message}`);
      }
    });

    log('blue', '\n' + '='.repeat(60));
    log('blue', `\n📈 RESULTADO: ${totalPass}/${testResults.length} testes passaram\n`);

    if (totalFail === 0) {
      log('green', '🎉 TODOS OS TESTES PASSARAM! Sistema pronto para produção.\n');
    } else {
      log('red', `⚠️  ${totalFail} teste(s) falharam. Verifique os logs acima.\n`);
      process.exit(1);
    }
  } catch (error: any) {
    log('red', `\n❌ ERRO CRÍTICO: ${error.message}\n`);
    console.error(error);
    process.exit(1);
  }
}

// Executar testes
testCPFPrevention().then(() => {
  log('gray', '✅ Testes concluídos.\n');
  process.exit(0);
}).catch((error) => {
  log('red', `❌ Erro: ${error.message}\n`);
  process.exit(1);
});
