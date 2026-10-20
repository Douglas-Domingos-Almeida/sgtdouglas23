const mainScriptUrl = document.currentScript.src;
const mobileVideoUrl = new URL('../Videos/Video UCA.mp4', mainScriptUrl).href;
const juntosPodemosVideoUrls = {
  velocista: new URL('../Videos/Velocista de Blumenau é dono da melhor marca do mundo na categoria master.mp4', mainScriptUrl).href,
  billCollins: new URL('../Videos/Bill Collins M65 world record in 100.mp4', mainScriptUrl).href,
  atletismoBlumenau: new URL('../Videos/Atletismo Master velocista mais rápido das Américas é de Blumenau.mp4', mainScriptUrl).href,
  arizona: new URL('../Videos/Arizona Masters Track 400M Sprinter Doug Thomson.mp4', mainScriptUrl).href,
  masterPta2022: new URL('../Videos/100m masculino cat 35 anos Master Pta 2022.mp4', mainScriptUrl).href
};
const athleteRankingApi = 'https://atletismomasters.com.br/wp-json/atletismo-rankings/v1/';
const athleteFilterFields = [
  { id: 'athlete-year', key: 'year', apiKey: 'ano' },
  { id: 'athlete-discipline', key: 'event', apiKey: 'prova' },
  { id: 'athlete-gender', key: 'gender', apiKey: 'genero' },
  { id: 'athlete-category', key: 'category', apiKey: 'categoria' }
];

function initTestimonialActions() {
  const section = document.getElementById('depoimentos');
  if (!section) return;

  const grid = section.querySelector('.testimonials-grid');
  const dialog = section.querySelector('.testimonial-editor');
  const form = dialog.querySelector('form');
  const title = dialog.querySelector('h2');
  const field = dialog.querySelector('.testimonial-editor__field');
  const subjectInput = form.elements.namedItem('subject');
  const input = dialog.querySelector('textarea');
  const confirmation = dialog.querySelector('.testimonial-editor__confirmation');
  const submit = dialog.querySelector('[type="submit"]');
  const status = section.querySelector('[role="status"]');
  let activeCard = null;
  let activeAction = '';

  grid.querySelectorAll('.testimonial-card').forEach((card, index) => {
    const actions = document.createElement('div');
    actions.className = 'testimonial-card__actions';
    [['edit', 'Editar', 'icone-editar.png'], ['delete', 'Excluir', 'icone-excluir.png']].forEach(([action, label, filename]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'testimonial-card__action';
      button.dataset.testimonialAction = action;
      button.title = `${label} depoimento`;
      button.setAttribute('aria-label', `${label} depoimento ${index + 1}`);
      const icon = document.createElement('img');
      icon.src = new URL(`../imagens/Icones/${filename}`, mainScriptUrl).href;
      icon.alt = '';
      button.append(icon);
      actions.append(button);
    });
    card.querySelector('article').append(actions);
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-testimonial-action]');
    if (!button) return;
    activeCard = button.closest('.testimonial-card');
    activeAction = button.dataset.testimonialAction;
    const editing = activeAction === 'edit';
    title.textContent = editing ? 'Editar' : 'Excluir depoimento';
    field.hidden = !editing;
    subjectInput.disabled = !editing;
    subjectInput.setCustomValidity('');
    subjectInput.value = activeCard.querySelector('.testimonial-card__name').textContent;
    input.disabled = !editing;
    input.setCustomValidity('');
    input.value = activeCard.querySelector('.testimonial-card__quote p').textContent;
    confirmation.hidden = editing;
    confirmation.textContent = `Excluir o depoimento de ${activeCard.querySelector('.testimonial-card__name').textContent}? Esta ação não pode ser desfeita.`;
    submit.textContent = editing ? 'Salvar' : 'Excluir';
    status.textContent = '';
    dialog.showModal();
    (editing ? subjectInput : dialog.querySelector('[data-testimonial-cancel]')).focus();
  });

  dialog.querySelector('[data-testimonial-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { activeCard = null; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!activeCard) return;
    if (activeAction === 'edit') {
      for (const control of [subjectInput, input]) {
        if (!control.value.trim()) {
          control.setCustomValidity('Preencha este campo.');
          control.reportValidity();
          return;
        }
      }
      activeCard.querySelector('.testimonial-card__name').textContent = subjectInput.value.trim();
      activeCard.querySelector('.testimonial-card__quote p').textContent = input.value.trim();
      dialog.close();
      status.textContent = 'Depoimento atualizado.';
    } else {
      const nextCard = activeCard.nextElementSibling || activeCard.previousElementSibling;
      activeCard.remove();
      dialog.close();
      status.textContent = grid.children.length ? 'Depoimento excluído.' : 'Nenhum depoimento disponível.';
      (nextCard?.querySelector('button') || section.querySelector('h2')).focus();
    }
  });
  [subjectInput, input].forEach((control) => {
    control.addEventListener('input', () => control.setCustomValidity(''));
  });

  const registration = document.querySelector('.testimonial-registration__form');
  if (!registration) return;
  const registrationStatus = registration.querySelector('[role="status"]');
  const publicationDate = registration.elements.namedItem('publicationDate');
  const registeredCards = new WeakSet();
  const targets = [
    ['source', '.testimonial-card__role', 'Atletismo Master'],
    ['subject', '.testimonial-card__name', 'Atleta UCA Master'],
    ['quote', '.testimonial-card__quote p', 'Depoimento em breve.']
  ];

  function updatePublicationDate() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear());
    publicationDate.defaultValue = `${day}/${month}/${year}`;
    publicationDate.value = publicationDate.defaultValue;
    return `${year}-${month}-${day}`;
  }

  updatePublicationDate();
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#cadastro-depoimento') updatePublicationDate();
  });

  registration.addEventListener('input', (event) => {
    if (event.target.matches('input, textarea')) event.target.setCustomValidity('');
    registrationStatus.textContent = '';
  });
  registration.querySelector('[data-testimonial-registration-cancel]').addEventListener('click', () => {
    registration.reset();
    targets.forEach(([name]) => registration.elements.namedItem(name).setCustomValidity(''));
    publicationDate.setCustomValidity('');
    registrationStatus.textContent = '';
    window.location.hash = 'depoimentos';
  });
  registration.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = targets.map(([name]) => registration.elements.namedItem(name).value.trim());
    const emptyIndex = values.findIndex((value) => !value);
    if (emptyIndex !== -1) {
      const emptyField = registration.elements.namedItem(targets[emptyIndex][0]);
      emptyField.setCustomValidity('Preencha este campo.');
      emptyField.reportValidity();
      return;
    }
    const isoDate = updatePublicationDate();
    const card = [...grid.querySelectorAll('.testimonial-card')].find((item) =>
      !registeredCards.has(item) && targets.every(([, selector, placeholder]) =>
        item.querySelector(selector).textContent === placeholder));
    if (!card) {
      registrationStatus.textContent = 'Não há cards disponíveis para um novo depoimento.';
      return;
    }
    values[0] = `Publicado por ${values[0]} em ${publicationDate.value}`;
    targets.forEach(([, selector], index) => { card.querySelector(selector).textContent = values[index]; });
    card.dataset.publicationDate = isoDate;
    registeredCards.add(card);
    registration.reset();
    status.textContent = 'Depoimento adicionado.';
    window.location.hash = 'depoimentos';
  });
}

function initAthleteSearch(form) {
  const results = document.getElementById('athlete-results-content');
  const status = document.getElementById('athlete-results-status');
  const complementPanel = form.parentElement.querySelector('[data-panel="complement"]');
  const complementStatus = document.getElementById('athlete-complement-status');
  const complementContent = document.getElementById('athlete-complement-content');
  const viewButtons = form.querySelectorAll('[data-panel-view]');
  const markModeButtons = form.parentElement.querySelectorAll('[data-mark-mode]');
  const filterPanel = form.parentElement.querySelector('[data-panel="filters"]');
  const rankingPanel = form.parentElement.querySelector('[data-panel="ranking"]');
  const historyPanel = form.parentElement.querySelector('[data-panel="history"]');
  const historySearch = document.getElementById('history-athlete-search');
  const historyOptions = document.getElementById('history-athlete-options');
  const historyToggle = historyPanel?.querySelector('.athlete-profile__combobox-toggle');
  const historyStatus = document.getElementById('athlete-history-status');
  const historyContent = document.getElementById('athlete-history-content');
  const historyMarkModeButtons = form.parentElement.querySelectorAll('[data-history-mark-mode]');
  const historyDownloadButton = document.getElementById('history-download-pdf');

  if (!results || !status || !complementPanel || !complementStatus || !complementContent || !filterPanel || !rankingPanel || !historyPanel || !historySearch || !historyOptions || !historyToggle || !historyStatus || !historyContent || !  historyDownloadButton) return;

  const controls = athleteFilterFields.map((field) => ({
    ...field,
    element: document.getElementById(field.id)
  }));
  let activeView = 'ranking';
  let rankingMarkMode = null;
  let marksChosen = false;
  let historyMarkMode = 'best';
  let filterRequest;
  let resultsRequest;
  const profileCard = form.parentElement;
  const complementBack = document.createElement('div');
  const historyAnchor = document.createComment('history-panel');
  historyPanel.before(historyAnchor);
  complementBack.className = 'complemento-card-back';
  profileCard.append(complementBack);
  profileCard.classList.add('complemento-card-inner');
  profileCard.parentElement.addEventListener('dblclick', (event) => {
    if (activeView !== 'complement' || event.target.closest('select, button, input, a, [role="option"]')) return;
    window.getSelection()?.removeAllRanges();
    profileCard.parentElement.classList.toggle('is-flipped');
  });
  let historyRequest;
  let historySearchRequest;
  let filterRequestVersion = 0;
  let historySuggestions = [];
  let selectedHistoryAthlete = '';
  let activeHistoryOptionIndex = -1;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

  function showError(error) {
    if (error.name === 'AbortError') return;
    const targetStatus = activeView === 'history'
      ? historyStatus
      : activeView === 'complement' ? complementStatus : status;
    const targetContent = activeView === 'history'
      ? historyContent
      : activeView === 'complement' ? complementContent : results;
    targetStatus.textContent = `Não foi possível consultar os registros de atletas. ${error.message}`;
    targetStatus.dataset.state = 'error';
    targetContent.setAttribute('aria-busy', 'false');
  }

  const filtersComplete = () => controls.every((control) => control.element?.value);
  const resultsVisible = () => marksChosen && filtersComplete();

  function setActiveView(nextView) {
    activeView = nextView;
    markModeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.markMode === rankingMarkMode));
    });
    viewButtons.forEach((button) => {
      const isActive = button.dataset.panelView === nextView;
      button.setAttribute('aria-pressed', String(isActive));
      button.classList.toggle('button--primary', isActive);
      button.classList.toggle('button--secondary', !isActive);
    });

    const filtersActive = nextView === 'ranking' || nextView === 'complement';
    filterPanel.classList.toggle('athlete-profile__panel--hidden', !filtersActive);
    filterPanel.hidden = !filtersActive;

    const showRanking = nextView === 'ranking' && resultsVisible();
    rankingPanel.classList.toggle('athlete-profile__panel--hidden', !showRanking);
    rankingPanel.hidden = !showRanking;

    const showComplement = nextView === 'complement' && resultsVisible();
    complementPanel.classList.toggle('athlete-profile__panel--hidden', !showComplement);
    complementPanel.hidden = !showComplement;
    profileCard.parentElement.classList.toggle('complemento-card', nextView === 'complement');
    if (nextView !== 'complement') profileCard.parentElement.classList.remove('is-flipped');

    const historyActive = nextView === 'history' || nextView === 'complement';
    if (nextView === 'complement') complementBack.append(historyPanel);
    else historyAnchor.after(historyPanel);
    historyPanel.classList.toggle('athlete-profile__panel--hidden', !historyActive);
    historyPanel.hidden = !historyActive;
  }

  function buildQuery({ type = 'geral', excludeKey = '', extra = {} } = {}) {
    const query = new URLSearchParams({ filter: 'brasil', type });

    controls.forEach((control) => {
      if (control.key !== excludeKey && control.element?.value) {
        query.set(control.apiKey, control.element.value);
      }
    });

    Object.entries(extra).forEach(([key, value]) => {
      if (value !== '' && value != null) query.set(key, String(value));
    });

    return query;
  }

  async function requestRanking(path, query, signal) {
    const response = await fetch(`${athleteRankingApi}${path}?${query}`, {
      signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || `A consulta falhou (HTTP ${response.status}).`);
    }
    if (!body || !Array.isArray(body.data)) {
      throw new Error('A fonte de rankings retornou dados em formato inesperado.');
    }

    return body.data;
  }

  function normalizeOptions(items, control) {
    const seen = new Set();
    return items.flatMap((item) => {
      const value = String(typeof item === 'object' && item !== null ? item.value : item);
      if (!value || seen.has(value)) return [];
      seen.add(value);
      const label = String(typeof item === 'object' && item !== null ? item.label ?? item.value : item);
      return [{
        value,
        label: control.key === 'gender'
          ? ({ M: 'Masculino', W: 'Feminino', X: 'Misto' })[value] || label
          : label,
        group: typeof item === 'object' && item !== null ? item.group : ''
      }];
    });
  }

  function renderFilterOptions(control, items) {
    const selected = control.element.value;
    const options = normalizeOptions(items, control);

    if (control.key === 'year') {
      options.sort((left, right) => Number(right.value) - Number(left.value));
    } else if (control.key === 'event') {
      const groupRank = (group) => {
        const normalizedGroup = normalize(group.replace(/-/g, ''));
        if (normalizedGroup.includes('principais')) return 0;
        if (normalizedGroup.includes('secundarias')) return 1;
        return 2;
      };
      options.sort((left, right) => groupRank(left.group) - groupRank(right.group));
    }

    const placeholder = new Option('Todos', '');
    control.element.replaceChildren(placeholder);
    const groups = new Map();

    options.forEach((option) => {
      let parent = control.element;
      if (option.group) {
        const groupLabel = option.group.replace(/^--\s*|\s*--$/g, '').trim();
        if (!groups.has(groupLabel)) {
          const group = document.createElement('optgroup');
          group.label = groupLabel;
          groups.set(groupLabel, group);
          control.element.append(group);
        }
        parent = groups.get(groupLabel);
      }

      parent.append(new Option(option.label, option.value));
    });

    control.element.value = options.some((option) => option.value === selected) ? selected : '';
    control.element.setAttribute('aria-busy', 'false');
  }

  async function refreshFilterOptions() {
    const version = ++filterRequestVersion;
    filterRequest?.abort();
    filterRequest = new AbortController();
    controls.forEach((control) => control.element.setAttribute('aria-busy', 'true'));

    try {
      const filterLists = await Promise.all(controls.map((control) => {
        const query = buildQuery({
          excludeKey: control.key,
          extra: { field: control.apiKey }
        });
        return requestRanking('filters', query, filterRequest.signal);
      }));

      if (version !== filterRequestVersion) return;
      controls.forEach((control, index) => renderFilterOptions(control, filterLists[index]));
    } catch (error) {
      if (version === filterRequestVersion) {
        controls.forEach((control) => control.element.setAttribute('aria-busy', 'false'));
      }
      throw error;
    }
  }

  function genderFromCategory(category) {
    if (category.startsWith('M')) return 'M';
    if (category.startsWith('W')) return 'W';
    if (category.startsWith('X')) return 'X';
    return '';
  }

  function synchronizeGenderAndCategory(changedKey) {
    const gender = controls.find((control) => control.key === 'gender').element;
    const category = controls.find((control) => control.key === 'category').element;
    const categoryGender = genderFromCategory(category.value);

    if (changedKey === 'category' && categoryGender) {
      gender.value = categoryGender;
    } else if (changedKey === 'gender' && categoryGender && gender.value !== categoryGender) {
      category.value = '';
    }
  }

  function genderLabel(category) {
    const prefix = genderFromCategory(category);
    return ({ M: 'Masculino', W: 'Feminino', X: 'Misto' })[prefix] || '—';
  }

  function rowMatchesFilters(row) {
    const category = String(row.ranking_category || row.category || '');
    const rowYear = String(row.year ?? row.ranking_year ?? '').match(/\d{4}/)?.[0] || '';
    const selected = Object.fromEntries(controls.map((control) => [control.key, control.element.value]));

    return (!selected.year || rowYear === selected.year)
      && (!selected.event || row.event === selected.event)
      && (!selected.gender || genderFromCategory(category) === selected.gender)
      && (!selected.category || category === selected.category);
  }

  function createTable(columns, rows, captionText, regionLabel) {
    const tableRegion = document.createElement('div');
    tableRegion.className = 'athlete-profile__table-wrap';
    tableRegion.setAttribute('role', 'region');
    tableRegion.setAttribute('aria-label', regionLabel);
    tableRegion.tabIndex = 0;

    const table = document.createElement('table');
    table.className = 'athlete-profile__table';
    const caption = document.createElement('caption');
    caption.textContent = captionText;
    table.append(caption);

    const head = document.createElement('thead');
    const headingRow = document.createElement('tr');
    columns.forEach(([label]) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      headingRow.append(cell);
    });
    head.append(headingRow);
    table.append(head);

    const body = document.createElement('tbody');
    rows.forEach((row) => {
      const tableRow = document.createElement('tr');
      columns.forEach(([, getValue]) => {
        const cell = document.createElement('td');
        cell.textContent = String(getValue(row) ?? '—') || '—';
        tableRow.append(cell);
      });
      body.append(tableRow);
    });
    table.append(body);
    tableRegion.append(table);
    return tableRegion;
  }

  function renderRankingResults(rows) {
    results.replaceChildren();
    if (!rows.length) {
      status.textContent = 'Nenhum registro encontrado para os filtros selecionados.';
      status.dataset.state = 'empty';
      results.setAttribute('aria-busy', 'false');
      return;
    }

    const columns = [
      ['ATLETA', (row) => row.athlete || row.athlete_id],
      ['NASCIMENTO / IDADE', (row) => row.birth_date],
      ['EQUIPE', (row) => row.team],
      ['GÊNERO', (row) => genderLabel(row.ranking_category || row.category || '')],
      ['CATEGORIA', (row) => row.ranking_category || row.category],
      ['PROVA', (row) => row.event],
      ['MARCA', (row) => row.mark],
      ['LOCAL', (row) => row.event_location],
      ['DATA DA COMPETIÇÃO', (row) => row.event_date]
    ];

    results.append(createTable(columns, rows, 'Marcas do ranking', 'Resultados do ranking'));
    status.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'}.`;
    status.dataset.state = 'success';
    results.setAttribute('aria-busy', 'false');
  }

  async function loadRankingResults() {
    resultsRequest?.abort();
    resultsRequest = new AbortController();
    results.replaceChildren();
    status.textContent = 'Consultando registros...';
    status.dataset.state = 'loading';
    results.setAttribute('aria-busy', 'true');

    const rows = await requestRanking(
      'results',
      buildQuery({ extra: { per_page: 1000, melhor_marca: rankingMarkMode === 'best' ? 1 : 0 } }),
      resultsRequest.signal
    );
    renderRankingResults(rows.filter(rowMatchesFilters));
  }

  function renderComplementResults(rows) {
    complementContent.replaceChildren();
    if (!rows.length) {
      complementStatus.textContent = 'Nenhuma informação complementar encontrada para os filtros selecionados.';
      complementStatus.dataset.state = 'empty';
      complementContent.setAttribute('aria-busy', 'false');
      return;
    }

    const columns = [
      ['ATLETA', (row) => row.athlete || row.athlete_id],
      ['NASCIMENTO / IDADE', (row) => row.birth_date],
      ['EQUIPE', (row) => row.team],
      ['GÊNERO', (row) => genderLabel(row.ranking_category || row.category || '')],
      ['CATEGORIA', (row) => row.ranking_category || row.category],
      ['PROVA', (row) => row.event],
      ['MARCA', (row) => row.mark],
      ['DATA DA COMPETIÇÃO', (row) => row.event_date]
    ];
    complementContent.append(createTable(columns, rows, 'Informações complementares', 'Informações complementares dos resultados'));
    complementStatus.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'}.`;
    complementStatus.dataset.state = 'success';
    complementContent.setAttribute('aria-busy', 'false');
  }

  async function loadComplementResults() {
    resultsRequest?.abort();
    resultsRequest = new AbortController();
    complementContent.replaceChildren();
    complementStatus.textContent = 'Consultando informações complementares...';
    complementStatus.dataset.state = 'loading';
    complementContent.setAttribute('aria-busy', 'true');

    const rows = await requestRanking(
      'results',
      buildQuery({ extra: { per_page: 1000, melhor_marca: rankingMarkMode === 'best' ? 1 : 0 } }),
      resultsRequest.signal
    );
    renderComplementResults(rows.filter(rowMatchesFilters));
  }

  function renderHistoryOptions(names) {
    historyOptions.replaceChildren();
    activeHistoryOptionIndex = -1;

    const addOption = (value, label) => {
      const option = document.createElement('li');
      option.className = 'athlete-profile__athlete-option';
      option.id = `history-athlete-option-${historyOptions.children.length}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.value = value;
      option.textContent = label;
      historyOptions.append(option);
    };

    names.forEach((name) => addOption(name, name));

    if (!names.length) {
      const empty = document.createElement('li');
      empty.className = 'athlete-profile__athlete-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = 'Nenhum atleta encontrado.';
      historyOptions.append(empty);
    }
  }

  function setHistoryListOpen(isOpen) {
    historyOptions.hidden = !isOpen;
    historySearch.setAttribute('aria-expanded', String(isOpen));
    historyToggle.setAttribute('aria-expanded', String(isOpen));
    historyToggle.setAttribute('aria-label', isOpen ? 'Ocultar nomes de atletas do histórico' : 'Mostrar nomes de atletas do histórico');
    if (!isOpen) historySearch.removeAttribute('aria-activedescendant');
  }

  function setActiveHistoryOption(index) {
    const options = historyOptions.querySelectorAll('[role="option"]');
    if (!options.length) return;

    activeHistoryOptionIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const isActive = optionIndex === activeHistoryOptionIndex;
      option.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        historySearch.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function chooseHistoryAthlete(option) {
    if (!option) return;
    selectedHistoryAthlete = option.dataset.value;
    historySearch.value = option.dataset.value;
    setHistoryListOpen(false);
    loadHistoryResults().catch(showError);
  }

  async function fetchHistorySuggestions(term) {
    historySearchRequest?.abort();
    historySearchRequest = new AbortController();

    if (!term) {
      historySuggestions = [];
      renderHistoryOptions(historySuggestions);
      return;
    }

    const names = await requestRanking(
      'athletes',
      new URLSearchParams({
        filter: 'brasil',
        type: 'historico-atleta',
        q: term,
        per_page: 25
      }),
      historySearchRequest.signal
    );
    historySuggestions = names;
    renderHistoryOptions(names);
  }

  function renderHistoryResults(rows) {
    historyContent.replaceChildren();
    if (!rows.length) {
      historyStatus.textContent = 'Nenhum histórico encontrado para o atleta selecionado.';
      historyStatus.dataset.state = 'empty';
      historyContent.setAttribute('aria-busy', 'false');
      return;
    }

    const groups = new Map();
    rows.forEach((row) => {
      const event = row.event || 'Prova não informada';
      if (!groups.has(event)) groups.set(event, []);
      groups.get(event).push(row);
    });

    const sortedEvents = Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0], 'pt-BR'));

    sortedEvents.forEach(([event, eventRows]) => {
      const block = document.createElement('section');
      block.className = 'athlete-history__group';
      const title = document.createElement('h3');
      title.className = 'athlete-history__group-title';
      title.textContent = event;
      block.append(title);

      const hasAthletesColumn = eventRows.some((row) => Number(row.is_team) === 1 && row.athlete && row.athlete !== selectedHistoryAthlete);
      const columns = [
        ['Categoria', (row) => row.ranking_category || row.category],
        ['Ano', (row) => String(row.year ?? row.ranking_year ?? '').match(/\d{4}/)?.[0] || '—'],
        ['Marca', (row) => row.mark],
        ['Equipe', (row) => row.team],
        ...(hasAthletesColumn ? [['Atletas', (row) => row.athlete]] : []),
        ['Posição', (row) => row.position],
        ['Competição', (row) => row.ranking_competition || row.competition],
        ['Local', (row) => row.event_location],
        ['Data', (row) => row.event_date]
      ];

      block.append(createTable(columns, eventRows, `Histórico de ${event}`, `Histórico da prova ${event}`));
      historyContent.append(block);
    });

    historyStatus.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'} para ${selectedHistoryAthlete}.`;
    historyStatus.dataset.state = 'success';
    historyContent.setAttribute('aria-busy', 'false');
  }

  async function loadHistoryResults() {
    historyRequest?.abort();
    historyRequest = new AbortController();
    historyContent.replaceChildren();
    historyStatus.dataset.state = 'loading';

    if (!selectedHistoryAthlete) {
      historyStatus.textContent = 'Selecione um atleta para visualizar o histórico.';
      historyContent.setAttribute('aria-busy', 'false');
      return;
    }

    historyStatus.textContent = 'Consultando histórico...';
    historyContent.setAttribute('aria-busy', 'true');

    const rows = await requestRanking(
      'athletes/performance',
      new URLSearchParams({
        filter: 'brasil',
        type: 'historico-atleta',
        athlete: selectedHistoryAthlete,
        melhor_marca: historyMarkMode === 'best' ? '1' : '0',
        per_page: '1000'
      }),
      historyRequest.signal
    );
    renderHistoryResults(rows);
  }

  function loadActiveView() {
    if (activeView === 'history') return loadHistoryResults().catch(showError);
    if (!resultsVisible()) return null;
    const load = activeView === 'ranking' ? loadRankingResults : loadComplementResults;
    return load().catch(showError);
  }

  window.addEventListener('athlete-panel-change', (event) => {
    setActiveView(event.detail);
    loadActiveView();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadActiveView();
  });

  controls.forEach((control) => {
    control.element.addEventListener('change', () => {
      synchronizeGenderAndCategory(control.key);
      refreshFilterOptions()
        .then(() => {
          setActiveView(activeView);
          if (activeView !== 'history') return loadActiveView();
          return null;
        })
        .catch(showError);
    });
  });

  markModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!filtersComplete()) return;
      rankingMarkMode = button.dataset.markMode;
      marksChosen = true;
      setActiveView(activeView);
      loadActiveView();
    });
  });

  historyMarkModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      historyMarkMode = button.dataset.historyMarkMode;
      historyMarkModeButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      if (activeView === 'history' || activeView === 'complement') loadHistoryResults().catch(showError);
    });
  });

  historySearch.addEventListener('focus', () => {
    renderHistoryOptions(historySuggestions);
    setHistoryListOpen(true);
  });

  historySearch.addEventListener('input', () => {
    selectedHistoryAthlete = '';
    fetchHistorySuggestions(historySearch.value.trim()).catch(showError);
    setHistoryListOpen(true);
  });

  historySearch.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHistoryListOpen(true);
      setActiveHistoryOption(activeHistoryOptionIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveHistoryOption(activeHistoryOptionIndex - 1);
    } else if (event.key === 'Enter' && !historyOptions.hidden && activeHistoryOptionIndex >= 0) {
      event.preventDefault();
      chooseHistoryAthlete(historyOptions.querySelectorAll('[role="option"]')[activeHistoryOptionIndex]);
    } else if (event.key === 'Escape') {
      setHistoryListOpen(false);
    }
  });

  historyToggle.addEventListener('click', () => {
    const isOpen = historyToggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      setHistoryListOpen(false);
      historyToggle.focus();
      return;
    }

    fetchHistorySuggestions(historySearch.value.trim()).catch(showError);
    setHistoryListOpen(true);
    historySearch.focus();
  });

  historyOptions.addEventListener('mousedown', (event) => event.preventDefault());
  historyOptions.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) chooseHistoryAthlete(option);
  });

  document.addEventListener('click', (event) => {
    if (!historyPanel.contains(event.target)) setHistoryListOpen(false);
  });

  historyDownloadButton.addEventListener('click', () => {
    window.print();
  });

  refreshFilterOptions()
    .then(() => loadRankingResults())
    .catch(showError);
}

function initJuntosPodemosVideos() {
  const section = document.querySelector('.juntos-podemos-videos');
  if (!section) return;

  const mainPlayer = section.querySelector('.juntos-podemos-videos__main-player');
  const mainStatus = section.querySelector('[data-main-video-status]');
  const mainSource = mainPlayer?.querySelector('source');
  const mainTitle = section.querySelector('[data-main-video-title]');

  if (!mainPlayer || !mainSource || !mainStatus || !mainTitle) return;

  mainSource.src = juntosPodemosVideoUrls.velocista;
  mainPlayer.load();
  section.querySelectorAll('source[data-video-id]').forEach((source) => {
    const videoUrl = juntosPodemosVideoUrls[source.dataset.videoId];
    if (videoUrl) source.src = videoUrl;
  });

  const setStatus = (element, message) => {
    element.textContent = message;
    element.hidden = !message;
  };

  let playbackRequest = 0;

  mainPlayer.addEventListener('error', () => {
    setStatus(mainStatus, 'Não foi possível carregar o vídeo principal. Verifique se o arquivo está disponível e tente novamente.');
  });

  mainPlayer.addEventListener('playing', () => setStatus(mainStatus, ''));

  section.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.juntos-podemos-videos__open');
    if (!button) return;

    const selectedPreview = button.querySelector('[data-video-preview]');
    const selectedSource = selectedPreview?.querySelector('source');
    const selectedTitle = button.dataset.videoTitle;
    const selectedCardTitle = button.closest('.juntos-podemos-videos__card')?.querySelector('h3');
    const selectedFallback = button.querySelector('.juntos-podemos-videos__thumbnail-fallback');
    if (!selectedPreview || !selectedSource || !selectedSource.src || !selectedTitle || !selectedCardTitle || !selectedFallback) {
      setStatus(mainStatus, 'Não foi possível trocar o vídeo porque faltam informações do arquivo.');
      return;
    }

    const previousSource = mainSource.src;
    const previousTitle = mainTitle.textContent.trim();
    const selectedVideoUrl = selectedSource.src;
    const request = ++playbackRequest;

    mainPlayer.pause();
    mainPlayer.muted = false;
    mainSource.src = selectedVideoUrl;
    mainTitle.textContent = selectedTitle;
    mainPlayer.setAttribute('aria-label', selectedTitle);
    mainPlayer.load();

    selectedSource.src = previousSource;
    selectedPreview.classList.remove('is-preview-ready');
    selectedPreview.addEventListener('loadeddata', () => button.classList.add('is-preview-ready'), { once: true });
    selectedFallback.textContent = previousTitle;
    selectedPreview.load();

    button.dataset.videoTitle = previousTitle;
    button.setAttribute('aria-label', `Reproduzir vídeo: ${previousTitle}`);
    selectedCardTitle.textContent = previousTitle;
    setStatus(mainStatus, 'Iniciando vídeo...');

    mainPlayer.play().catch((error) => {
      if (request !== playbackRequest) return;
      const message = error.name === 'NotAllowedError'
        ? 'A reprodução automática com áudio foi bloqueada. Use o controle reproduzir para iniciar o vídeo.'
        : 'Não foi possível iniciar a reprodução automaticamente. Use o controle reproduzir para tentar novamente.';
      setStatus(mainStatus, message);
    });
  });

  const previews = section.querySelectorAll('[data-video-preview]');
  const loadPreview = (preview) => {
    const button = preview.closest('.juntos-podemos-videos__open');
    if (!button || preview.dataset.previewLoaded) return;

    preview.dataset.previewLoaded = 'true';
    preview.addEventListener('loadeddata', () => button.classList.add('is-preview-ready'), { once: true });
    preview.preload = 'metadata';
    preview.load();
  };

  if ('IntersectionObserver' in window) {
    const previewObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadPreview(entry.target);
      });
    }, { rootMargin: '160px' });

    previews.forEach((preview) => previewObserver.observe(preview));
  } else {
    previews.forEach(loadPreview);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTestimonialActions();
  initJuntosPodemosVideos();

  const desktopVideoQuery = window.matchMedia('(min-width: 901px)');
  const responsiveVideoSources = document.querySelectorAll('.transformar-uniao__imagem source');

  responsiveVideoSources.forEach((source) => {
    source.dataset.desktopSrc = mobileVideoUrl;
  });

  const updateResponsiveVideoSources = () => {
    responsiveVideoSources.forEach((source) => {
      const nextSource = desktopVideoQuery.matches ? source.dataset.desktopSrc : mobileVideoUrl;

      if (source.getAttribute('src') !== nextSource) {
        source.setAttribute('src', nextSource);
        source.parentElement.load();
      }
    });
  };

  updateResponsiveVideoSources();
  desktopVideoQuery.addEventListener('change', updateResponsiveVideoSources);

  const menuToggle = document.querySelector('.site-header__menu-toggle');
  const mainNavigation = document.querySelector('.site-header__navigation');
  const submenus = document.querySelectorAll('.site-header__submenu');
  const athleteSearchForm = document.querySelector('.athlete-profile__form');

  const setSubmenuOpen = (isOpen, target = null) => {
    submenus.forEach((submenu) => {
      const open = isOpen && submenu === target;
      submenu.classList.toggle('site-header__submenu--open', open);
      submenu.querySelector('.site-header__submenu-toggle').setAttribute('aria-expanded', String(open));
      submenu.querySelector('.site-header__submenu-panel').hidden = !open;
    });
  };

  submenus.forEach((submenu) => {
    const submenuToggle = submenu.querySelector('.site-header__submenu-toggle');
    const submenuPanel = submenu.querySelector('.site-header__submenu-panel');

    submenuToggle.addEventListener('click', () => {
      const isOpen = submenuToggle.getAttribute('aria-expanded') === 'true';
      setSubmenuOpen(!isOpen, submenu);
    });

    submenuPanel.addEventListener('click', () => {
      setSubmenuOpen(false);
      if (window.closeMainNavigation) window.closeMainNavigation();
    });
  });

  document.addEventListener('click', (event) => {
    if (![...submenus].some((submenu) => submenu.contains(event.target))) setSubmenuOpen(false);
  });

  document.querySelectorAll('.site-header__link').forEach((link) => {
    link.addEventListener('click', () => link.classList.add('site-header__link--clicked'));
    link.addEventListener('mouseleave', () => link.classList.remove('site-header__link--clicked'));
  });

  if (athleteSearchForm) initAthleteSearch(athleteSearchForm);

  if (menuToggle && mainNavigation) {
    const closeMenu = (restoreFocus = false) => {
      mainNavigation.classList.remove('site-header__navigation--open');
      setSubmenuOpen(false);
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menu');

      if (restoreFocus) menuToggle.focus();
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = mainNavigation.classList.toggle('site-header__navigation--open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');

      if (isOpen) {
        const firstLink = mainNavigation.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        menuToggle.focus();
      }
    });

    mainNavigation.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu(true);
    });

    window.closeMainNavigation = closeMenu;
  }

  const searchToggle = document.querySelector('.site-header__search-toggle');
  const siteSearch = document.querySelector('.site-search');

  if (searchToggle && siteSearch) {
    const searchInput = siteSearch.querySelector('.site-search__input');
    const searchClose = siteSearch.querySelector('.site-search__close');
    const searchStatus = siteSearch.querySelector('.site-search__status');
    let highlightTimer = null;

    const normalizeText = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const setSearchOpen = (isOpen, restoreFocus = false) => {
      siteSearch.hidden = !isOpen;
      searchToggle.setAttribute('aria-expanded', String(isOpen));
      searchStatus.hidden = true;

      if (isOpen) {
        searchInput.focus();
      } else if (restoreFocus) {
        searchToggle.focus();
      }
    };

    const findMatch = (term) => {
      const view = document.querySelector('main.page__view:not(.page__view--hidden)') || document.querySelector('main');
      if (!view) return null;

      const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest('script, style, [hidden], [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      while (walker.nextNode()) {
        if (normalizeText(walker.currentNode.nodeValue).includes(term)) {
          return walker.currentNode.parentElement.closest('h1, h2, h3, h4, p, li, label, time, a, button') || walker.currentNode.parentElement;
        }
      }

      return null;
    };

    const runSearch = () => {
      const term = normalizeText(searchInput.value.trim());
      if (!term) return;

      const match = findMatch(term);
      if (!match) {
        searchStatus.textContent = 'Nenhum resultado encontrado.';
        searchStatus.hidden = false;
        return;
      }

      searchStatus.hidden = true;
      document.querySelectorAll('.search-hit').forEach((element) => element.classList.remove('search-hit'));
      window.clearTimeout(highlightTimer);
      setSearchOpen(false);
      match.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      match.classList.add('search-hit');
      highlightTimer = window.setTimeout(() => match.classList.remove('search-hit'), 3000);
    };

    searchToggle.addEventListener('click', () => setSearchOpen(siteSearch.hidden));
    searchClose.addEventListener('click', () => setSearchOpen(false, true));
    searchInput.addEventListener('input', () => { searchStatus.hidden = true; });
    siteSearch.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch();
    });
    siteSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setSearchOpen(false, true);
    });
    document.addEventListener('click', (event) => {
      if (!siteSearch.hidden && !siteSearch.contains(event.target) && !searchToggle.contains(event.target)) setSearchOpen(false);
    });
  }
  const heroVideo = document.querySelector('.hero__video');
  const heroSection = document.querySelector('.hero');

  if (heroVideo && heroSection) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.preload = 'auto';

    const startHeroVideo = () => {
      heroVideo.play().catch(() => {
        // Navegador bloqueia reprodução automática; a interação do usuário será necessária.
      });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroVideo.pause();
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startHeroVideo();
          }
        });
      }, { threshold: 0.4 });

      observer.observe(heroSection);
    }
  }

  function initCardCarousel(newsGrid, newsItems, options) {
    if (!newsGrid) return;

    const carousel = newsGrid.closest('.news-carousel');
    const previousButton = carousel?.querySelector('.news-carousel__button--previous');
    const nextButton = carousel?.querySelector('.news-carousel__button--next');
    let carouselIndex = 0;
    let pendingEntry = null;
    let nextNewsId = Date.now();

    function getVisibleCardCount() {
      if (window.matchMedia('(max-width: 640px)').matches) return 1;
      if (window.matchMedia('(max-width: 900px)').matches) return 2;
      return 3;
    }

    function updateCarousel() {
      const visibleCardCount = getVisibleCardCount();
      const maxIndex = Math.max(0, newsItems.length - visibleCardCount);
      carouselIndex = Math.min(carouselIndex, maxIndex);
      const lastVisibleIndex = Math.min(newsItems.length - 1, carouselIndex + visibleCardCount - 1);

      newsGrid.querySelectorAll('.news-card').forEach((card, index) => {
        const isVisibleEdge = index === carouselIndex || index === lastVisibleIndex;
        card.classList.toggle('news-card--edge', index >= carouselIndex && index <= lastVisibleIndex && isVisibleEdge);
        card.querySelectorAll('[data-action="add"], [data-action="delete"]').forEach((button) => {
          button.hidden = !isVisibleEdge;
        });
        const deleteButton = card.querySelector('[data-action="delete"]');
        if (deleteButton && !card.dataset.deleteState) {
          const minimumCardsReached = newsItems.length <= 3;
          deleteButton.disabled = minimumCardsReached;
          deleteButton.classList.toggle('delete-action--limit-locked', minimumCardsReached);
          deleteButton.setAttribute('aria-disabled', String(minimumCardsReached));
          deleteButton.title = minimumCardsReached ? 'Mínimo de 3 cards' : 'Excluir';
        }
        if (!isVisibleEdge) {
          card.querySelector('.news-card__image-frame')?.classList.remove('news-card__image-frame--active');
        }
      });

      newsGrid.style.setProperty('--carousel-index', carouselIndex);
      if (previousButton) {
        previousButton.disabled = carouselIndex === 0;
      }
      if (nextButton) {
        nextButton.disabled = carouselIndex >= maxIndex;
      }
    }

    function moveCarousel(direction) {
      const visibleCardCount = getVisibleCardCount();
      const maxIndex = Math.max(0, newsItems.length - visibleCardCount);
      carouselIndex = Math.max(0, Math.min(carouselIndex + direction, maxIndex));
      updateCarousel();
    }

    function generateNewsId() {
      nextNewsId += 1;
      return nextNewsId;
    }

    function createNewsItem() {
      const nextNumber = newsItems.length + 1;
      const id = generateNewsId();

      return {
        id,
        title: `${options.newTitle} ${nextNumber}`,
        text: options.newText,
        imageClass: options.imageOptions[newsItems.length % options.imageOptions.length],
        ariaLabel: `${options.newTitle} ${nextNumber}`,
        ...options.newItemExtras()
      };
    }

    function insertNewsItem(position, cardIndex) {
      const newItem = createNewsItem();
      const insertionIndex = position === 'left' ? cardIndex : cardIndex + 1;

      newsItems.splice(insertionIndex, 0, newItem);
      pendingEntry = { id: newItem.id, direction: position };

      if (position === 'right') {
        const visibleCardCount = getVisibleCardCount();
        const maxIndex = Math.max(0, newsItems.length - visibleCardCount);
        carouselIndex = Math.min(carouselIndex + 1, maxIndex);
      }

      renderNewsCards();
    }

    function prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function waitForAnimation(element, animationName, fallbackDuration) {
      if (prefersReducedMotion()) return Promise.resolve();

      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          element.removeEventListener('animationend', handleAnimationEnd);
          window.clearTimeout(timeoutId);
          resolve();
        };
        const handleAnimationEnd = (event) => {
          if (event.animationName === animationName) finish();
        };
        const timeoutId = window.setTimeout(finish, fallbackDuration + 100);

        element.addEventListener('animationend', handleAnimationEnd);
      });
    }

    function deleteNewsItem(cardId) {
      const currentIndex = newsItems.findIndex((item) => item.id === cardId);
      if (currentIndex === -1) {
        throw new Error(`Card ${cardId} não foi encontrado.`);
      }

      newsItems.splice(currentIndex, 1);
    }

    async function handleDelete(card, cardId, button) {
      if (card.dataset.deleteState || newsItems.length <= 3) return;

      card.dataset.deleteState = 'eating';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.classList.add('delete-action--eating');

      await waitForAnimation(button, 'delete-button-eat', 420);

      card.dataset.deleteState = 'collapsed';
      button.classList.remove('delete-action--eating');
      button.classList.add('delete-action--collapsed');
      await waitForAnimation(button, 'delete-button-collapse', 360);

      card.dataset.deleteState = 'pending';
      button.classList.add('delete-action--pending');

      const startedAt = performance.now();

      try {
        deleteNewsItem(cardId);

        const minimumFeedbackTime = 650;
        const elapsed = performance.now() - startedAt;
        if (!prefersReducedMotion() && elapsed < minimumFeedbackTime) {
          await new Promise((resolve) => window.setTimeout(resolve, minimumFeedbackTime - elapsed));
        }

        card.dataset.deleteState = 'success';
        button.classList.remove('delete-action--pending');
        button.classList.add('delete-action--success');
        await waitForAnimation(button, 'delete-button-success', 260);

        card.classList.add('news-card--removing');
        await waitForAnimation(card, 'news-card-delete-out', 380);
        renderNewsCards();
      } catch (error) {
        console.error('Não foi possível excluir o card.', error);
        card.dataset.deleteState = 'error';
        button.classList.remove('delete-action--pending', 'delete-action--collapsed');
        button.classList.add('delete-action--error');
        await waitForAnimation(button, 'delete-button-error', 360);
        button.classList.remove('delete-action--error');
        card.dataset.deleteState = '';
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
      }
    }

    function renderNewsCards() {
      newsGrid.innerHTML = newsItems.map((item) => `
        <article class="news-card${pendingEntry?.id === item.id ? ` news-card--entering-${pendingEntry.direction}` : ''}" data-id="${item.id}">
          <div class="news-card__image-frame" tabindex="0" aria-label="${item.ariaLabel}">
            <div class="news-card__image ${item.imageClass}" aria-hidden="true"></div>
            <div class="news-card__toolbar" role="toolbar" aria-label="Ferramentas da imagem">
              <button type="button" class="news-card__toolbar-button" data-action="move-left" aria-label="Mover imagem para esquerda" title="Mover para esquerda">
                <span aria-hidden="true">←</span>
              </button>
              <button type="button" class="news-card__toolbar-button" data-action="move-right" aria-label="Mover imagem para direita" title="Mover para direita">
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="news-card__toolbar-button" data-action="add" aria-label="Adicionar imagem" title="Adicionar imagem">
                <span aria-hidden="true">+</span>
              </button>
              <button type="button" class="news-card__toolbar-button news-card__toolbar-button--danger delete-action" data-action="delete" aria-label="Excluir card" aria-busy="false" title="Excluir">
                <span class="delete-action__icon" aria-hidden="true">🗑</span>
                <svg class="delete-action__progress" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
                  <circle cx="18" cy="18" r="15" pathLength="100" />
                </svg>
                <span class="delete-action__success" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
          <div class="news-card__body">
            <h3>${item.title}</h3>
            ${item.date ? `<time datetime="${item.date}">${item.date}</time>` : `<span class="news-card__meta">${item.meta}</span>`}
            <p>${item.text}</p>
          </div>
        </article>
      `).join('');

      bindToolbarEvents();
      updateCarousel();

      if (pendingEntry) {
        const enteringCard = newsGrid.querySelector(`[data-id="${pendingEntry.id}"]`);
        const entryClass = `news-card--entering-${pendingEntry.direction}`;
        pendingEntry = null;

        if (enteringCard && !prefersReducedMotion()) {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => enteringCard.classList.remove(entryClass));
          });
        } else {
          enteringCard?.classList.remove(entryClass);
        }
      }
    }

    previousButton?.addEventListener('click', () => {
      moveCarousel(-1);
    });

    nextButton?.addEventListener('click', () => {
      moveCarousel(1);
    });

    window.addEventListener('resize', updateCarousel);

    let touchStartX = null;

    carousel?.querySelector('.news-carousel__viewport')?.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    carousel?.querySelector('.news-carousel__viewport')?.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;

      const touchDistance = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;

      if (Math.abs(touchDistance) < 40) return;
      moveCarousel(touchDistance < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (!carousel || (!carousel.matches(':hover') && !carousel.contains(document.activeElement))) return;

      if (event.key === 'ArrowLeft' && previousButton && !previousButton.disabled) {
        event.preventDefault();
        previousButton.click();
      }

      if (event.key === 'ArrowRight' && nextButton && !nextButton.disabled) {
        event.preventDefault();
        nextButton.click();
      }
    });

    function bindToolbarEvents() {
      const imageFrames = newsGrid.querySelectorAll('.news-card__image-frame');

      imageFrames.forEach((frame) => {
        const newsCard = frame.closest('.news-card');
        if (!newsCard) return;

        const showToolbar = () => {
          frame.classList.add('news-card__image-frame--active');
        };

        const hideToolbar = () => {
          const isInsideToolbar = frame.contains(document.activeElement);
          if (!isInsideToolbar) {
            frame.classList.remove('news-card__image-frame--active');
          }
        };

        frame.addEventListener('mouseenter', showToolbar);
        frame.addEventListener('mouseleave', hideToolbar);
        frame.addEventListener('focusin', showToolbar);
        frame.addEventListener('focusout', hideToolbar);
        frame.addEventListener('click', (event) => {
          if (event.target.closest('.news-card__toolbar-button')) return;
          frame.classList.toggle('news-card__image-frame--active');
        });

        frame.addEventListener('touchstart', (event) => {
          event.preventDefault();
          frame.classList.toggle('news-card__image-frame--active');
        }, { passive: false });
      });

      newsGrid.querySelectorAll('.news-card__toolbar-button').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const card = button.closest('.news-card');
          if (!card) return;

          const cardId = Number(card.dataset.id);
          const action = button.dataset.action;

          if (action === 'move-left') {
            const currentIndex = newsItems.findIndex((item) => item.id === cardId);
            if (currentIndex > 0) {
              [newsItems[currentIndex - 1], newsItems[currentIndex]] = [newsItems[currentIndex], newsItems[currentIndex - 1]];
              renderNewsCards();
            }
          }

          if (action === 'move-right') {
            const currentIndex = newsItems.findIndex((item) => item.id === cardId);
            if (currentIndex >= 0 && currentIndex < newsItems.length - 1) {
              [newsItems[currentIndex], newsItems[currentIndex + 1]] = [newsItems[currentIndex + 1], newsItems[currentIndex]];
              renderNewsCards();
            }
          }

          if (action === 'add') {
            const currentIndex = newsItems.findIndex((item) => item.id === cardId);
            const lastVisibleIndex = Math.min(newsItems.length - 1, carouselIndex + getVisibleCardCount() - 1);
            const position = currentIndex === carouselIndex ? 'left' : 'right';

            if (currentIndex === carouselIndex || currentIndex === lastVisibleIndex) {
              insertNewsItem(position, currentIndex);
            }
          }

          if (action === 'delete') {
            handleDelete(card, cardId, button);
          }
        });
      });
    }

    document.addEventListener('click', (event) => {
      const insideToolbar = event.target.closest('.news-card__image-frame');
      if (!insideToolbar) {
        newsGrid.querySelectorAll('.news-card__image-frame').forEach((frame) => frame.classList.remove('news-card__image-frame--active'));
      }
    });

    renderNewsCards();
  }

  initCardCarousel(
    document.querySelector('#eventsGrid'),
    [
      {
        id: 1,
        title: 'Taça Paraná de Atletismo Master',
        meta: 'Em breve',
        text: 'A data e os detalhes deste evento serão divulgados assim que confirmados.',
        imageClass: 'news-card__image--event-one',
        ariaLabel: 'Imagem da Taça Parana 2026'
      },
      {
        id: 2,
        title: 'Trofeu Brasil de Atletismo Master',
        meta: 'Em breve',
        text: 'Publicaremos aqui as informações de participação e programação.',
        imageClass: 'news-card__image--two',
        ariaLabel: 'Imagem de voluntários em atividade'
      },
      {
        id: 3,
        title: 'Ação solidária',
        meta: 'Em breve',
        text: 'Novidades sobre esta ação serão publicadas quando estiverem disponíveis.',
        imageClass: 'news-card__image--three',
        ariaLabel: 'Imagem de recursos para projetos sociais'
      }
    ],
    {
      newTitle: 'Novo Evento',
      newText: 'A data e os detalhes deste evento serão divulgados assim que confirmados.',
      imageOptions: ['news-card__image--event-one', 'news-card__image--two', 'news-card__image--three', 'news-card__image--event-four'],
      newItemExtras: () => ({ meta: 'Em breve' })
    }
  );

  const faqItems = document.querySelectorAll('.transformar-faq__item');

  faqItems.forEach((item) => {
    const button = item.querySelector('.transformar-faq__question');
    const icon = item.querySelector('.transformar-faq__icon');

    if (!button || !icon) return;

    button.addEventListener('click', () => {
      const isActive = item.classList.contains('transformar-faq__item--active');

      faqItems.forEach((faqItem) => {
        const faqButton = faqItem.querySelector('.transformar-faq__question');
        const faqIcon = faqItem.querySelector('.transformar-faq__icon');

        faqItem.classList.remove('transformar-faq__item--active');

        if (faqButton && faqIcon) {
          faqButton.setAttribute('aria-expanded', 'false');
          const faqAnswer = faqItem.querySelector('.transformar-faq__answer');
          if (faqAnswer) faqAnswer.setAttribute('aria-hidden', 'true');
          faqIcon.textContent = '+';
        }
      });

      if (!isActive) {
        item.classList.add('transformar-faq__item--active');
        button.setAttribute('aria-expanded', 'true');
        const answer = item.querySelector('.transformar-faq__answer');
        if (answer) answer.setAttribute('aria-hidden', 'false');
        icon.textContent = '−';
      }
    });
  });

  const toast = document.querySelector('.feedback-toast');
  const toastTrigger = document.querySelector('.feedback-showcase__toast-trigger');
  const toastClose = document.querySelector('.feedback-toast__close');

  if (toast && toastTrigger && toastClose) {
    function setToastVisibility(isVisible) {
      toast.classList.toggle('feedback-toast--visible', isVisible);
      toast.setAttribute('aria-hidden', String(!isVisible));
    }

    toastTrigger.addEventListener('click', () => {
      setToastVisibility(true);
      window.setTimeout(() => setToastVisibility(false), 4500);
    });

    toastClose.addEventListener('click', () => setToastVisibility(false));
  }

  const views = document.querySelectorAll('.page__view');
  const navLinks = document.querySelectorAll('[data-route]');

  function showView(route) {
    const activeView = document.querySelector(`.page__view[data-view="${route}"]`);
    if (!activeView) {
      return;
    }

    views.forEach((view) => {
      const isCurrent = view === activeView;
      view.classList.toggle('page__view--hidden', !isCurrent);
      view.setAttribute('aria-hidden', String(!isCurrent));
      view.inert = !isCurrent;
    });
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '').trim();
    const homeSectionHashes = ['home', 'inicio', 'quem-somos', 'projetos', 'recursos', 'voluntarios', 'atualizacoes', 'contato', 'doar', ''];

    if (hash === 'noticias') {
      showView('noticias');
      return;
    }

    if (hash.startsWith('noticia/')) {
      showView('noticia');
      return;
    }

    if (homeSectionHashes.includes(hash)) {
      showView('home');
      return;
    }

    if (hash === 'cadastro') {
      showView('cadastro');
      return;
    }

    if (hash === 'cadastro-depoimento') {
      showView('cadastro-depoimento');
      return;
    }

    if (hash === 'resultado-ranking' || hash === 'resultado-historico' || hash === 'resultado-complemento') {
      showView('perfil');
      window.dispatchEvent(new CustomEvent('athlete-panel-change', {
        detail: hash === 'resultado-ranking'
          ? 'ranking'
          : hash === 'resultado-historico' ? 'history' : 'complement'
      }));
      return;
    }

    if (hash === 'perfil') {
      showView('perfil');
      return;
    }

    const targetSection = document.getElementById(hash);
    if (targetSection) {
      const homeView = document.querySelector('.page__view[data-view="home"]');
      const homeWasHidden = homeView.classList.contains('page__view--hidden');
      showView('home');
      // A home só atinge a altura final depois da transição de max-height (0.45s).
      setTimeout(() => targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), homeWasHidden ? 480 : 0);
      return;
    }

    showView('home');
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const route = link.dataset.route;
      if (!route) return;

      event.preventDefault();
      window.location.hash = route;
      showView(route);

      if (window.closeMainNavigation) window.closeMainNavigation();

      const activeView = document.querySelector(`.page__view[data-view="${route}"]`);
      const heading = activeView?.querySelector('h1, h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    });
  });

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});
