const publicFields = [
  'id', 'slug', 'title', 'content', 'category', 'publishedAt', 'status',
  'excerpt', 'author', 'coverImage', 'imageAlt', 'imageCaption', 'imageCredit'
];

function isVisibleNews(item, today = new Date().toISOString().slice(0, 10)) {
  if (item.status === 'published') return true;
  if (item.status !== 'scheduled' || !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)) return false;
  const date = new Date(`${item.publishedAt}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === item.publishedAt
    && item.publishedAt <= today;
}

function publicNews(item) {
  return Object.fromEntries(publicFields
    .filter((field) => Object.hasOwn(item, field))
    .map((field) => [field, item[field]]));
}

module.exports = { isVisibleNews, publicNews };
