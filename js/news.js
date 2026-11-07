(() => {
  const apiBaseUrl = document.querySelector('meta[name="uca-api-base"]')?.content || 'http://127.0.0.1:3000';
  const publicSnapshot = Boolean(document.querySelector('meta[name="uca-public-data"]'));
  const newsFiles = publicSnapshot ? [] : window.NEWS_SOURCES
    ? Object.keys(window.NEWS_SOURCES)
    : Array.from({ length: 8 }, (_, index) => `Noticia(${index + 1}).md`);
  const newsDirectory = '/conteudo/noticias/';
  const newsApi = new URL('/noticias', apiBaseUrl).href;
  // A raiz do site é deduzida da posição deste script, para funcionar também em file:/// e em subpastas.
  const siteRoot = document.currentScript?.src ? new URL('../', document.currentScript.src) : new URL('./', window.location.href);
  const resolveAsset = (path) => /^data:image\//i.test(String(path))
    ? String(path)
    : new URL(String(path).replace(/^\/+/, ''), siteRoot).href;
  const pendingValue = 'PENDENTE_CONFIRMAR';
  const newsRegistrationForm = document.getElementById('newsRegistrationForm');
  const newsRegistrationStatus = document.getElementById('newsRegistrationStatus');
  const newsImageInput = document.getElementById('newsImage');
  const newsImageCaption = document.getElementById('newsImageCaption');
  const newsImagePreview = document.getElementById('newsImagePreview');
  const newsImagePreviewImage = document.getElementById('newsImagePreviewImage');
  const newsPublicationDate = document.getElementById('newsPublicationDate');
  const newsTitleInput = document.getElementById('newsTitle');
  const newsContentInput = document.getElementById('newsContent');
  const imageUploadLabel = document.querySelector('[data-news-upload-label]');
  const previewCovers = {
    'noticia-001': {
      src: '/imagens/noticias/imagem(1).jpg',
      alt: 'Equipe reunida e comemorando na pista',
      note: 'Foto de equipe; atletas não identificados individualmente.'
    },
    'noticia-002': {
      src: '/imagens/noticias/imagem(2).jpg',
      alt: 'Atletas disputam prova de pista com barreiras',
      note: 'Foto da prova; atletas não identificados individualmente.'
    },
    'noticia-003': {
      src: '/imagens/noticias/imagem(3).jpg',
      alt: 'Atleta exibe duas medalhas douradas na pista',
      note: 'Foto de atleta medalhista; identidade não confirmada.'
    },
    'noticia-004': {
      src: '/imagens/noticias/imagem(4).jpg',
      alt: 'Atleta de camisa verde corre na pista',
      note: 'Foto de corrida; atleta não identificado individualmente.'
    },
    'noticia-005': {
      src: '/imagens/noticias/imagem(5).jpg',
      alt: 'Atleta de camisa preta corre na pista',
      note: 'Foto ilustrativa de atletismo; não representa necessariamente a prova da matéria.'
    },
    'noticia-006': {
      src: '/imagens/noticias/imagem(6).jpg',
      alt: 'Atleta executa um salto em altura',
      note: 'Foto da prova; atleta não identificado individualmente.'
    },
    'noticia-007': {
      src: '/imagens/noticias/imagem(7).jpg',
      alt: 'Atleta executa um salto em altura',
      note: 'Foto da prova; atleta não identificado individualmente.'
    }
  };
  const homeGrid = document.getElementById('homeNewsGrid');
  const homeStatus = document.getElementById('homeNewsStatus');
  const homeIntro = homeGrid?.closest('.news-section')?.querySelector('.news-section__intro');
  const listingGrid = document.getElementById('newsListingGrid');
  const listingStatus = document.getElementById('newsListingStatus');
  const articleContent = document.getElementById('newsArticleContent');
  const articleBreadcrumb = document.getElementById('newsArticleBreadcrumb');
  const yearFilter = document.getElementById('newsYearFilter');
  const categoryFilter = document.getElementById('newsCategoryFilter');
  const searchInput = document.getElementById('newsSearch');
  const filtersForm = document.getElementById('newsFilters');

  if (!homeGrid || !homeStatus || !homeIntro || !listingGrid || !listingStatus || !articleContent || !yearFilter || !categoryFilter || !searchInput || !filtersForm) return;

  let newsItems = [];
  let publishedNews = [];
  let unavailableCoverCount = 0;
  let selectedImageData = '';

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
    // news-data.js embute as matérias para que o site funcione ao abrir o index.html direto (file:///).
    const embedded = window.NEWS_SOURCES?.[fileName];
    if (typeof embedded === 'string') return parseMetadata(embedded, fileName);

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

  function getTodayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatPublicationDate(value) {
    const date = parsePublicationDate(value);
    return date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : value;
  }

  function isPubliclyAvailable(item) {
    if (item.status === 'published') return true;
    if (item.status !== 'scheduled') return false;

    const date = parsePublicationDate(item.publishedAt);
    return Boolean(date && date.toISOString().slice(0, 10) <= getTodayIsoDate());
  }

  function isReadyForPublication(item) {
    return ['published', 'scheduled'].includes(item.status)
      && item.id
      && item.slug
      && item.title
      && item.category
      && item.category !== pendingValue
      && parsePublicationDate(item.publishedAt)
      && item.content;
  }

  function getCover(item, showPreview = true) {
    const preview = showPreview && item.status === 'draft' ? previewCovers[item.id] : null;
    const image = preview?.src || (item.coverImage && item.coverImage !== pendingValue ? item.coverImage : '');
    return { preview, image };
  }

  function getSummary(item) {
    const excerpt = item.excerpt || '';
    if (excerpt && !/POSTADO EM:/i.test(excerpt)) return excerpt;

    return item.content
      .replace(/<!--[\s\S]*?-->/g, '')
      .split(/\r?\n\s*\r?\n/)
      .map((paragraph) => paragraph.trim())
      .find((paragraph) => paragraph && !/^#{1,6}\s/.test(paragraph)) || '';
  }

  function hasAvailableCover(item) {
    if (!item.coverImage || item.coverImage === pendingValue) return Promise.resolve(true);
    const url = new URL(resolveAsset(item.coverImage));
    if (url.protocol !== 'data:' && url.origin !== siteRoot.origin) return Promise.resolve(false);

    return new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = url.href;
    });
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

  function makeSlugHref(slug, id) {
    return `#noticia/${encodeURIComponent(slug)}?id=${encodeURIComponent(id)}`;
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
          const parsedUrl = new URL(link[2], window.location.href);
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

  function makeMeta(item, card = false) {
    const metadata = document.createElement('div');
    metadata.className = 'news-card__meta';

    const dateValue = parsePublicationDate(item.publishedAt);
    if (dateValue) {
      const time = document.createElement('time');
      time.dateTime = dateValue.toISOString().slice(0, 10);
      time.textContent = formatPublicationDate(item.publishedAt);
      metadata.append(time);
    }

    if (item.category && item.category !== pendingValue) {
      const category = document.createElement('span');
      if (card) category.className = 'news-story-card__badge news-story-card__category';
      category.textContent = item.category;
      metadata.append(category);
    }

    return metadata;
  }

  function makeNewsCard(item, preview = false) {
    const article = document.createElement('article');
    article.className = 'news-story-card';

    const cardContent = document.createElement('a');
    cardContent.className = 'news-story-card__link';
    if (preview) {
      cardContent.classList.add('news-story-card__link--preview');
    }
    cardContent.href = makeSlugHref(item.slug, item.id);
    cardContent.setAttribute('aria-label', `Ler notícia: ${item.title}`);

    const { preview: previewCover, image: coverImage } = getCover(item, preview);
    if (coverImage) {
      const media = document.createElement('div');
      media.className = 'news-story-card__media';
      const image = document.createElement('img');
      image.className = 'news-story-card__image';
      image.src = resolveAsset(coverImage);
      image.alt = previewCover?.alt || (item.imageAlt && item.imageAlt !== pendingValue ? item.imageAlt : '');
      image.loading = preview ? 'eager' : 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        const notice = document.createElement('span');
        notice.className = 'news-story-card__image-error';
        notice.textContent = 'Imagem indisponível';
        cardContent.prepend(notice);
      }, { once: true });
      media.append(image);
      cardContent.append(media);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'news-story-card__image-placeholder';
      placeholder.textContent = item.status === 'draft' ? 'Imagem não confirmada' : 'Sem imagem de destaque';
      placeholder.setAttribute('aria-label', item.status === 'draft'
        ? 'Imagem de capa ainda não confirmada para esta notícia'
        : 'Esta notícia não possui imagem de destaque');
      cardContent.append(placeholder);
    }
    const imageCaption = previewCover?.note || (item.imageCaption && item.imageCaption !== pendingValue ? item.imageCaption : '');
    if (imageCaption) {
      const imageNote = document.createElement('span');
      imageNote.className = 'news-story-card__caption';
      imageNote.textContent = imageCaption;
      cardContent.append(imageNote);
    }

    const body = document.createElement('div');
    body.className = 'news-story-card__body';
    if (preview) {
      const status = document.createElement('span');
      status.className = 'news-story-card__badge news-story-card__review-status';
      status.textContent = 'Em revisão editorial';
      body.append(status);
    }
    body.append(makeMeta(item, true));

    const title = document.createElement('h3');
    title.textContent = item.title;
    body.append(title);

    const excerpt = document.createElement('p');
    excerpt.textContent = getSummary(item);
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

  function setNewsRegistrationStatus(message, state = '') {
    if (newsRegistrationStatus) setStatus(newsRegistrationStatus, message, state);
  }

  async function loadStoredNews() {
    if (!window.UcaAdminAuth) throw new Error('O módulo de autenticação administrativa não está disponível.');
    const response = await window.UcaAdminAuth.request(newsApi, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Não foi possível carregar as notícias cadastradas (HTTP ${response.status}).`);
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error('A resposta do serviço de notícias está em formato inválido.');
    return records;
  }

  function clearImageSelection() {
    selectedImageData = '';
    if (newsImageInput) newsImageInput.value = '';
    if (newsImagePreviewImage) newsImagePreviewImage.removeAttribute('src');
    if (newsImagePreview) newsImagePreview.hidden = true;
    if (imageUploadLabel) imageUploadLabel.textContent = 'Adicionar imagem';
  }

  function readImageFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeByExtension = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp'
    };
    const expectedMime = mimeByExtension[extension];

    if (!expectedMime || (file.type && file.type !== expectedMime)) {
      return Promise.reject(new Error('Formato inválido. Selecione uma imagem JPG, PNG ou WEBP.'));
    }
    if (file.size > 2 * 1024 * 1024) {
      return Promise.reject(new Error('A imagem deve ter no máximo 2 MB.'));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('error', () => reject(new Error('Não foi possível ler o arquivo de imagem.')));
      reader.addEventListener('load', () => {
        const result = String(reader.result || '');
        const base64 = result.slice(result.indexOf(',') + 1);
        const imageData = `data:${expectedMime};base64,${base64}`;
        newsImagePreviewImage.onload = () => {
          selectedImageData = imageData;
          newsImagePreview.hidden = false;
          if (imageUploadLabel) imageUploadLabel.textContent = 'Substituir imagem';
          resolve();
        };
        newsImagePreviewImage.onerror = () => reject(new Error('O arquivo selecionado não contém uma imagem válida.'));
        newsImagePreviewImage.src = imageData;
      });
      reader.readAsDataURL(file);
    });
  }

  function createNewsId() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `news-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function makeNewsSlug(title, id) {
    const slug = window.UCAUtils.normalizeText(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70);
    return `${slug || 'noticia'}-${id.slice(0, 8)}`;
  }

  async function saveNewsRecord(article) {
    let response;
    try {
      if (!window.UcaAdminAuth) throw new Error('O módulo de autenticação administrativa não está disponível.');
      response = await window.UcaAdminAuth.request(newsApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(article)
      });
    } catch {
      throw new Error('Não foi possível conectar ao serviço de notícias. Verifique se o backend está em execução e tente novamente.');
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('O serviço de notícias retornou uma resposta inválida.');
    }
    if (!response.ok) {
      throw new Error(result.message || `Não foi possível salvar a notícia (HTTP ${response.status}).`);
    }
    return result;
  }

  if (newsPublicationDate) newsPublicationDate.value = getTodayIsoDate();

  newsImageInput?.addEventListener('change', async () => {
    const file = newsImageInput.files?.[0];
    if (!file) return;

    try {
      await readImageFile(file);
      setNewsRegistrationStatus('', '');
    } catch (error) {
      clearImageSelection();
      setNewsRegistrationStatus(error.message, 'error');
    }
  });

  document.querySelector('[data-news-remove-image]')?.addEventListener('click', () => {
    clearImageSelection();
    setNewsRegistrationStatus('Imagem removida. A notícia será publicada sem imagem.');
  });

  newsRegistrationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = newsTitleInput.value.trim();
    const content = newsContentInput.value.trim();
    if (!title || !content) {
      setNewsRegistrationStatus('Informe o título e o conteúdo da notícia.', 'error');
      (!title ? newsTitleInput : newsContentInput).focus();
      return;
    }

    const id = createNewsId();
    const publishedAt = newsPublicationDate.value;
    if (!parsePublicationDate(publishedAt)) {
      setNewsRegistrationStatus('Informe uma data de publicação válida.', 'error');
      newsPublicationDate.focus();
      return;
    }

    const article = {
      id,
      slug: makeNewsSlug(title, id),
      title,
      excerpt: content.replace(/\s+/g, ' ').slice(0, 240),
      publishedAt,
      category: newsRegistrationForm.elements.namedItem('category').value,
      author: 'UCA Master',
      coverImage: selectedImageData,
      imageAlt: selectedImageData ? title : '',
      imageCaption: newsImageCaption.value.trim(),
      imageCredit: '',
      content,
      status: publishedAt > getTodayIsoDate() ? 'scheduled' : 'published'
    };
    const submitButton = newsRegistrationForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    setNewsRegistrationStatus('Salvando notícia...');

    try {
      const savedArticle = await saveNewsRecord(article);
      newsItems.push(savedArticle);
      if (isPubliclyAvailable(savedArticle)) publishedNews = sortByPublicationDate([...publishedNews, savedArticle]);
      populateFilters();
      renderHome();
      renderListing();
      homeGrid.setAttribute('aria-busy', 'false');
      listingGrid.setAttribute('aria-busy', 'false');
      const isScheduled = savedArticle.status === 'scheduled';
      setNewsRegistrationStatus(
        isScheduled
          ? `Notícia agendada para ${formatPublicationDate(savedArticle.publishedAt)}. Ela será exibida publicamente na data definida.`
          : 'Notícia publicada e adicionada ao Blog Últimas Notícias.'
      );
      if (!isScheduled) {
        const articleLink = document.createElement('a');
        articleLink.href = makeSlugHref(savedArticle.slug, savedArticle.id);
        articleLink.textContent = ' Ver notícia completa.';
        newsRegistrationStatus.append(articleLink);
      }
      newsRegistrationForm.reset();
      if (newsPublicationDate) newsPublicationDate.value = getTodayIsoDate();
      clearImageSelection();
    } catch (error) {
      console.error('Falha ao cadastrar a notícia.', error);
      setNewsRegistrationStatus(error.message || 'Não foi possível salvar a notícia. Tente novamente.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  const normalizeText = window.UCAUtils.normalizeText;

  function populateFilters() {
    const years = new Set();
    const categories = new Set();
    yearFilter.replaceChildren(new Option('Todos os anos', ''));
    categoryFilter.replaceChildren(new Option('Todas as categorias', ''));
    newsItems.filter((item) => item.status === 'draft' || isPubliclyAvailable(item)).forEach((item) => {
      const date = parsePublicationDate(item.publishedAt);
      if (date) years.add(String(date.getUTCFullYear()));
      if (item.category && item.category !== pendingValue) categories.add(item.category);
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
      homeIntro.textContent = `Fique por dentro das nossas novidades e histórias emocionantes, ${draftCount} notícia(s) são prévias em revisão editorial; rascunhos não representam publicações confirmadas.`;
    } else {
      homeIntro.textContent = 'Fique por dentro das nossas novidades e histórias emocionantes.';
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
    link.href = makeSlugHref(item.slug, item.id);

    const { image: coverImage } = getCover(item);
    if (coverImage) {
      const image = document.createElement('img');
      image.className = 'news-article__related-image';
      image.src = resolveAsset(coverImage);
      image.alt = '';
      image.loading = 'lazy';
      link.append(image);
    }

    const details = document.createElement('span');
    details.className = 'news-article__related-details';
    const metadata = document.createElement('span');
    metadata.className = 'news-article__related-meta';

    if (item.publishedAt && item.publishedAt !== pendingValue) {
      const date = document.createElement('span');
      date.className = 'news-article__related-date';
      date.textContent = formatPublicationDate(item.publishedAt);
      metadata.append(date);
    }
    if (item.category && item.category !== pendingValue) {
      const category = document.createElement('span');
      category.className = 'news-article__related-category';
      category.textContent = item.category;
      metadata.append(category);
    }
    if (item.status === 'draft') {
      const status = document.createElement('span');
      status.className = 'news-article__related-status';
      status.textContent = 'Em revisão editorial';
      metadata.append(status);
    }
    if (metadata.childElementCount) details.append(metadata);

    const title = document.createElement('span');
    title.className = 'news-article__related-title';
    title.textContent = item.title;
    details.append(title);

    const summary = getSummary(item);
    if (summary) {
      const excerpt = document.createElement('span');
      excerpt.className = 'news-article__related-excerpt';
      excerpt.textContent = summary;
      details.append(excerpt);
    }
    link.append(details);
    return link;
  }

  function renderArticle() {
    const [routePart, query = ''] = window.location.hash.slice(1).split('?');
    const slugPart = routePart.split('/').slice(1).join('/');
    let slug;
    try {
      slug = decodeURIComponent(slugPart);
    } catch {
      slug = '';
    }

    const itemId = new URLSearchParams(query).get('id');
    const item = (itemId
      ? newsItems.find((news) => news.id === itemId && (news.status === 'draft' || isPubliclyAvailable(news)))
      : null)
      || publishedNews.find((news) => news.slug === slug)
      || newsItems.find((news) => news.slug === slug && news.status === 'draft');
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

    if (item.status === 'draft') {
      const reviewStatus = document.createElement('p');
      reviewStatus.className = 'news-article__review-status';
      reviewStatus.setAttribute('role', 'status');
      reviewStatus.textContent = 'Prévia em revisão editorial — esta matéria ainda não foi publicada.';
      header.append(reviewStatus);
    }

    if (item.author && item.author !== pendingValue) {
      const author = document.createElement('p');
      author.className = 'news-article__author';
      author.textContent = `Por ${item.author}`;
      header.append(author);
    }

    const figure = document.createElement('figure');
    figure.className = 'news-article__figure';
    const { preview: previewCover, image: coverImage } = getCover(item);
    if (coverImage) {
      const image = document.createElement('img');
      image.src = resolveAsset(coverImage);
      image.alt = previewCover?.alt || (item.imageAlt && item.imageAlt !== pendingValue ? item.imageAlt : '');
      image.addEventListener('error', () => {
        image.hidden = true;
        const error = document.createElement('p');
        error.className = 'news-article__image-error';
        error.textContent = 'Não foi possível carregar a imagem desta notícia.';
        figure.prepend(error);
      }, { once: true });
      figure.append(image);
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'news-story-card__image-placeholder';
      placeholder.textContent = 'Imagem de capa não disponível.';
      figure.append(placeholder);
    }

    const imageCaption = item.imageCaption !== pendingValue ? item.imageCaption : '';
    const imageCredit = item.imageCredit !== pendingValue ? item.imageCredit : '';
    if (imageCaption || imageCredit || previewCover?.note) {
      const caption = document.createElement('figcaption');
      if (previewCover?.note) {
        const captionText = document.createElement('span');
        captionText.textContent = previewCover.note;
        caption.append(captionText);
      } else if (imageCaption) {
        const captionText = document.createElement('span');
        captionText.textContent = imageCaption;
        caption.append(captionText);
      }
      if (imageCredit) {
        const credit = document.createElement('span');
        credit.className = 'news-article__credit';
        credit.textContent = `Foto: ${imageCredit}`;
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
    sidebarTitle.textContent = 'VEJA MAIS NOTICIA SOBRE:';
    sidebar.append(sidebarTitle);

    const related = sortByPublicationDate(newsItems.filter((news) => (
      news.id !== item.id
      && (news.status === 'draft' || isPubliclyAvailable(news))
      && news.id
      && news.slug
      && news.title
      && news.content
    )));
    if (related.length) {
      related.forEach((news) => sidebar.append(makeSidebarLink(news)));
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'Não há outras notícias disponíveis.';
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
      try {
        newsItems.push(...await loadStoredNews());
        setNewsRegistrationStatus('');
      } catch (error) {
        if (publicSnapshot) throw error;
        console.error('Não foi possível carregar as notícias cadastradas no serviço de armazenamento.', error);
        setNewsRegistrationStatus('O serviço de cadastro de notícias está indisponível. As notícias cadastradas podem não aparecer até a conexão ser restabelecida.', 'error');
      }
      const candidates = newsItems.filter((item) => isReadyForPublication(item) && isPubliclyAvailable(item));
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

  window.setInterval(() => {
    const newlyDue = newsItems.filter((item) => (
      item.status === 'scheduled'
      && isReadyForPublication(item)
      && isPubliclyAvailable(item)
      && !publishedNews.some((published) => published.id === item.id)
    ));
    if (!newlyDue.length) return;

    publishedNews = sortByPublicationDate([...publishedNews, ...newlyDue]);
    populateFilters();
    renderHome();
    renderListing();
    if (window.location.hash.startsWith('#noticia/')) renderArticle();
  }, 60_000);

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderListing();
  });
  filtersForm.addEventListener('input', renderListing);
  filtersForm.addEventListener('change', renderListing);
  window.addEventListener('hashchange', () => {
    if (!window.location.hash.startsWith('#noticia/')) return;
    renderArticle();
    requestAnimationFrame(() => {
      const heading = articleContent.querySelector('.news-article__header h1');
      if (!heading) return;
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    });
  });

  if (articleContent) articleContent.setAttribute('aria-busy', 'true');
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
