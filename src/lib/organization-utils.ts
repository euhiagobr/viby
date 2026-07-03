
const foodCategories = [
  'gastronomia',
  'restaurante',
  'café',
  'bar',
  'pub',
  'lanchonete',
  'pizzaria',
  'hamburgueria',
  'sorveteria',
  'padaria',
  'confeitaria',
  'food truck',
];

/**
 * Verifica se a categoria de uma organização está relacionada à alimentação.
 * @param category - A categoria da organização.
 * @returns {boolean} - Retorna true se a categoria for relacionada à alimentação.
 */
export const hasFoodCategory = (category: string): boolean => {
  if (!category) {
    return false;
  }
  return foodCategories.includes(category.toLowerCase());
};
