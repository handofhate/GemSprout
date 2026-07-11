export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
}

export function statusPill(value: string | undefined): string {
  const status = value || 'missing';
  return `<span class="admin-status-pill admin-status-pill-progress">${escapeHtml(status).toUpperCase()}</span>`;
}
