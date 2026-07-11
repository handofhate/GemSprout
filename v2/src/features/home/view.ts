import { type DemoAppState, type DemoMember } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';

export function renderLandingScreen(): string {
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 460px)">
        <img src="/gemsprout.png" class="setup-gate-mark loading-img" alt="GemSprout">
        <div style="color:#24453c;font-size:1.6rem;font-weight:800;margin-bottom:6px;text-align:center">Welcome to GemSprout</div>
        <div style="color:#5f746a;font-size:0.95rem;margin-bottom:24px;text-align:center;max-width:320px">An easy to use family system for rewards, savings, and shared goals</div>
        <div class="setup-gate-actions">
          <button class="setup-gate-btn setup-gate-btn-primary" data-landing-action="start" type="button">
            <i class="ph-duotone ph-sparkle" style="vertical-align:middle"></i> Get Started
          </button>
          <button class="setup-gate-btn setup-gate-btn-primary" data-landing-action="signin" type="button">
            <i class="ph-duotone ph-sign-in" style="vertical-align:middle"></i> Sign In
          </button>
          <button class="setup-gate-btn setup-gate-btn-primary" data-landing-action="kid" type="button">
            <i class="ph-duotone ph-smiley" style="vertical-align:middle"></i> I'm a Kid
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderReturningSignInScreen(message = ''): string {
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 460px)">
        <img src="/gemsprout.png" class="setup-gate-mark loading-img" alt="GemSprout">
        <div style="color:#24453c;font-size:1.6rem;font-weight:800;margin-bottom:6px;text-align:center">Welcome back!</div>
        <div style="color:#5f746a;font-size:0.95rem;margin-bottom:24px;text-align:center;max-width:320px">Sign in to access your family on this device</div>
        <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px">
          <button class="btn" style="background:#fff;color:#333;font-size:1rem;padding:14px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;justify-content:center;font-weight:600;border:1px solid rgba(39,66,57,0.14)" data-signin-provider="google" type="button">
            ${googleIcon()}
            Continue with Google
          </button>
          <button class="btn" style="background:#000;color:#fff;font-size:1rem;padding:14px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;justify-content:center;font-weight:600;border:none" data-signin-provider="apple" type="button">
            ${appleIcon('#fff')}
            Continue with Apple&nbsp;
          </button>
          <button class="btn btn-secondary" style="font-size:0.9rem;padding:12px 16px;border-radius:12px" data-signin-provider="dev-bypass" type="button">
            <i class="ph-duotone ph-code" style="font-size:1rem"></i>
            Dev bypass login
          </button>
        </div>
        ${message ? `<div style="margin:14px auto 0;max-width:320px;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;padding:10px 12px;font-size:0.82rem;line-height:1.4;text-align:center">${escapeHtml(message)}</div>` : ''}
        <button style="margin-top:16px;background:none;border:none;color:#3f5d52;font-size:0.85rem;cursor:pointer" data-signin-back type="button"><i class="ph-duotone ph-arrow-left" style="font-size:0.95rem;vertical-align:middle"></i> Back</button>
      </div>
    </div>
  `;
}

export function renderSignInNotFoundScreen(): string {
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 460px)">
        <img src="/gemsprout.png" class="setup-gate-mark loading-img" alt="GemSprout">
        <div style="color:#24453c;font-size:1.6rem;font-weight:800;margin-bottom:6px;text-align:center">No family found</div>
        <div style="color:#5f746a;font-size:0.95rem;margin-bottom:24px;text-align:center;max-width:320px;line-height:1.5">This account isn't linked to a GemSprout family yet. Go back and tap <strong>Get Started</strong> to create one, or make sure you're signing in with the same account your family invite was sent to.</div>
        <div class="setup-gate-actions">
          <button class="setup-gate-btn setup-gate-btn-primary" data-signin-start type="button">
            <i class="ph-duotone ph-sparkle" style="vertical-align:middle"></i> Get Started
          </button>
          <button class="setup-gate-btn setup-gate-btn-secondary" data-signin-back type="button">
            <i class="ph-duotone ph-arrow-left" style="vertical-align:middle"></i> Back
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderKidEntryScreen(message = ''): string {
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 460px)">
        <img src="/gemsprout.png" class="setup-gate-mark loading-img" alt="GemSprout">
        <div style="color:#24453c;font-size:1.6rem;font-weight:800;margin-bottom:6px;text-align:center">I'm a Kid</div>
        <div style="color:#5f746a;font-size:0.95rem;margin-bottom:24px;text-align:center;max-width:320px">Enter your family code or scan the QR code from your parent.</div>
        <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px">
          <input data-kid-family-code type="text" inputmode="text" autocomplete="one-time-code" maxlength="6" placeholder="ABC123" style="text-align:center;text-transform:uppercase;letter-spacing:0.18em;font-size:1.35rem;font-weight:900;color:#4C1D95;padding:14px 16px;border:1.5px solid #E5E7EB;border-radius:14px;background:#fff">
          <button class="btn btn-primary" data-kid-join type="button">
            <i class="ph-duotone ph-sign-in" style="vertical-align:middle"></i> Join Family
          </button>
          <button class="btn btn-secondary" data-kid-scan type="button">
            <i class="ph-duotone ph-qr-code" style="vertical-align:middle"></i> Scan QR Code
          </button>
          <button class="btn btn-secondary" data-kid-dev type="button">
            <i class="ph-duotone ph-code" style="vertical-align:middle"></i> Dev enter as kid
          </button>
        </div>
        ${message ? `<div style="margin:14px auto 0;max-width:320px;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;padding:10px 12px;font-size:0.82rem;line-height:1.4;text-align:center">${escapeHtml(message)}</div>` : ''}
        <button style="margin-top:16px;background:none;border:none;color:#3f5d52;font-size:0.85rem;cursor:pointer" data-kid-back type="button"><i class="ph-duotone ph-arrow-left" style="font-size:0.95rem;vertical-align:middle"></i> Back</button>
      </div>
    </div>
  `;
}

export function renderKidMemberSelectScreen(members: DemoMember[], message = ''): string {
  const kids = members.filter(member => member.role !== 'parent' && !member.deleted);
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 520px)">
        <img src="/gemsprout.png" class="setup-gate-mark loading-img" alt="GemSprout">
        <div style="color:#24453c;font-size:1.6rem;font-weight:800;margin-bottom:6px;text-align:center">Who are you?</div>
        <div style="color:#5f746a;font-size:0.95rem;margin-bottom:20px;text-align:center;max-width:320px">Choose your profile to open your dashboard.</div>
        <div class="profile-grid" style="padding:0;width:100%">
          ${kids.map(member => `
            <button class="profile-card" style="--member-color:${escapeHtml(String(member.color || '#6C63FF'))};position:relative" data-kid-select="${escapeHtml(String(member.id || ''))}" type="button">
              <span class="profile-avatar">${renderMemberAvatar(member)}</span>
              <span class="profile-name">${escapeHtml(String(member.name || 'Kid'))}</span>
              <span class="profile-diamonds">Kid</span>
            </button>
          `).join('')}
        </div>
        ${message ? `<div style="margin:14px auto 0;max-width:320px;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;padding:10px 12px;font-size:0.82rem;line-height:1.4;text-align:center">${escapeHtml(message)}</div>` : ''}
        <button style="margin-top:16px;background:none;border:none;color:#3f5d52;font-size:0.85rem;cursor:pointer" data-kid-back type="button"><i class="ph-duotone ph-arrow-left" style="font-size:0.95rem;vertical-align:middle"></i> Back</button>
      </div>
    </div>
  `;
}

export function renderKidQrScannerScreen(): string {
  return `
    <div class="setup-gate-shell">
      <div class="setup-gate-card" style="width:min(calc(100% - 44px), 460px)">
        <div style="width:220px;height:220px;border:3px solid rgba(76,29,149,0.42);border-radius:18px;box-shadow:0 0 0 999px rgba(39,66,57,0.08);margin-bottom:22px;display:flex;align-items:center;justify-content:center;color:#4C1D95;font-size:3rem">
          <i class="ph-duotone ph-qr-code"></i>
        </div>
        <div style="color:#24453c;font-size:1.4rem;font-weight:800;margin-bottom:6px;text-align:center">Point at the QR code</div>
        <div style="color:#5f746a;font-size:0.92rem;margin-bottom:20px;text-align:center;max-width:320px">Camera scanning will use the native adapter on device. For now, enter the family code manually.</div>
        <button class="setup-gate-btn setup-gate-btn-primary" data-kid-back type="button">Enter Code Instead</button>
      </div>
    </div>
  `;
}

export function renderHomeScreen(state: DemoAppState): string {
  const members = state.members
    .filter(member => !member.deleted)
    .sort((left, right) => {
      const roleOrder = left.role === right.role ? 0 : left.role === 'parent' ? -1 : 1;
      if (roleOrder !== 0) return roleOrder;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });
  const familyName = String(state.familyName || 'GemSprout Family');
  const familyStem = familyName.replace(/\s+Family$/i, '').trim() || familyName;
  const kids = members.filter(member => member.role !== 'parent');
  const currency = String(state.settings.currency || '$');
  const totalGems = kids.reduce((sum, kid) => sum + Number(kid.gems || kid.diamonds || 0), 0);
  const totalSavings = kids.reduce((sum, kid) => sum + Number(kid.savings || 0), 0);
  const pendingCount = state.requests.filter(request => request.status === 'pending').length;
  return `
    <div class="home-shell">
      <div class="home-top">
        <div class="home-top-inner">
          <div class="home-hero">
            <div class="home-hero-copy">
              <div class="home-kicker"><i class="ph-duotone ph-leaf" style="font-size:1rem"></i> Family Space</div>
              <div class="home-family-stack">
                <div class="home-family-line home-family-line-top">The</div>
                <div class="home-family-line home-family-line-name">${escapeHtml(familyStem)}</div>
                <div class="home-family-line home-family-line-bottom">Family</div>
              </div>
            </div>
            <img class="home-logo" src="/gemsprout.png" alt="GemSprout">
            <div class="home-hero-meta">
              <div class="home-subtitle">Choose who is using GemSprout right now.</div>
              <div class="home-pill-row">
                <div class="home-pill"><i class="ph-duotone ph-sketch-logo" style="font-size:1rem"></i> ${totalGems} gems</div>
                <div class="home-pill"><i class="ph-duotone ph-piggy-bank" style="font-size:1rem"></i> ${currency}${totalSavings.toFixed(2)} saved</div>
                <div class="home-pill"><i class="ph-duotone ph-clock-countdown" style="font-size:1rem"></i> ${pendingCount} pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="home-bottom">
        <div class="home-bottom-inner">
          <div class="home-lower">
            <div class="home-member-list">
              <div class="profile-grid">
                ${members.map(renderProfileCard).join('')}
              </div>
            </div>
          </div>
          <div class="home-footer">
            <button class="home-footer-btn" data-home-edit-family type="button">
              <i class="ph-duotone ph-gear-six" style="font-size:1rem"></i>
              Edit Family
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProfileCard(member: DemoMember): string {
  const roleLabel = member.role === 'parent' ? 'Parent' : 'Kid';
  return `
    <button class="profile-card" style="--member-color:${escapeHtml(String(member.color || '#6C63FF'))};position:relative" data-select-viewer="${escapeHtml(String(member.id || ''))}" type="button">
      <span class="profile-avatar">${renderMemberAvatar(member)}</span>
      <span class="profile-name">${escapeHtml(String(member.name || 'User'))}</span>
      <span class="profile-diamonds">${roleLabel}</span>
    </button>
  `;
}

function renderMemberAvatar(member: DemoMember): string {
  const rawAvatar = String(member.avatar || member.icon || 'smiley');
  const color = String(member.avatarColor || member.color || '#6C63FF');
  if (/\.(png|jpe?g|gif|webp)$/i.test(rawAvatar)) {
    return `<img src="${escapeHtml(rawAvatar)}" class="avatar-img" alt="">`;
  }
  if (rawAvatar.includes('<i') || rawAvatar.includes('<img')) {
    if (/color\s*:/i.test(rawAvatar)) return rawAvatar.replace(/color\s*:\s*[^;"']+/i, `color:${escapeHtml(color)}`);
    return rawAvatar.replace(/<i\b/i, `<i style="color:${escapeHtml(color)}"`);
  }
  const avatar = rawAvatar.replace(/^ph-/, '');
  return `<i class="ph-duotone ph-${escapeHtml(avatar)}" style="color:${escapeHtml(color)}"></i>`;
}

function googleIcon(): string {
  return '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
}

function appleIcon(fill: string): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>`;
}
