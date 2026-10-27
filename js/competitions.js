(() => {
  const apiBaseUrl = document.querySelector('meta[name="uca-api-base"]')?.content || 'http://127.0.0.1:3000';
  const competitionsApi = new URL('/competicoes', apiBaseUrl).href;
  const maximumImageSize = 2 * 1024 * 1024;
  const validImageTypes = new Set(['image/jpeg', 'image/png']);
  const form = document.getElementById('competitionForm');
  const formStatus = document.getElementById('competitionFormStatus');
  const managementStatus = document.getElementById('competitionManagementStatus');
  const managementList = document.getElementById('competitionManagementList');
  const imageInput = document.getElementById('competitionImage');
  const imageDropzone = document.getElementById('competitionImageDropzone');
  const imagePreviewWrap = document.getElementById('competitionImagePreviewWrap');
  const imagePreview = document.getElementById('competitionImagePreview');
  const imageUploadLabel = document.querySelector('[data-competition-upload-label]');
  const nameCount = document.getElementById('competitionNameCount');
  const descriptionCount = document.getElementById('competitionDescriptionCount');
  const submitButton = document.getElementById('competitionSubmit');
  const cancelEditButton = document.getElementById('competitionCancelEdit');
  const removeImageButton = document.getElementById('competitionRemoveImage');
  const tracks = [...document.querySelectorAll('[data-competition-track]')];
  const siteRoot = document.currentScript?.src
    ? new URL('../', document.currentScript.src)
    : new URL('./', window.location.href);
  let competitions = [];
  let editingId = null;
  let selectedImage = '';
  let imageRemoved = false;

  if (!form && tracks.length === 0) return;

  function resolveImage(source) {
    return /^data:image\//i.test(String(source))
      ? String(source)
      : new URL(String(source).replace(/^\/+/, ''), siteRoot).href;
  }

  function setStatus(element, message, state = '') {
    if (!element) return;
    element.textContent = message;
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  async function requestApi(url, options = {}) {
    if (!window.UcaAdminAuth) throw new Error('O módulo de autenticação administrativa não está disponível.');
    const response = await window.UcaAdminAuth.request(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options
    });
    if (!response.ok) {
      let message = `A API respondeu com o status ${response.status}.`;
      try {
        const body = await response.json();
        if (body.message) message = body.message;
      } catch (error) {
        console.error('A resposta de erro da API não continha JSON válido.', error);
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  }

  function formatDate(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.toISOString().slice(0, 10) !== value) return '';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  function formatDateRange(item) {
    const start = formatDate(item.expectedDate);
    const end = formatDate(item.expectedEndDate);
    return start && end ? `${start} a ${end}` : start;
  }

  function createCalendarIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.classList.add('competition-card__calendar-icon');
    icon.innerHTML = '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    return icon;
  }

  function createCard(item) {
    const card = document.createElement('article');
    card.className = 'competition-card';

    const image = document.createElement('img');
    image.className = 'competition-card__image';
    image.src = resolveImage(item.image);
    image.alt = `Imagem da competição: ${item.name}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      const unavailable = document.createElement('div');
      unavailable.className = 'competition-card__image-placeholder';
      unavailable.setAttribute('role', 'img');
      unavailable.setAttribute('aria-label', `Imagem indisponível para ${item.name}`);
      unavailable.textContent = 'Imagem indisponível';
      image.replaceWith(unavailable);
    }, { once: true });

    const content = document.createElement('div');
    content.className = 'competition-card__content';
    const title = document.createElement('h4');
    title.className = 'competition-card__title';
    title.textContent = item.name;

    const enrollmentStatus = document.createElement('p');
    enrollmentStatus.className = `competition-card__status competition-card__status--${item.enrollmentStatus}`;
    enrollmentStatus.append(createCalendarIcon());
    const statusLabel = document.createElement('span');
    statusLabel.textContent = item.enrollmentStatus === 'open'
      ? 'Inscrições Abertas'
      : 'Inscrições Encerradas';
    enrollmentStatus.append(statusLabel);

    const date = document.createElement('p');
    date.className = 'competition-card__date';
    const dateLabel = document.createElement('span');
    dateLabel.textContent = 'Data Prevista.:';
    date.append(dateLabel);
    if (formatDate(item.expectedDate)) {
      [item.expectedDate, item.expectedEndDate].forEach((value, index) => {
        const formattedDate = formatDate(value);
        if (!formattedDate) return;
        const time = document.createElement('time');
        time.dateTime = value;
        time.textContent = formattedDate;
        date.append(document.createTextNode(index === 0 ? ' ' : ' a '), time);
      });
    }

    content.append(title, enrollmentStatus);
    if (item.description) {
      const description = document.createElement('p');
      description.className = 'competition-card__description';
      description.textContent = item.description;
      content.append(description);
    }
    content.append(date);
    card.append(image, content);
    return card;
  }

  function createManagementItem(item) {
    const row = document.createElement('article');
    row.className = 'competition-management__item';

    const image = document.createElement('img');
    image.src = resolveImage(item.image);
    image.alt = '';
    image.loading = 'lazy';

    const details = document.createElement('div');
    details.className = 'competition-management__details';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const category = document.createElement('p');
    category.textContent = `${item.category} · ${item.enrollmentStatus === 'open' ? 'Inscrições Abertas' : 'Inscrições Encerradas'}`;
    const date = formatDateRange(item);
    if (date) category.textContent += ` · ${date}`;
    details.append(title, category);
    if (item.description) {
      const description = document.createElement('p');
      description.textContent = item.description;
      details.append(description);
    }

    const actions = document.createElement('div');
    actions.className = 'competition-management__actions';
    [['edit', 'Editar'], ['delete', 'Excluir']].forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button--secondary';
      button.dataset.competitionAction = action;
      button.dataset.competitionId = String(item.id);
      button.textContent = label;
      actions.append(button);
    });
    row.append(image, details, actions);
    return row;
  }

  function visibleCards(carousel) {
    const track = carousel.querySelector('.competition-carousel__track');
    const firstCard = track?.firstElementChild;
    const viewport = carousel.querySelector('.news-carousel__viewport');
    if (!firstCard || !viewport) return 1;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const itemWidth = firstCard.getBoundingClientRect().width;
    return Math.max(1, Math.floor((viewport.clientWidth + gap) / (itemWidth + gap)));
  }

  function updateCarousel(carousel) {
    const track = carousel.querySelector('.competition-carousel__track');
    const previous = carousel.querySelector('.news-carousel__button--previous');
    const next = carousel.querySelector('.news-carousel__button--next');
    if (!track || !previous || !next) return;

    const cards = [...track.children];
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const itemWidth = cards[0]?.getBoundingClientRect().width || 0;
    const maxIndex = Math.max(0, cards.length - visibleCards(carousel));
    const index = Math.min(Number(carousel.dataset.index || 0), maxIndex);
    carousel.dataset.index = String(index);
    track.style.transform = `translateX(-${index * (itemWidth + gap)}px)`;
    previous.hidden = maxIndex === 0;
    next.hidden = maxIndex === 0;
    previous.disabled = index === 0;
    next.disabled = index === maxIndex;
  }

  function renderCarousels() {
    tracks.forEach((track) => {
      const category = track.dataset.competitionTrack;
      const entries = competitions.filter((item) => item.category === category);
      const carousel = track.closest('.competition-carousel');
      const emptyMessage = document.querySelector(`[data-competition-empty="${category}"]`);
      track.replaceChildren(...entries.map(createCard));
      if (emptyMessage) emptyMessage.hidden = entries.length > 0;
      if (carousel) {
        carousel.dataset.index = '0';
        updateCarousel(carousel);
      }
    });
  }

  function renderManagementList() {
    if (!managementList || !managementStatus) return;
    managementList.replaceChildren(...competitions.map(createManagementItem));
    setStatus(managementStatus, competitions.length
      ? `${competitions.length} competição(ões) cadastrada(s).`
      : 'Nenhuma competição cadastrada.');
  }

  async function loadCompetitions() {
    try {
      const response = await requestApi(competitionsApi);
      if (!Array.isArray(response)) throw new Error('A API retornou uma lista de competições inválida.');
      competitions = response;
      renderCarousels();
      renderManagementList();
      return true;
    } catch (error) {
      console.error('Não foi possível carregar as competições.', error);
      setStatus(managementStatus, `Não foi possível carregar as competições: ${error.message}`, 'error');
      tracks.forEach((track) => {
        const emptyMessage = document.querySelector(`[data-competition-empty="${track.dataset.competitionTrack}"]`);
        if (emptyMessage) {
          emptyMessage.textContent = 'Não foi possível carregar as competições.';
          emptyMessage.hidden = false;
        }
      });
      return false;
    }
  }

  function resetForm() {
    form.reset();
    editingId = null;
    selectedImage = '';
    imageRemoved = false;
    imageInput.required = true;
    imagePreview.removeAttribute('src');
    imagePreviewWrap.hidden = true;
    imageUploadLabel.textContent = 'Clique para selecionar uma imagem';
    submitButton.textContent = 'Salvar Competição';
    cancelEditButton.hidden = true;
    updateCounters();
    setStatus(formStatus, '');
  }

  function updateCounters() {
    nameCount.textContent = `${form.elements.namedItem('name').value.length}/100`;
    descriptionCount.textContent = `${form.elements.namedItem('description').value.length}/500`;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Não foi possível processar a imagem selecionada.'));
          return;
        }
        resolve(reader.result);
      }, { once: true });
      reader.addEventListener('error', () => reject(new Error('Não foi possível ler a imagem selecionada.')), { once: true });
      reader.readAsDataURL(file);
    });
  }

  async function loadSelectedImage(file) {
    if (!file) return;
    if (!validImageTypes.has(file.type)) {
      imageInput.value = '';
      selectedImage = '';
      setStatus(formStatus, 'Selecione uma imagem JPG ou PNG.', 'error');
      return;
    }
    if (file.size > maximumImageSize) {
      imageInput.value = '';
      selectedImage = '';
      setStatus(formStatus, 'A imagem deve ter no máximo 2 MB.', 'error');
      return;
    }
    try {
      selectedImage = await readImage(file);
      imageRemoved = false;
      imagePreview.src = selectedImage;
      imagePreviewWrap.hidden = false;
      imageInput.required = false;
      imageUploadLabel.textContent = file.name;
      setStatus(formStatus, '');
    } catch (error) {
      console.error('Não foi possível carregar a prévia da imagem.', error);
      setStatus(formStatus, error.message, 'error');
    }
  }

  imageInput?.addEventListener('change', () => loadSelectedImage(imageInput.files?.[0]));

  ['dragenter', 'dragover'].forEach((eventName) => {
    imageDropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      imageDropzone.classList.add('competition-form__dropzone--dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    imageDropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      imageDropzone.classList.remove('competition-form__dropzone--dragging');
    });
  });
  imageDropzone?.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    imageInput.files = transfer.files;
    loadSelectedImage(file);
  });

  removeImageButton?.addEventListener('click', () => {
    selectedImage = '';
    imageRemoved = editingId !== null;
    imageInput.value = '';
    imageInput.required = true;
    imagePreview.removeAttribute('src');
    imagePreviewWrap.hidden = true;
    imageUploadLabel.textContent = 'Clique para selecionar uma imagem';
    setStatus(formStatus, editingId === null ? '' : 'Selecione uma nova imagem para salvar esta competição.');
  });

  form?.elements.namedItem('name').addEventListener('input', updateCounters);
  form?.elements.namedItem('description').addEventListener('input', updateCounters);

  document.querySelectorAll('[data-competition-cancel]').forEach((link) => {
    link.addEventListener('click', resetForm);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.namedItem('name').value.trim();
    const category = form.elements.namedItem('category').value;
    const enrollmentStatus = form.elements.namedItem('enrollmentStatus').value;
    const expectedDate = form.elements.namedItem('expectedDate').value;
    const expectedEndDate = form.elements.namedItem('expectedEndDate').value;
    const description = form.elements.namedItem('description').value.trim();
    const existing = editingId === null ? null : competitions.find((item) => String(item.id) === String(editingId));
    const image = selectedImage || (!imageRemoved ? existing?.image : '') || '';
    if (!name || name.length > 100) {
      setStatus(formStatus, 'Informe o nome da competição com até 100 caracteres.', 'error');
      form.elements.namedItem('name').focus();
      return;
    }
    if (description.length > 500) {
      setStatus(formStatus, 'A descrição deve ter no máximo 500 caracteres.', 'error');
      form.elements.namedItem('description').focus();
      return;
    }
    if (Boolean(expectedDate) !== Boolean(expectedEndDate)) {
      setStatus(formStatus, 'Informe as datas inicial e final previstas da competição.', 'error');
      form.elements.namedItem(expectedDate ? 'expectedEndDate' : 'expectedDate').focus();
      return;
    }
    if (expectedDate && expectedEndDate < expectedDate) {
      setStatus(formStatus, 'A data final não pode ser anterior à data inicial.', 'error');
      form.elements.namedItem('expectedEndDate').focus();
      return;
    }
    if (!image) {
      setStatus(formStatus, 'Adicione uma imagem para a competição.', 'error');
      return;
    }

    const item = {
      id: existing?.id || (window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name,
      category,
      enrollmentStatus,
      expectedDate,
      expectedEndDate,
      description,
      image
    };
    const editing = existing !== null;
    submitButton.disabled = true;
    setStatus(formStatus, editing ? 'Salvando alterações...' : 'Cadastrando competição...');
    try {
      await requestApi(editing ? `${competitionsApi}/${encodeURIComponent(item.id)}` : competitionsApi, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(item)
      });
    } catch (error) {
      console.error('Não foi possível salvar a competição.', error);
      setStatus(formStatus, `Não foi possível salvar a competição: ${error.message}`, 'error');
      submitButton.disabled = false;
      return;
    }

    resetForm();
    setStatus(formStatus, editing ? 'Competição atualizada.' : 'Competição cadastrada.');
    submitButton.disabled = false;
    await loadCompetitions();
  });

  cancelEditButton?.addEventListener('click', resetForm);

  managementList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-competition-action]');
    if (!button) return;
    const item = competitions.find((entry) => String(entry.id) === button.dataset.competitionId);
    if (!item) return;

    if (button.dataset.competitionAction === 'edit') {
      editingId = item.id;
      form.elements.namedItem('name').value = item.name;
      form.elements.namedItem('category').value = item.category;
      form.elements.namedItem('enrollmentStatus').value = item.enrollmentStatus;
      form.elements.namedItem('expectedDate').value = item.expectedDate || '';
      form.elements.namedItem('expectedEndDate').value = item.expectedEndDate ?? item.expectedDate ?? '';
      form.elements.namedItem('description').value = item.description || '';
      imageInput.value = '';
      imageInput.required = false;
      selectedImage = '';
      imageRemoved = false;
      imagePreview.src = resolveImage(item.image);
      imagePreviewWrap.hidden = false;
      imageUploadLabel.textContent = 'Imagem atual — selecione para substituir';
      submitButton.textContent = 'Salvar alterações';
      cancelEditButton.hidden = false;
      updateCounters();
      setStatus(formStatus, `Editando: ${item.name}.`);
      form.querySelector('#competitionName').focus();
      return;
    }

    if (!window.confirm(`Excluir a competição "${item.name}"? Esta ação não pode ser desfeita.`)) return;
    button.disabled = true;
    try {
      await requestApi(`${competitionsApi}/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (String(editingId) === String(item.id)) resetForm();
      await loadCompetitions();
      setStatus(managementStatus, `Competição "${item.name}" excluída.`);
    } catch (error) {
      console.error('Não foi possível excluir a competição.', error);
      setStatus(managementStatus, `Não foi possível excluir a competição: ${error.message}`, 'error');
      button.disabled = false;
    }
  });

  document.querySelectorAll('.competition-carousel').forEach((carousel) => {
    const previous = carousel.querySelector('.news-carousel__button--previous');
    const next = carousel.querySelector('.news-carousel__button--next');
    const move = (direction) => {
      const maxIndex = Math.max(0, carousel.querySelector('.competition-carousel__track').children.length - visibleCards(carousel));
      carousel.dataset.index = String(Math.max(0, Math.min(maxIndex, Number(carousel.dataset.index || 0) + direction)));
      updateCarousel(carousel);
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' && !previous.disabled) {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'ArrowRight' && !next.disabled) {
        event.preventDefault();
        move(1);
      }
    });
    let touchStartX = null;
    carousel.querySelector('.news-carousel__viewport').addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    carousel.querySelector('.news-carousel__viewport').addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const distance = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) >= 40) move(distance < 0 ? 1 : -1);
    }, { passive: true });
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.competition-carousel').forEach(updateCarousel);
  });

  loadCompetitions();
})();
