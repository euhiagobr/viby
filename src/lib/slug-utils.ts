/**
 * @fileOverview Utilitários para normalização de strings e geração de slugs.
 */

export function slugify(text: string): string {
  if (!text) return "";

  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/ç/g, "c")             // Substitui ç por c
    .replace(/[^a-z0-9\s]/g, "")    // Remove caracteres especiais (mantém letras, números e espaços)
    .trim()
    .replace(/\s+/g, "-")           // Substitui espaços por hífen
    .replace(/-+/g, "-")            // Remove múltiplos hífens consecutivos
    .replace(/^-+|-+$/g, "");       // Remove hífen no início ou fim
}
