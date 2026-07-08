/**
 * @fileOverview Configuração de Feature Flags do projeto
 * Permite ativar/desativar features em runtime sem deploy
 */

export const featureFlags = {
  /**
   * Ativa novo fluxo de cadastro com suporte a identidades internacionais
   * False: Cadastro mantém compatibilidade 100% com CPF (Brasil apenas)
   * True: Mostra seletor de país e permite documentos internacionais
   * 
   * Phase 3: Feature Flag para novo cadastro
   * Rollout gradual: false → true
   */
  enableInternationalSignup: process.env.NEXT_PUBLIC_ENABLE_INTERNATIONAL_SIGNUP === 'true',
};

/**
 * Retorna valor de uma feature flag
 * @example isFeatureEnabled('enableInternationalSignup') → true/false
 */
export function isFeatureEnabled(flagName: keyof typeof featureFlags): boolean {
  return featureFlags[flagName];
}
