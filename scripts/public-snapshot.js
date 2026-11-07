import { isVisibleNews, publicNews } from '../BackEnd/public-news.js';

const fields = {
  depoimentos: ['id', 'source', 'subject', 'quote', 'publicationDate'],
  competicoes: [
    'id', 'name', 'category', 'enrollmentStatus', 'expectedDate',
    'expectedEndDate', 'description', 'image'
  ]
};

export function createPublicSnapshot(database, today = new Date().toISOString().slice(0, 10)) {
  const result = {};
  for (const collection of ['depoimentos', 'competicoes', 'noticias']) {
    if (!Array.isArray(database?.[collection])) {
      throw new Error(`A coleção ${collection} deve ser uma lista no banco de dados.`);
    }
    if (database[collection].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new Error(`A coleção ${collection} contém um registro inválido.`);
    }
    result[collection] = collection === 'noticias'
      ? database[collection].filter((item) => isVisibleNews(item, today)).map(publicNews)
      : database[collection].map((item) => Object.fromEntries(
        fields[collection].filter((field) => Object.hasOwn(item, field))
          .map((field) => [field, item[field]])
      ));
  }
  return result;
}
