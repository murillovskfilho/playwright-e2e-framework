// Shared helpers for every page.
const STATUS_LABELS = {
  LABEL_CREATED: 'Label created',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** fetch wrapper: JSON in/out, and any 401 sends the user to the login page. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
  });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error('unauthenticated');
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

/** Loads the current user and renders the top bar. Resolves to { user, permissions }. */
async function bootstrapPage() {
  const { body } = await api('/api/me');
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `
    <a class="brand" href="/">ShipDesk</a>
    <span data-testid="current-user">${escapeHtml(body.user.name)}</span>
    <span class="badge" data-testid="current-role">${escapeHtml(body.user.role)}</span>
    <button type="button" class="secondary" id="sign-out">Sign out</button>`;
  document.body.prepend(header);
  header.querySelector('#sign-out').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.assign('/login');
  });
  return body;
}
