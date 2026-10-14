(() => {
  const newsFiles = Array.from({ length: 8 }, (_, index) => `Noticia(${index + 1}).md`);
  const newsDirectory = '/conteudo/noticias/';
  const pendingValue = 'PENDENTE_CONFIRMAR';
  const previewCovers = {
    'noticia-001': {
      src: '/imagens/noticias/imagem(2).jpg',
      alt: 'Grupo de atletas reunido e comemorando na pista',
      note: 'Foto de equipe do campeonato; identidades não confirmadas.'
    },
    'noticia-002': {
      src: '/imagens/noticias/imagem(3).jpg',
      alt: 'Atletas disputando uma prova de pista com barreiras ao fundo',
      note: 'Foto ilustrativa da competição; atleta não confirmado.'
    },
    'noticia-003': {
      src: '/imagens/noticias/imagem(5).jpg',
      alt: 'Atleta exibindo duas medalhas douradas na pista',
      note: 'Foto ilustrativa; identidade da atleta não confirmada.'
    },
    'noticia-004': {
      src: '/imagens/noticias/imagem(1).jpg',
      alt: 'Atletas disputando uma corrida na pista',
      note: 'Foto ilustrativa da competição; atleta não confirmado.'
    },
    'noticia-005': {
      src: '/imagens/noticias/imagem(1).jpg',
      alt: 'Atletas disputando uma corrida na pista',
      note: 'Foto ilustrativa do campeonato; atleta da marcha não identificado.'
    },
    'noticia-006': {
      src: '/imagens/noticias/imagem(4).jpg',
      alt: 'Atleta executando um salto em altura',
      note: 'Foto de salto em altura; atleta não confirmado.'
    },
    'noticia-007': {
      src: '/imagens/noticias/imagem(7).jpg',
      alt: 'Atleta executando um salto em altura',
      note: 'Foto de salto em altura; atleta não confirmado.'
    },
    'noticia-008': {
      src: '/imagens/noticias/imagem(8).jpg',
      alt: 'Atleta ao lado do placar que mostra 74,58 m',
      note: 'Imagem associada à matéria pelo placar de 74,58 m e pela legenda original.'
    }
  };
  const homeGrid = document.getElementById('homeNewsGrid');
  const homeStatus = document.getElementById('homeNewsStatus');
  const listingGrid = document.getElementById('newsListingGrid');
  const listingStatus = document.getElementById('newsListingStatus');
  const articleContent = document.getElementById('newsArticleContent');
  const articleBreadcrumb = document.getElementById('newsArticleBreadcrumb');
  const yearFilter = document.getElementById('newsYearFilter');
  const categoryFilter = document.getElementById('newsCategoryFilter');
  const searchInput = document.getElementById('newsSearch');
  const filtersForm = document.getElementById('newsFilters');

  if (!homeGrid || !homeStatus || !listingGrid || !listingStatus || !articleContent || !yearFilter || !categoryFilter || !searchInput || !filtersForm) return;

  let newsItems = [];
  let publishedNews = [];
  let unavailableCoverCount = 0;

  function parseMetadata(source, fileName) {
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error(`O arquivo ${fileName} não contém frontmatter válido.`);

    const metadata = {};
    match[1].split(/\r?\n/).forEach((line) => {
      const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!field) return;

      let value = field[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1).replace(/''/g, "'");
      }
      metadata[field[1]] = value;
    });

    const remainingContent = source.slice(match[0].length);
    const bodyHeading = remainingContent.match(/^## Corpo original\s*$/m);
    if (!bodyHeading) throw new Error(`O arquivo ${fileName} não contém a seção "Corpo original".`);
    const bodyStart = remainingContent.indexOf('\n', bodyHeading.index + bodyHeading[0].length) + 1;
    if (!bodyStart) throw new Error(`A seção "Corpo original" de ${fileName} está vazia.`);
    let body = remainingContent.slice(bodyStart);
    const nextSectionIndex = body.search(/^## /m);
    if (nextSectionIndex >= 0) body = body.slice(0, nextSectionIndex);

    return {
      ...metadata,
      content: body.trim(),
      sourceFile: fileName
    };
  }

  async function loadArticle(fileName) {
    const response = await fetch(`${newsDirectory}${encodeURIComponent(fileName)}`, {
      headers: { Accept: 'text/markdown, text/plain' }
    });
    if (!response.ok) {
      throw new Error(`Não foi possível carregar ${fileName} (HTTP ${response.status}).`);
    }
    return parseMetadata(await response.text(), fileName);
  }

  function parsePublicationDate(value) {
    const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
        return date;
      }
      return null;
    }

    const isoMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) return null;
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
      ? date
      : null;
  }

  function isReadyForPublication(item) {
    return item.status === 'published'
      && item.id
      && item.slug
      && item.title
      && item.category
      && item.category !== pendingValue
      && item.coverImage
      && item.coverImage !== pendingValue
      && item.imageAlt
      && item.imageAlt !== pendingValue
      && item.content;
  }

  async function hasAvailableCover(item) {
    const url = new URL(item.coverImage, window.location.href);
    if (url.origin !== window.location.origin) return false;

    const response = await fetch(url.href, {
      method: 'HEAD',
      credentials: 'same-origin'
    });
    return response.ok;
  }

  function sortByPublicationDate(items) {
    return [...items].sort((left, right) => {
      const leftDate = parsePublicationDate(left.publishedAt);
      const rightDate = parsePublicationDate(right.publishedAt);
      if (leftDate && rightDate) return rightDate - leftDate;
      if (leftDate) return -1;
      if (rightDate) return 1;
      return left.title.localeCompare(right.title, 'pt-BR');
    });
  }

  function makeSlugHref(slug) {
    return `#noticia/${encodeURIComponent(slug)}`;
  }

  function appendInlineText(parent, text) {
    const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
    let currentIndex = 0;
    let token;

    while ((token = tokenPattern.exec(text))) {
      if (token.index > currentIndex) {
        parent.append(document.createTextNode(text.slice(currentIndex, token.index)));
      }

      const value = token[0];
      let element;
      if (value.startsWith('**') || value.startsWith('__')) {
        element = document.createElement('strong');
        element.textContent = value.slice(2, -2);
      } else if (value.startsWith('*') || value.startsWith('_')) {
        element = document.createElement('em');
        element.textContent = value.slice(1, -1);
      } else {
        const link = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        let safeUrl;
        try {
          const parsedUrl = new URL(link[2], window.location.origin);
          if (['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) safeUrl = link[2];
        } catch {
          safeUrl = null;
        }

        if (safeUrl) {
          element = document.createElement('a');
          element.href = safeUrl;
          element.textContent = link[1];
        } else {
          element = document.createTextNode(value);
        }
      }

      parent.append(element);
      currentIndex = token.index + value.length;
    }

    if (currentIndex < text.length) {
      parent.append(document.createTextNode(text.slice(currentIndex)));
    }
  }

  function renderArticleBody(container, markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let paragraph = [];
    let list = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      const element = document.createElement('p');
      appendInlineText(element, paragraph.join(' ').trim());
      container.append(element);
      paragraph = [];
    }

    function flushList() {
      if (list) container.append(list);
      list = null;
    }

    lines.forEach((line) => {
      const heading = line.match(/^(#{2,4})\s+(.+)$/);
      const quote = line.match(/^>\s?(.*)$/);
      const item = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/);

      if (!line.trim()) {
        flushParagraph();
        flushList();
        return;
      }

      if (heading) {
        flushParagraph();
        flushList();
        const element = document.createElement(heading[1].length === 2 ? 'h2' : 'h3');
        appendInlineText(element, heading[2]);
        container.append(element);
        return;
      }

      if (quote) {
        flushParagraph();
        flushList();
        const blockquote = document.createElement('blockquote');
        const element = document.createElement('p');
        appendInlineText(element, quote[1]);
        blockquote.append(element);
        container.append(blockquote);
        return;
      }

      if (item) {
        flushParagraph();
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        if (!list || list.tagName !== (ordered ? 'OL' : 'UL')) {
          flushList();
          list = document.createElement(ordered ? 'ol' : 'ul');
        }
        const element = document.createElement('li');
        appendInlineText(element, item[1]);
        list.append(element);
        return;
      }

      flushList();
      paragraph.push(line.trim());
    });

    flushParagraph();
    flushList();
  }

  function makeMeta(item) {
    const metadata = document.createElement('div');
    metadata.className = 'news-card__meta';

    const dateValue = parsePublicationDate(item.publishedAt);
    if (dateValue) {
      const time = document.createElement('time');
      time.dateTime = dateValue.toISOString().slice(0, 10);
      time.textContent = item.publishedAt;
      metadata.append(time);
    }

    if (item.category && item.category !== pendingValue) {
      const category = document.createElement('span');
      category.textContent = item.category;
      metadata.append(category);
    }

    return metadata;
  }

  function makeNewsCard(item, preview = false) {
    const article = document.createElement('article');
    article.className = 'news-story-card';

    const cardContent = document.createElement(preview ? 'div' : 'a');
    cardContent.className = 'news-story-card__link';
    if (preview) {
      cardContent.classList.add('news-story-card__link--preview');
    } else {
      cardContent.href = makeSlugHref(item.slug);
      cardContent.setAttribute('aria-label', `Ler notícia: ${item.title}`);
    }

    const previewCover = preview ? previewCovers[item.id] : null;
    if (!preview || previewCover) {
      const image = document.createElement('img');
      image.className = 'news-story-card__image';
      image.src = previewCover ? previewCover.src : item.coverImage;
      image.alt = previewCover ? previewCover.alt : item.imageAlt;
      image.loading = preview ? 'eager' : 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        const notice = document.createElement('span');
        notice.className = 'news-story-card__image-error';
        notice.textContent = 'Imagem indisponível';
        cardContent.prepend(notice);
      }, { once: true });
      cardContent.append(image);
      if (preview && previewCover) {
        const imageNote = document.createElement('span');
        imageNote.className = 'news-story-card__image-note';
        imageNote.textContent = previewCover.note;
        cardContent.append(imageNote);
      }
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'news-story-card__image-placeholder';
      placeholder.textContent = 'Imagem em revisão';
      placeholder.setAttribute('aria-label', 'Imagem ainda sem associação confirmada');
      cardContent.append(placeholder);
    }

    const body = document.createElement('div');
    body.className = 'news-story-card__body';
    if (preview) {
      const status = document.createElement('span');
      status.className = 'news-story-card__review-status';
      status.textContent = 'Em revisão editorial';
      body.append(status);
    }
    body.append(makeMeta(item));

    const title = document.createElement('h3');
    title.textContent = item.title;
    body.append(title);

    const excerpt = document.createElement('p');
    const originalExcerpt = item.excerpt || '';
    const firstParagraph = item.content
      .replace(/<!--[\s\S]*?-->/g, '')
      .split(/\r?\n\s*\r?\n/)
      .map((paragraph) => paragraph.trim())
      .find((paragraph) => paragraph && !/^#{1,6}\s/.test(paragraph)) || '';
    const summary = !originalExcerpt || /POSTADO EM:/i.test(originalExcerpt)
      ? firstParagraph
      : originalExcerpt;
    excerpt.textContent = summary;
    body.append(excerpt);

    cardContent.append(body);
    article.append(cardContent);
    return article;
  }

  function appendCards(grid, items, previewDrafts = false) {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.append(makeNewsCard(item, previewDrafts && item.status === 'draft')));
    grid.replaceChildren(fragment);
  }

  function setStatus(element, message, state = '') {
    element.textContent = message;
    element.hidden = !message;
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }

  function populateFilters() {
    const years = new Set();
    const categories = new Set();
    publishedNews.forEach((item) => {
      const date = parsePublicationDate(item.publishedAt);
      if (date) years.add(String(date.getUTCFullYear()));
      categories.add(item.category);
    });

    [...years].sort((left, right) => Number(right) - Number(left)).forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilter.append(option);
    });
    [...categories].sort((left, right) => left.localeCompare(right, 'pt-BR')).forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.append(option);
    });
  }

  function renderHome() {
    const messages = [];
    const homeItems = sortByPublicationDate(newsItems.filter((item) => (
      item.status === 'draft' || publishedNews.some((publishedItem) => publishedItem.id === item.id)
    ))).slice(0, 8);

    if (unavailableCoverCount) {
      messages.push(`${unavailableCoverCount} notícia(s) aprovada(s) foram ocultadas porque a imagem de capa está indisponível.`);
    }
    const draftCount = homeItems.filter((item) => item.status === 'draft').length;
    if (draftCount) {
      messages.push(`${draftCount} notícia(s) são prévias em revisão editorial; rascunhos não representam publicações confirmadas.`);
    }
    if (!homeItems.length) {
      homeGrid.replaceChildren();
      messages.push('Não há notícias disponíveis para exibição no momento.');
      setStatus(homeStatus, messages.join(' '));
      return;
    }

    setStatus(homeStatus, messages.join(' '));
    appendCards(homeGrid, homeItems, true);
  }

  function renderListing() {
    const query = normalizeText(searchInput.value);
    const year = yearFilter.value;
    const category = categoryFilter.value;
    const matchesFilters = (item) => {
      const date = parsePublicationDate(item.publishedAt);
      if (year && (!date || String(date.getUTCFullYear()) !== year)) return false;
      if (category && (item.category === pendingValue || item.category !== category)) return false;
      if (!query) return true;

      const searchableText = normalizeText([
        item.title,
        item.excerpt,
        item.category,
        item.author,
        item.content
      ].join(' '));
      return searchableText.includes(query);
    };
    const results = sortByPublicationDate([
      ...publishedNews.filter(matchesFilters),
      ...newsItems.filter((item) => item.status === 'draft' && matchesFilters(item))
    ]);
    const draftCount = results.filter((item) => item.status === 'draft').length;

    appendCards(listingGrid, results, true);
    if (results.length) {
      const messages = [];
      if (draftCount) {
        messages.push(`${draftCount} prévia(s) em revisão editorial; essas matérias não são publicações confirmadas.`);
      }
      if (unavailableCoverCount) {
        messages.push(`${unavailableCoverCount} notícia(s) aprovada(s) foram ocultadas porque a imagem de capa está indisponível.`);
      }
      setStatus(listingStatus, messages.join(' '));
    } else if (!publishedNews.length && !query && !year && !category) {
      const reviewMessage = newsItems.some((item) => item.status === 'draft')
        ? 'As matérias disponíveis seguem em revisão editorial.'
        : 'Não há notícias publicadas no momento.';
      const coverMessage = unavailableCoverCount
        ? `${unavailableCoverCount} notícia(s) aprovada(s) foram ocultadas porque a imagem de capa está indisponível.`
        : '';
      setStatus(listingStatus, [coverMessage, reviewMessage].filter(Boolean).join(' '));
    } else {
      setStatus(listingStatus, 'Nenhuma notícia encontrada para os filtros selecionados.');
    }
  }

  function makeSidebarLink(item) {
    const link = document.createElement('a');
    link.className = 'news-article__related-link';
    link.href = makeSlugHref(item.slug);

    const date = document.createElement('span');
    date.className = 'news-article__related-date';
    date.textContent = item.publishedAt || '';

    const title = document.createElement('span');
    title.className = 'news-article__related-title';
    title.textContent = item.title;

    link.append(date, title);
    return link;
  }

  function renderArticle() {
    const routePart = window.location.hash.slice(1).split('/').slice(1).join('/');
    let slug;
    try {
      slug = decodeURIComponent(routePart);
    } catch {
      slug = '';
    }

    const item = publishedNews.find((news) => news.slug === slug);
    articleContent.replaceChildren();

    if (!item) {
      const status = document.createElement('p');
      status.className = 'news-article__status';
      status.setAttribute('role', 'status');
      status.textContent = 'Esta notícia não está disponível ou ainda não foi publicada.';
      articleContent.append(status);
      articleContent.setAttribute('aria-busy', 'false');
      if (articleBreadcrumb) articleBreadcrumb.textContent = 'Notícia indisponível';
      return;
    }

    if (articleBreadcrumb) articleBreadcrumb.textContent = item.title;
    const layout = document.createElement('div');
    layout.className = 'news-article-layout__grid';

    const article = document.createElement('article');
    article.className = 'news-article';
    const header = document.createElement('header');
    header.className = 'news-article__header';
    const meta = makeMeta(item);
    meta.classList.add('news-article__meta');
    header.append(meta);

    const title = document.createElement('h1');
    title.textContent = item.title;
    header.append(title);

    if (item.author && item.author !== pendingValue) {
      const author = document.createElement('p');
      author.className = 'news-article__author';
      author.textContent = `Por ${item.author}`;
      header.append(author);
    }

    const figure = document.createElement('figure');
    figure.className = 'news-article__figure';
    const image = document.createElement('img');
    image.src = item.coverImage;
    image.alt = item.imageAlt;
    image.addEventListener('error', () => {
      image.hidden = true;
      const error = document.createElement('p');
      error.className = 'news-article__image-error';
      error.textContent = 'Não foi possível carregar a imagem desta notícia.';
      figure.prepend(error);
    }, { once: true });
    figure.append(image);

    if (item.imageCaption || item.imageCredit) {
      const caption = document.createElement('figcaption');
      if (item.imageCaption) {
        const captionText = document.createElement('span');
        captionText.textContent = item.imageCaption;
        caption.append(captionText);
      }
      if (item.imageCredit) {
        const credit = document.createElement('span');
        credit.className = 'news-article__credit';
        credit.textContent = `Foto: ${item.imageCredit}`;
        caption.append(credit);
      }
      figure.append(caption);
    }

    const content = document.createElement('div');
    content.className = 'news-article__content';
    renderArticleBody(content, item.content);
    article.append(header, figure, content);

    const sidebar = document.createElement('aside');
    sidebar.className = 'news-article__sidebar';
    sidebar.setAttribute('aria-labelledby', 'related-news-title');
    const sidebarTitle = document.createElement('h2');
    sidebarTitle.id = 'related-news-title';
    sidebarTitle.textContent = 'Outras notícias';
    sidebar.append(sidebarTitle);

    const related = publishedNews.filter((news) => news.id !== item.id);
    if (related.length) {
      related.slice(0, 5).forEach((news) => sidebar.append(makeSidebarLink(news)));
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'Não há outras notícias publicadas.';
      sidebar.append(empty);
    }

    const backLink = document.createElement('a');
    backLink.className = 'news-article__back-link';
    backLink.href = '#noticias';
    backLink.textContent = 'Voltar para todas as notícias';
    sidebar.append(backLink);

    layout.append(article, sidebar);
    articleContent.append(layout);
    articleContent.setAttribute('aria-busy', 'false');
  }

  async function initialize() {
    try {
      newsItems = await Promise.all(newsFiles.map(loadArticle));
      const candidates = newsItems.filter(isReadyForPublication);
      const coverResults = await Promise.all(candidates.map(async (item) => {
        try {
          if (await hasAvailableCover(item)) return true;
          throw new Error(`A imagem de capa não está disponível: ${item.coverImage}`);
        } catch (error) {
          console.error(`Notícia ${item.id} ocultada por erro na imagem de capa.`, error);
          return false;
        }
      }));
      unavailableCoverCount = coverResults.filter((available) => !available).length;
      publishedNews = sortByPublicationDate(candidates.filter((_, index) => coverResults[index]));
      populateFilters();
      renderHome();
      renderListing();
      homeGrid.setAttribute('aria-busy', 'false');
      listingGrid.setAttribute('aria-busy', 'false');
    } catch (error) {
      console.error('Falha ao carregar as notícias.', error);
      setStatus(homeStatus, 'Não foi possível carregar as notícias. Tente novamente mais tarde.', 'error');
      setStatus(listingStatus, 'Não foi possível carregar as notícias. Tente novamente mais tarde.', 'error');
      homeGrid.setAttribute('aria-busy', 'false');
      listingGrid.setAttribute('aria-busy', 'false');
      if (window.location.hash.startsWith('#noticia/')) {
        articleContent.replaceChildren();
        const status = document.createElement('p');
        status.className = 'news-article__status';
        status.setAttribute('role', 'alert');
        status.textContent = 'Não foi possível carregar esta notícia. Tente novamente mais tarde.';
        articleContent.append(status);
        articleContent.setAttribute('aria-busy', 'false');
      }
    }

    if (window.location.hash.startsWith('#noticia/')) renderArticle();
  }

  filtersForm.addEventListener('submit', (event) => event.preventDefault());
  filtersForm.addEventListener('input', renderListing);
  filtersForm.addEventListener('change', renderListing);
  window.addEventListener('hashchange', () => {
    if (window.location.hash.startsWith('#noticia/')) renderArticle();
  });

  if (articleContent) articleContent.setAttribute('aria-busy', 'true');
  initialize();
})();
