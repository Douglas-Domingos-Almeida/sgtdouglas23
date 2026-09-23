document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNavigation = document.querySelector('.main-nav');

  if (menuToggle && mainNavigation) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mainNavigation.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    });
  }

  const heroVideo = document.querySelector('.hero-video');
  const heroSection = document.querySelector('.hero-section');

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

  const newsGrid = document.querySelector('#newsGrid');

  if (newsGrid) {
    const newsItems = [
      {
        id: 1,
        title: 'Educação e Esperança para Todos',
        date: '2024-09-13',
        text: 'Com ações voltadas à aprendizagem e apoio comunitário, ampliamos oportunidades para crianças e jovens em vulnerabilidade.',
        imageClass: 'news-image--one',
        ariaLabel: 'Educação e Esperança para Todos'
      },
      {
        id: 2,
        title: 'Voluntários Transformando Realidades',
        date: '2024-09-18',
        text: 'Conheça histórias inspiradoras de pessoas que dedicam tempo e energia para promover impacto positivo na comunidade.',
        imageClass: 'news-image--two',
        ariaLabel: 'Voluntários Transformando Realidades'
      },
      {
        id: 3,
        title: 'Captação de Recursos Criativa',
        date: '2024-09-25',
        text: 'Novas campanhas e estratégias ajudam a fortalecer programas sociais e garantir apoio contínuo para quem mais precisa.',
        imageClass: 'news-image--three',
        ariaLabel: 'Captação de Recursos Criativa'
      }
    ];

    function renderNewsCards() {
      newsGrid.innerHTML = newsItems.map((item) => `
        <article class="news-card" data-id="${item.id}">
          <div class="news-image-frame" tabindex="0" aria-label="${item.ariaLabel}">
            <div class="news-image ${item.imageClass}" aria-hidden="true"></div>
            <div class="contextual-toolbar" role="toolbar" aria-label="Ferramentas da imagem">
              <button type="button" class="toolbar-button" data-action="move-left" aria-label="Mover imagem para esquerda" title="Mover para esquerda">
                <span aria-hidden="true">←</span>
              </button>
              <button type="button" class="toolbar-button" data-action="move-right" aria-label="Mover imagem para direita" title="Mover para direita">
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="toolbar-button" data-action="add" aria-label="Adicionar imagem" title="Adicionar imagem">
                <span aria-hidden="true">+</span>
              </button>
              <button type="button" class="toolbar-button toolbar-button--danger" data-action="delete" aria-label="Excluir imagem" title="Excluir imagem">
                <span aria-hidden="true">🗑</span>
              </button>
            </div>
          </div>
          <div class="news-body">
            <h3>${item.title}</h3>
            <time datetime="${item.date}">${item.date}</time>
            <p>${item.text}</p>
          </div>
        </article>
      `).join('');

      bindToolbarEvents();
    }

    function bindToolbarEvents() {
      const imageFrames = document.querySelectorAll('.news-image-frame');

      imageFrames.forEach((frame) => {
        const newsCard = frame.closest('.news-card');
        if (!newsCard) return;

        const showToolbar = () => {
          frame.classList.add('is-active');
        };

        const hideToolbar = () => {
          const isInsideToolbar = frame.contains(document.activeElement);
          if (!isInsideToolbar) {
            frame.classList.remove('is-active');
          }
        };

        frame.addEventListener('mouseenter', showToolbar);
        frame.addEventListener('mouseleave', hideToolbar);
        frame.addEventListener('focusin', showToolbar);
        frame.addEventListener('focusout', hideToolbar);
        frame.addEventListener('click', (event) => {
          if (event.target.closest('.toolbar-button')) return;
          frame.classList.toggle('is-active');
        });

        frame.addEventListener('touchstart', (event) => {
          event.preventDefault();
          frame.classList.toggle('is-active');
        }, { passive: false });
      });

      document.querySelectorAll('.toolbar-button').forEach((button) => {
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
            const nextId = Date.now();
            const imageOptions = ['news-image--one', 'news-image--two', 'news-image--three'];
            const nextIndex = newsItems.length % imageOptions.length;
            newsItems.push({
              id: nextId,
              title: `Nova Atualização ${newsItems.length + 1}`,
              date: new Date().toISOString().slice(0, 10),
              text: 'Nova campanha, novo impulso para transformar histórias e ampliar oportunidades para a comunidade.',
              imageClass: imageOptions[nextIndex],
              ariaLabel: `Nova Atualização ${newsItems.length + 1}`
            });
            renderNewsCards();
          }

          if (action === 'delete') {
            const currentIndex = newsItems.findIndex((item) => item.id === cardId);
            if (currentIndex > -1) {
              newsItems.splice(currentIndex, 1);
              renderNewsCards();
            }
          }
        });
      });
    }

    document.addEventListener('click', (event) => {
      const insideToolbar = event.target.closest('.news-image-frame');
      if (!insideToolbar) {
        document.querySelectorAll('.news-image-frame').forEach((frame) => frame.classList.remove('is-active'));
      }
    });

    renderNewsCards();
  }

  const faqItems = document.querySelectorAll('.transformar-faq__item');

  faqItems.forEach((item) => {
    const button = item.querySelector('.transformar-faq__question');
    const icon = item.querySelector('.transformar-faq__icon');

    if (!button || !icon) return;

    button.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach((faqItem) => {
        const faqButton = faqItem.querySelector('.transformar-faq__question');
        const faqIcon = faqItem.querySelector('.transformar-faq__icon');

        faqItem.classList.remove('active');

        if (faqButton && faqIcon) {
          faqButton.setAttribute('aria-expanded', 'false');
          faqIcon.textContent = '+';
        }
      });

      if (!isActive) {
        item.classList.add('active');
        button.setAttribute('aria-expanded', 'true');
        icon.textContent = '−';
      }
    });
  });

  const toast = document.querySelector('.feedback-toast');
  const toastTrigger = document.querySelector('.feedback-toast-trigger');
  const toastClose = document.querySelector('.feedback-toast-close');

  if (toast && toastTrigger && toastClose) {
    function setToastVisibility(isVisible) {
      toast.classList.toggle('is-visible', isVisible);
      toast.setAttribute('aria-hidden', String(!isVisible));
    }

    toastTrigger.addEventListener('click', () => {
      setToastVisibility(true);
      window.setTimeout(() => setToastVisibility(false), 4500);
    });

    toastClose.addEventListener('click', () => setToastVisibility(false));
  }

  const views = document.querySelectorAll('.view');
  const navLinks = document.querySelectorAll('[data-route]');

  function showView(route) {
    const activeView = document.querySelector(`.view[data-view="${route}"]`);
    if (!activeView) {
      return;
    }

    views.forEach((view) => {
      const isCurrent = view === activeView;
      view.classList.toggle('is-hidden', !isCurrent);
      view.setAttribute('aria-hidden', String(!isCurrent));
    });

    navLinks.forEach((link) => {
      const isActive = link.dataset.route === route;
      link.classList.toggle('active', isActive);
    });
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '').trim();
    const homeSectionHashes = ['home', 'inicio', 'quem-somos', 'projetos', 'recursos', 'voluntarios', 'atualizacoes', 'contato', 'doar', ''];

    if (homeSectionHashes.includes(hash)) {
      showView('home');
      return;
    }

    if (hash === 'cadastro') {
      showView('cadastro');
      return;
    }

    const targetSection = document.getElementById(hash);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showView('home');
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
    });
  });

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});
