(() => {
  const publicDataBase = document.querySelector('meta[name="uca-public-data"]')?.content;
  const readOnlyMessage = 'Esta versão é somente para consulta. Faça alterações no ambiente local e publique uma nova versão do site.';
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
  const accountPanel = document.getElementById('adminAuthAccount');
  const passwordChangeForm = document.getElementById('adminPasswordChangeForm');
  const accountStatus = document.getElementById('adminAuthAccountStatus');
  const toggle = document.querySelector('[data-admin-auth-toggle]');
  const submit = form?.querySelector('[type="submit"]');
  const userManagement = document.querySelector('[data-user-management]');
  const userForm = document.getElementById('adminUserCreateForm');
  const userList = document.getElementById('adminUserList');
  const userStatus = document.getElementById('adminUserStatus');
  const accountUsername = document.querySelector('[data-auth-username]');
  let session = { authenticated: false, username: '', role: '', csrfToken: '' };
  let apiAvailable = true;

  function updateInterface() {
    if (toggle) {
      toggle.textContent = session.authenticated ? 'Minha conta' : 'Acesso UCA';
      toggle.setAttribute('aria-label', session.authenticated
        ? 'Abrir opções da conta'
        : 'Acesso UCA para membros');
    }
    document.querySelectorAll('[data-registration-access]').forEach((element) => {
      element.hidden = !session.authenticated;
    });
    if (userManagement) userManagement.hidden = session.role !== 'admin';
    if (accountUsername) accountUsername.textContent = session.username;
  }

  function announceSessionChange() {
    updateInterface();
    window.dispatchEvent(new Event('uca-admin-auth-change'));
  }

  async function refreshSession() {
    if (publicDataBase) return false;
    const response = await fetch(apiUrl('/auth/session'), {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
    const result = await response.json();
    const authenticated = result.authenticated === true && ['admin', 'member'].includes(result.role);
    session = {
      authenticated,
      username: authenticated ? String(result.username || '') : '',
      role: authenticated ? result.role : '',
      csrfToken: authenticated ? String(result.csrfToken || '') : ''
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
      console.error('Não foi possível consultar a sessão.', error);
      apiAvailable = false;
      session = { authenticated: false, username: '', role: '', csrfToken: '' };
      updateInterface();
      if (status) status.textContent = 'A API de acesso está indisponível. Verifique se o backend está iniciado.';
      return false;
    });

  function showLoginPanel(message = '') {
    if (form) form.hidden = false;
    if (accountPanel) accountPanel.hidden = true;
    if (status) status.textContent = message;
  }

  function openDialog(message = '') {
    if (!dialog) return;
    showLoginPanel(message);
    if (!dialog.open) dialog.showModal();
    if (!session.authenticated) form?.elements.namedItem('username')?.focus();
  }

  async function openAccountDialog() {
    if (!dialog) return;
    if (form) form.hidden = true;
    if (accountPanel) accountPanel.hidden = false;
    if (!dialog.open) dialog.showModal();
    if (session.role === 'admin') await loadUsers();
  }

  async function requireRegistration(route) {
    await ready;
    if (session.authenticated && ['admin', 'member'].includes(session.role)) return true;
    openDialog(publicDataBase
      ? readOnlyMessage
      : apiAvailable
        ? 'Entre com uma conta Administrador UCA ou Membro UCA para continuar.'
        : 'A API de acesso está indisponível. Verifique se o backend está iniciado.');
    return false;
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = String(options.method || 'GET').toUpperCase();
    if (publicDataBase) {
      const pathname = new URL(url, window.location.href).pathname;
      if (!['GET', 'HEAD'].includes(method)
        || !/^\/(depoimentos|noticias|competicoes)\/?$/.test(pathname)) {
        throw new Error(readOnlyMessage);
      }
      const collection = pathname.replaceAll('/', '');
      const dataUrl = new URL(`${publicDataBase}${collection}.json`, window.location.href);
      return fetch(dataUrl, { ...options, headers, credentials: 'omit' });
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && session.authenticated) {
      headers.set('X-CSRF-Token', session.csrfToken);
    }
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    if (response.status === 401 && session.authenticated) {
      session = { authenticated: false, username: '', role: '', csrfToken: '' };
      announceSessionChange();
    }
    return response;
  }

  async function logout() {
    const response = await request(apiUrl('/auth/logout'), { method: 'POST' });
    if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
    session = { authenticated: false, username: '', role: '', csrfToken: '' };
    if (window.location.hash.replace('#', '').trim().startsWith('cadastro')) {
      window.location.hash = 'home';
    }
    dialog?.close();
    announceSessionChange();
  }

  async function loadUsers() {
    if (!userList || session.role !== 'admin') return;
    userList.replaceChildren();
    if (userStatus) userStatus.textContent = 'Carregando usuários...';
    try {
      const response = await request(apiUrl('/auth/users'), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
      const users = await response.json();
      users.forEach((user) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = `${user.username} — ${user.role === 'admin' ? 'Administrador UCA' : 'Membro UCA'}`;
        item.append(label);
        if (user.username.toLocaleLowerCase('en-US') !== session.username.toLocaleLowerCase('en-US')) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'button button--secondary';
          remove.textContent = 'Excluir';
          remove.addEventListener('click', () => removeUser(user.username));
          item.append(remove);
        }
        userList.append(item);
      });
      if (userStatus) userStatus.textContent = users.length ? '' : 'Nenhum usuário cadastrado.';
    } catch (error) {
      console.error('Não foi possível carregar os usuários.', error);
      if (userStatus) userStatus.textContent = `Não foi possível carregar usuários: ${error.message}`;
    }
  }

  async function removeUser(username) {
    if (!window.confirm(`Excluir a conta "${username}"?`)) return;
    try {
      const response = await request(apiUrl(`/auth/users/${encodeURIComponent(username)}`), {
        method: 'DELETE'
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || `A API respondeu com o status ${response.status}.`);
      }
      await loadUsers();
      if (userStatus) userStatus.textContent = 'Usuário excluído.';
    } catch (error) {
      console.error('Não foi possível excluir o usuário.', error);
      if (userStatus) userStatus.textContent = error.message;
    }
  }

  toggle?.addEventListener('click', async () => {
    await ready;
    if (session.authenticated) {
      await openAccountDialog();
      return;
    }
    openDialog(publicDataBase ? readOnlyMessage : '');
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publicDataBase) {
      if (status) status.textContent = readOnlyMessage;
      return;
    }
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
      const authenticated = result.authenticated === true && ['admin', 'member'].includes(result.role);
      session = {
        authenticated,
        username: authenticated ? String(result.username || username) : '',
        role: authenticated ? result.role : '',
        csrfToken: authenticated ? String(result.csrfToken || '') : ''
      };
      apiAvailable = true;
      passwordInput.value = '';
      if (!session.authenticated || !session.csrfToken) {
        session = { authenticated: false, username: '', role: '', csrfToken: '' };
        throw new Error('A API não confirmou uma sessão válida.');
      }
      if (dialog?.open) dialog.close();
      announceSessionChange();
    } catch (error) {
      console.error('Não foi possível iniciar a sessão.', error);
      if (status) {
        status.textContent = error instanceof TypeError
          ? 'Não foi possível conectar à API de acesso. Verifique se o backend está em execução e tente novamente.'
          : error.message;
      }
    } finally {
      submit.disabled = false;
    }
  });

  passwordChangeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = passwordChangeForm.elements.namedItem('currentPassword').value;
    const newPasswordInput = passwordChangeForm.elements.namedItem('newPassword');
    try {
      const response = await request(apiUrl('/auth/password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: newPasswordInput.value })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || `A API respondeu com o status ${response.status}.`);
      }
      passwordChangeForm.reset();
      session = { authenticated: false, username: '', role: '', csrfToken: '' };
      announceSessionChange();
      showLoginPanel('Senha alterada. Entre novamente com a nova senha.');
      form?.elements.namedItem('username')?.focus();
    } catch (error) {
      console.error('Não foi possível alterar a senha.', error);
      if (accountStatus) accountStatus.textContent = error.message;
    }
  });

  userForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = userForm.elements.namedItem('username').value.trim();
    const password = userForm.elements.namedItem('password').value;
    const role = userForm.elements.namedItem('role').value;
    try {
      const response = await request(apiUrl('/auth/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || `A API respondeu com o status ${response.status}.`);
      }
      userForm.reset();
      if (userStatus) userStatus.textContent = 'Usuário criado.';
      await loadUsers();
    } catch (error) {
      console.error('Não foi possível criar o usuário.', error);
      if (userStatus) userStatus.textContent = error.message;
    }
  });

  dialog?.querySelector('[data-admin-logout]')?.addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Não foi possível encerrar a sessão.', error);
      if (accountStatus) accountStatus.textContent = `Não foi possível encerrar a sessão: ${error.message}`;
    }
  });

  dialog?.querySelector('[data-admin-auth-cancel]')?.addEventListener('click', () => {
    dialog.close();
  });

  dialog?.querySelector('[data-auth-home]')?.addEventListener('click', () => {
    dialog.close();
    window.location.hash = 'home';
  });

  dialog?.querySelector('[data-password-visibility]')?.addEventListener('click', (event) => {
    const passwordInput = form?.elements.namedItem('password');
    if (!passwordInput) return;
    const reveal = passwordInput.type === 'password';
    passwordInput.type = reveal ? 'text' : 'password';
    event.currentTarget.textContent = reveal ? 'Ocultar senha' : 'Mostrar senha';
    event.currentTarget.setAttribute('aria-pressed', String(reveal));
  });

  window.addEventListener('uca-admin-auth-change', () => {
    if (session.role === 'admin') loadUsers();
  });

  if (publicDataBase) {
    if (submit) submit.disabled = true;
    for (const input of form?.querySelectorAll('input, button[type="submit"]') || []) input.disabled = true;
  }

  window.UcaAdminAuth = {
    apiUrl,
    isAdmin: () => session.role === 'admin',
    isAuthenticated: () => session.authenticated,
    ready,
    refreshSession,
    request,
    requireRegistration
  };
})();
