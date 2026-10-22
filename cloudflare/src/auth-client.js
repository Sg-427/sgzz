(() => {
  const controls = document.getElementById('cloud-auth-controls');
  if (!controls) return;
  if (location.protocol === 'file:') { controls.hidden = true; return; }
  let csrf = '', checking = false;
  async function checkAccess() {
    if (checking) return;
    checking = true;
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        location.replace('/login?reason=expired'); return;
      }
      if (!response.ok) return;
      const data = await response.json();
      csrf = data.csrfToken;
      controls.hidden = false;
      document.getElementById('cloud-account-label').textContent = '@' + data.user.login;
      document.getElementById('cloud-account-label').title = data.user.displayName || data.user.login;
      document.getElementById('cloud-admin-link').hidden = !['owner', 'admin'].includes(data.user.role);
    } catch { /* A temporary network loss must not erase local album edits. */ }
    finally { checking = false; }
  }
  document.getElementById('cloud-logout').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      if (!csrf) await checkAccess();
      const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf } });
      if (response.ok || response.status === 401 || response.status === 403) location.replace('/login');
      else throw new Error('Logout failed');
    } catch { button.disabled = false; button.textContent = '退出失败，点此重试'; }
  });
  window.addEventListener('pageshow', checkAccess);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAccess(); });
  window.setInterval(() => { if (!document.hidden) checkAccess(); }, 60000);
  checkAccess();
})();
