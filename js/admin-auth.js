(() => {
  const configuredApiBase = document.querySelector('meta[name="uca-api-base"]')?.content
    || 'http://127.0.0.1:3000';
  const apiBase = new URL(configuredApiBase);
  if (!['http:', 'https:'].includes(apiBase.protocol)
    || apiBase.pathname !== '/'
    || apiBase.search
    || apiBase.hash
    || apiBase.username
    || apiBase.password) {
    throw new Error('A URL da API administrativa deve ser uma origem HTTP(S) sem caminho ou credenciais.');
  }

  const apiUrl = (pathname) => new URL(pathname.replace(/^\/+/, ''), `${apiBase.origin}/`).href;
  const dialog = document.getElementById('adminAuthDialog');
  const form = document.getElementById('adminAuthForm');
  const status = document.getElementById('adminAuthStatus');
  const toggle = document.querySelector('[data-admin-auth-toggle]');
  const submit = form?.querySelector('[type="submit"]');
  let session = { authenticated: false, csrfToken: '' };
  let apiAvailable = true;
  let pendingRoute = '';

  function updateInterface() {
    if (toggle) {
      toggle.textContent = session.authenticated ? 'Sair' : 'Entrar';
      toggle.setAttribute('aria-label', session.authenticated
        ? 'Sair da área administrativa'
        : 'Entrar na área administrativa');
    }
  }

  function announceSessionChange() {
    updateInterface();
    window.dispatchEvent(new Event('uca-admin-auth-change'));
  }

  async function refreshSession() {
    const response = await fetch(apiUrl('/auth/session'), {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
    const result = await response.json();
    session = {
      authenticated: result.authenticated === true && result.role === 'admin',
      csrfToken: result.authenticated === true && result.role === 'admin'
        ? String(result.csrfToken || '')
        : ''
    };
    return session.authenticated;
  }

  const ready = refreshSession()
    .then((authenticated) => {
      updateInterface();
      if (authenticated) window.dispatchEvent(new Event('uca-admin-auth-change'));
      return authenticated;
    })
    .catch((error) => {
      console.error('Não foi possível consultar a sessão administrativa.', error);
      apiAvailable = false;
      session = { authenticated: false, csrfToken: '' };
      updateInterface();
      if (status) status.textContent = 'A API administrativa está indisponível. Verifique se o backend está iniciado.';
      return false;
    });

  function openDialog(message = '') {
    if (!dialog || dialog.open) return;
    if (status) status.textContent = message;
    dialog.showModal();
    form?.elements.namedItem('username')?.focus();
  }

  async function requireAdmin(route) {
    await ready;
    if (session.authenticated) return true;
    pendingRoute = route;
    openDialog(apiAvailable
      ? 'Entre com sua conta administrativa para continuar.'
      : 'A API administrativa está indisponível. Verifique se o backend está iniciado.');
    return false;
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = String(options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && session.authenticated) {
      headers.set('X-CSRF-Token', session.csrfToken);
    }
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    if (response.status === 401 && session.authenticated) {
      session = { authenticated: false, csrfToken: '' };
      announceSessionChange();
    }
    return response;
  }

  toggle?.addEventListener('click', async () => {
    await ready;
    if (!session.authenticated) {
      openDialog();
      return;
    }
    toggle.disabled = true;
    try {
      const response = await request(apiUrl('/auth/logout'), { method: 'POST' });
      if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
      session = { authenticated: false, csrfToken: '' };
      pendingRoute = '';
      if (['cadastro-noticia', 'cadastro-competicao', 'cadastro-depoimento']
        .includes(window.location.hash.replace('#', '').trim())) {
        window.location.hash = 'home';
      }
      if (dialog?.open) dialog.close();
      announceSessionChange();
      if (status) status.textContent = 'Sessão administrativa encerrada.';
    } catch (error) {
      console.error('Não foi possível encerrar a sessão administrativa.', error);
      if (status) status.textContent = `Não foi possível encerrar a sessão: ${error.message}`;
    } finally {
      toggle.disabled = false;
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.elements.namedItem('username').value.trim();
    const passwordInput = form.elements.namedItem('password');
    const password = passwordInput.value;
    submit.disabled = true;
    if (status) status.textContent = 'Validando acesso...';
    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `A API respondeu com o status ${response.status}.`);
      session = {
        authenticated: result.authenticated === true && result.role === 'admin',
        csrfToken: String(result.csrfToken || '')
      };
      apiAvailable = true;
      passwordInput.value = '';
      if (!session.authenticated || !session.csrfToken) {
        session = { authenticated: false, csrfToken: '' };
        throw new Error('A API não confirmou uma sessão administrativa válida.');
      }
      if (dialog?.open) dialog.close();
      announceSessionChange();
      pendingRoute = '';
    } catch (error) {
      console.error('Não foi possível iniciar a sessão administrativa.', error);
      if (status) status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  dialog?.querySelector('[data-admin-auth-cancel]')?.addEventListener('click', () => {
    pendingRoute = '';
    dialog.close();
  });

  window.UcaAdminAuth = {
    apiUrl,
    isAuthenticated: () => session.authenticated,
    ready,
    refreshSession,
    request,
    requireAdmin
  };
})();
