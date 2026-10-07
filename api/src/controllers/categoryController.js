import Part from '../models/Part.js';

export async function listCategories(_request, response, next) {
  try {
    const categories = await Part.distinct('category');
    response.json({ categories: categories.sort((first, second) => first.localeCompare(second)) });
  } catch (error) {
    next(error);
  }
}