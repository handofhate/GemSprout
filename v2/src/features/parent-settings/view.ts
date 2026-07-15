import { type DemoAppState, type DemoFamilySettings, type DemoMember } from '../../app/local-demo-state';
import { type SubscriptionState } from '../../platform/subscriptions/revenuecat';
import { escapeHtml } from '../../ui/html';

export type ParentSettingsPage = 'main' | 'account' | 'notifications';

type RenderSettingsOptions = {
  page: ParentSettingsPage;
  showDevTools?: boolean;
  canReset?: boolean;
  subscription?: SubscriptionState;
};

export function renderParentSettings(state: DemoAppState, options: RenderSettingsOptions): string {
  if (options.page === 'account') return renderAccountSettings(state, options.subscription);
  if (options.page === 'notifications') return renderNotificationSettings(state.settings || {});
  return renderMainSettings(state, options);
}

function renderMainSettings(state: DemoAppState, options: RenderSettingsOptions): string {
  const settings = state.settings || {};
  const kids = state.members.filter(member => member.role !== 'parent' && !member.deleted);
  const splitHouseholdEnabled = kids.some(kid => Boolean(kid.splitHousehold?.enabled));
  const timezone = String(settings.familyTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix');
  const interestPeriod = String(settings.savingsInterestPeriod || 'monthly');
  const interestMode = String(settings.savingsInterestMode || 'kid_claim');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return `
    <div class="settings-subpane">
      <div class="settings-header">
        <button class="btn-back settings-back-btn" data-settings-close type="button">&larr;</button>
        <span class="settings-header-title"><i class="ph-duotone ph-gear-six" style="color:#426e58;font-size:1.1rem;vertical-align:middle"></i> Settings</span>
        <div class="settings-header-actions">
          <button class="btn btn-secondary btn-sm settings-header-btn" data-settings-add-user type="button">Add user</button>
          <button class="btn btn-secondary btn-sm settings-header-btn" data-settings-switch-user type="button">Switch user</button>
        </div>
      </div>
      <div class="settings-body">
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-sliders" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> General</span></div>
        <div class="card">
          ${renderToggleRow('Auto-approve tasks', 'Kids earn gems instantly without a final review - pre-approval photos still require manual approval', 'autoApprove', settings.autoApprove === true)}
          ${renderToggleRow('Hide unavailable tasks', 'Tasks outside their allowed time window will not show on kids screens', 'hideUnavailable', settings.hideUnavailable === true)}
          ${renderToggleRow('Hide redeemed recurring prizes', 'Daily, weekly, and monthly prizes disappear after they are redeemed until their next reset', 'showLockedRecurringPrizes', settings.showLockedRecurringPrizes === false, true)}
          ${renderToggleRow('Show UI hints', 'Bounce swipe hints and the quick actions button when a screen first opens', 'tooltipBounceEnabled', settings.tooltipBounceEnabled !== false)}
          <div class="form-group mb-0">
            <label class="form-label">Family timezone</label>
            <select data-settings-select="familyTimezone" style="width:100%">
              ${buildTimezoneOptions(timezone)}
            </select>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:4px">Used to determine "today" for all tasks and streaks - keeps devices in sync across time zones</div>
          </div>
          <button class="settings-link-row" data-settings-page="notifications" type="button">
            <div>
              <div class="settings-link-title"><i class="ph-duotone ph-bell" style="color:#6C63FF;font-size:0.9rem;vertical-align:middle"></i> Notifications</div>
              <div class="settings-link-sub">Approval alerts, interest day reminder</div>
            </div>
            <i class="ph-duotone ph-caret-right" style="color:var(--muted);font-size:1.1rem;flex-shrink:0"></i>
          </button>
          <button class="settings-link-row" data-settings-page="account" type="button">
            <div>
              <div class="settings-link-title"><i class="ph-duotone ph-shield-check" style="color:#6C63FF;font-size:0.9rem;vertical-align:middle"></i> Account &amp; Security</div>
              <div class="settings-link-sub">Sign-in, PIN, and lock settings</div>
            </div>
            <i class="ph-duotone ph-caret-right" style="color:var(--muted);font-size:1.1rem;flex-shrink:0"></i>
          </button>
        </div>

        <div style="height:14px"></div>
        <div class="section-row">
          <span class="section-title"><i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:1rem;vertical-align:middle"></i> Savings Banking</span>
          <label class="toggle"><input data-settings-toggle="savingsEnabled" type="checkbox" ${settings.savingsEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
        </div>
        <div class="card">
          <p style="font-size:0.85rem;color:var(--muted);margin-bottom:${settings.savingsEnabled !== false ? '14' : '0'}px">Kids can convert gems into real savings</p>
          ${settings.savingsEnabled !== false ? `
            <div class="form-group">
              <label class="form-label">Gems per dollar <span class="form-label-hint">conversion rate</span></label>
              <input data-settings-number="diamondsPerDollar" type="number" value="${Number(settings.diamondsPerDollar || 10)}" min="1">
            </div>
            ${renderToggleRow('Savings matching', 'Parents match a percentage of what kids save', 'savingsMatchingEnabled', settings.savingsMatchingEnabled === true)}
            ${settings.savingsMatchingEnabled ? `
              <div class="form-group mt-8">
                <label class="form-label">Match percentage <span class="form-label-hint">% of amount saved</span></label>
                <input data-settings-number="savingsMatchPercent" type="number" value="${Number(settings.savingsMatchPercent || 50)}" min="1" max="200">
              </div>
            ` : ''}
            ${renderToggleRow('Add interest', 'Kids claim their interest as a reward on interest day', 'savingsInterestEnabled', settings.savingsInterestEnabled === true)}
            ${settings.savingsInterestEnabled ? `
              <div class="form-group mb-0" style="margin-top:8px">
                <label class="form-label">Interest claim mode</label>
                <select data-settings-select="savingsInterestMode">
                  <option value="kid_claim" ${interestMode === 'kid_claim' ? 'selected' : ''}>Kid claim</option>
                  <option value="auto_claim" ${interestMode === 'auto_claim' ? 'selected' : ''}>Auto-claim</option>
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                <div class="form-group mb-0">
                  <label class="form-label">Interest rate %</label>
                  <input data-settings-decimal="savingsInterestRate" type="number" value="${Number(settings.savingsInterestRate || 5)}" min="0.1" max="100" step="0.1">
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Period</label>
                  <select data-settings-select="savingsInterestPeriod">
                    <option value="weekly" ${interestPeriod === 'weekly' ? 'selected' : ''}>Weekly</option>
                    <option value="monthly" ${interestPeriod === 'monthly' ? 'selected' : ''}>Monthly</option>
                  </select>
                </div>
                ${interestPeriod === 'weekly' ? `
                  <div class="form-group mb-0" style="grid-column:1/-1">
                    <label class="form-label">Available on</label>
                    <select data-settings-select="savingsInterestDay">
                      ${dayNames.map((day, index) => `<option value="${index}" ${Number(settings.savingsInterestDay || 1) === index ? 'selected' : ''}>${day}</option>`).join('')}
                    </select>
                  </div>
                ` : `
                  <div class="form-group mb-0" style="grid-column:1/-1">
                    <label class="form-label">Available on day of month <span class="form-label-hint">1-28</span></label>
                    <input data-settings-number="savingsInterestDayOfMonth" type="number" value="${Number(settings.savingsInterestDayOfMonth || 1)}" min="1" max="28">
                  </div>
                `}
              </div>
            ` : ''}
          ` : ''}
        </div>

        <div id="settings-family-anchor" style="height:14px"></div>
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-users-three" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Family</span></div>
        <div class="card">
          ${kids.length ? kids.map(kid => renderFamilyRow(kid, settings)).join('') : '<div class="empty-state"><div class="empty-text">No kids yet</div></div>'}
          <div class="toggle-row" style="margin-top:14px">
            <div>
              <div class="toggle-label">Split household</div>
              <div class="toggle-sub">Streaks skip days kids are at the other household</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <button class="btn btn-secondary btn-sm" data-settings-configure-split type="button" style="${splitHouseholdEnabled ? '' : 'visibility:hidden;pointer-events:none;'}">Configure</button>
              <label class="toggle"><input data-settings-split-household type="checkbox" ${splitHouseholdEnabled ? 'checked' : ''}><span class="toggle-track"></span></label>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-full" style="margin-top:14px" data-settings-edit-family type="button">Edit Family Setup</button>
        </div>

        <div style="height:14px"></div>
        <div class="section-row">
          <span class="section-title"><i class="ph-duotone ph-speaker-slash" style="color:#EF4444;font-size:1rem;vertical-align:middle"></i> You're Not Listening</span>
          <label class="toggle"><input data-settings-toggle="notListeningEnabled" type="checkbox" ${settings.notListeningEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
        </div>
        <div class="card">
          ${settings.notListeningEnabled !== false ? `
            <div class="form-group mb-0">
              <label class="form-label">Seconds per gem lost</label>
              <input data-settings-number="notListeningSecs" type="number" value="${Number(settings.notListeningSecs || 60)}" min="1">
              <div style="font-size:0.78rem;color:var(--muted);margin-top:4px">Adds a hold-to-track button on the dashboard that deducts gems for not listening - seconds accumulate indefinitely, leftovers carry over until a full interval is reached</div>
            </div>
          ` : ''}
        </div>

        <div style="height:4px"></div>
        <button class="settings-link-row settings-whats-new-link" data-settings-whats-new type="button">
          <div>
            <div class="settings-link-title"><i class="ph-duotone ph-newspaper" style="color:#6C63FF;font-size:0.9rem;vertical-align:middle"></i> What's New</div>
            <div class="settings-link-sub">See recent updates and release notes</div>
          </div>
          <i class="ph-duotone ph-caret-right" style="color:var(--muted);font-size:1.1rem;flex-shrink:0"></i>
        </button>
        <button style="display:block;width:100%;border:none;background:transparent;text-align:center;color:var(--muted);font-size:0.78rem;padding:16px 0 8px;cursor:pointer" data-settings-dev-unlock type="button">GemSprout v2</button>

        ${(options.showDevTools || options.canReset) ? `
          <div style="height:14px"></div>
          <div class="section-row"><span class="section-title"><i class="ph-duotone ph-terminal" style="font-size:1rem;vertical-align:middle"></i> Dev Settings</span></div>
          <div class="card settings-dev-card">
            ${options.canReset ? `
              <details class="settings-dev-section" open>
                <summary class="settings-dev-section-title">
                  <span class="settings-dev-summary-main"><i class="ph-duotone ph-arrow-counter-clockwise" style="vertical-align:middle;margin-right:4px"></i> Local Demo</span>
                  <i class="ph-duotone ph-caret-down settings-dev-caret" style="font-size:1rem"></i>
                </summary>
                <div class="settings-dev-section-body">
                  <div class="settings-dev-tip">Reset the shared local test data</div>
                  <button class="btn btn-secondary btn-full" data-settings-reset type="button">Reset Local State</button>
                </div>
              </details>
            ` : ''}
            ${options.showDevTools ? `
              <details class="settings-dev-section" data-dev-section="push-notifications" open>
                <summary class="settings-dev-section-title">
                  <span class="settings-dev-summary-main"><i class="ph-duotone ph-bell" style="vertical-align:middle;margin-right:4px"></i> Push Diagnostics</span>
                  <i class="ph-duotone ph-caret-down settings-dev-caret" style="font-size:1rem"></i>
                </summary>
                <div class="settings-dev-section-body">
                  <div class="settings-dev-tip">Use this on device to verify auth, family, Firebase project, notification permission, and token save state.</div>
                  <button class="btn btn-secondary btn-full" data-settings-dev-push-permission type="button">Request Permission</button>
                  <button class="btn btn-secondary btn-full" data-settings-dev-push-token type="button">Register and Show FCM Token</button>
                  <button class="btn btn-secondary btn-full" data-settings-dev-push-diagnostics type="button">Push Diagnostics</button>
                  <button class="btn btn-secondary btn-full" data-settings-dev-write-probe type="button">Firestore Write Probe</button>
                </div>
              </details>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderAccountSettings(state: DemoAppState, subscription?: SubscriptionState): string {
  const settings = state.settings || {};
  const parent = state.members.find(member => member.role === 'parent') || null;
  const providers = parent?.authProviders || [];
  const google = providers.find(provider => provider.providerId === 'google.com');
  const apple = providers.find(provider => provider.providerId === 'apple.com');
  const linkedCount = providers.filter(provider => provider.providerId && provider.providerId !== 'dev-bypass').length;
  const anyLinked = linkedCount > 0;
  const pinSet = !!settings.parentPin;
  const biometricId = getBiometricCredentialIdForSettings();
  const biometricLabel = getBiometricLabelForSettings();
  return `
    <div class="settings-subpane">
      <div class="settings-header">
        <button class="btn-back settings-back-btn" data-settings-back="main" type="button">&larr;</button>
        <span class="settings-header-title"><i class="ph-duotone ph-shield-check" style="color:#6C63FF;font-size:1.1rem;vertical-align:middle"></i> Account &amp; Security</span>
        <div class="settings-header-spacer"></div>
      </div>
      <div class="settings-body">
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-user-circle" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Sign-In</span></div>
        <div class="card">
          ${renderProviderRow('Google', google?.email || (google ? 'Linked' : 'Not linked'), 'google', !!google, linkedCount)}
          ${renderProviderRow('Apple', apple?.email || (apple ? 'Linked' : 'Not linked'), 'apple', !!apple, linkedCount)}
          ${anyLinked && linkedCount === 1 ? `<div style="font-size:0.82rem;color:var(--muted);margin-top:4px">At least one sign-in method must stay linked.</div>` : ''}
          ${!anyLinked ? `<div style="font-size:0.82rem;color:var(--muted);margin-top:4px">Sign in with Google or Apple to enable push notifications and secure your profile</div>` : ''}
          <div style="font-size:0.78rem;color:var(--muted);margin-top:10px;text-align:center">Last synced: ${settings.lastSync ? formatSettingsDateTime(Number(settings.lastSync)) : 'Not yet'}</div>
        </div>

        <div style="height:14px"></div>
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-lock-key" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> PIN &amp; Biometric</span></div>
        <div class="card">
          <div class="form-group">
            <label class="form-label">Parent PIN &amp; ${escapeHtml(biometricLabel)}</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" data-settings-pin type="button">${pinSet ? 'Reset PIN' : 'Set PIN'}</button>
              ${biometricId
                ? `<button class="btn btn-secondary btn-sm" data-settings-biometric-remove type="button"><i class="ph-duotone ph-fingerprint" style="font-size:1rem;vertical-align:middle"></i> Remove ${escapeHtml(biometricLabel)}</button>`
                : `<button class="btn btn-secondary btn-sm" data-settings-biometric type="button"><i class="ph-duotone ph-fingerprint" style="font-size:1rem;vertical-align:middle"></i> Set Up ${escapeHtml(biometricLabel)}</button>`}
            </div>
          </div>
          ${(pinSet || biometricId || settings.lockOnBackground) ? `
            <div class="toggle-row" style="margin-top:4px">
              <div>
                <div class="toggle-label">Lock when leaving app</div>
                <div class="toggle-sub">Require PIN or ${escapeHtml(biometricLabel)} each time the app is opened or returns from the background</div>
              </div>
              <label class="toggle"><input data-settings-toggle="lockOnBackground" type="checkbox" ${settings.lockOnBackground ? 'checked' : ''}><span class="toggle-track"></span></label>
            </div>
          ` : ''}
        </div>

        <div style="height:14px"></div>
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-crown-simple" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Subscription</span></div>
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div>
              <div class="settings-provider-title">GemSprout Pro</div>
              <div class="settings-provider-sub">${subscription?.isPro ? 'Active' : 'No active subscription'}</div>
            </div>
            ${subscription?.isPro ? `<span class="settings-status-pill active">Active</span>` : `<span class="settings-status-pill inactive">Inactive</span>`}
          </div>
          ${subscription?.isPro
            ? `<button class="btn btn-secondary btn-sm btn-full" data-settings-manage-subscription type="button">Manage Subscription</button>`
            : `<button class="btn btn-primary btn-sm btn-full" data-settings-subscribe type="button">Subscribe</button>`}
          <button class="btn btn-secondary btn-sm btn-full" style="margin-top:8px" data-settings-restore-purchases type="button">Restore Purchases</button>
        </div>

        <div style="height:14px"></div>
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-warning" style="color:#EF4444;font-size:1rem;vertical-align:middle"></i> Danger Zone</span></div>
        <div class="card settings-danger-card">
          <button class="btn btn-danger btn-sm" data-settings-join-different style="width:100%;margin-bottom:8px" type="button">Join Different Family</button>
          <div style="font-size:0.78rem;color:var(--muted);margin-bottom:12px">Clears local device data and connects you to a different family.</div>
          <button class="btn btn-danger btn-sm" data-settings-reset style="width:100%;margin-bottom:8px" type="button">Reset All Data</button>
          <div style="font-size:0.78rem;color:var(--muted);margin-bottom:12px">Permanently deletes all family data including tasks, prizes, history, and member profiles. This cannot be undone.</div>
          <button class="btn btn-danger btn-sm" data-settings-delete-account style="width:100%" type="button"><i class="ph-duotone ph-user-minus" style="vertical-align:middle;margin-right:6px"></i> Delete Account</button>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:8px">Permanently deletes your account and all associated data. This cannot be undone.</div>
        </div>
      </div>
    </div>
  `;
}

function renderNotificationSettings(settings: DemoFamilySettings): string {
  const interestOn = settings.savingsEnabled !== false && settings.savingsInterestEnabled;
  return `
    <div class="settings-subpane">
      <div class="settings-header">
        <button class="btn-back settings-back-btn" data-settings-back="main" type="button">&larr;</button>
        <span class="settings-header-title"><i class="ph-duotone ph-bell" style="color:#6C63FF;font-size:1.1rem;vertical-align:middle"></i> Notifications</span>
        <div class="settings-header-spacer"></div>
      </div>
      <div class="settings-body">
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-device-mobile" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Push Notifications</span></div>
        <div class="card">
          ${renderToggleRow('Task approval requests', 'Sends a notification when a kid marks a task complete and it is waiting for review', 'notifyChoreApproval', settings.notifyChoreApproval !== false)}
          ${renderToggleRow('Savings spend requests', settings.savingsEnabled === false ? 'Enable Savings Banking to use this' : 'Sends a notification when a kid requests to spend from their savings', 'notifySavingsSpend', settings.notifySavingsSpend !== false, false, settings.savingsEnabled === false)}
        </div>

        <div style="height:14px"></div>
        <div class="section-row"><span class="section-title"><i class="ph-duotone ph-clock" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Scheduled Reminders</span></div>
        <div class="card">
          ${renderToggleRow('Interest day reminder', interestOn ? 'Reminds you on interest day to have kids open the app and claim their interest' : 'Enable Savings Interest to use this', 'interestDayNotify', settings.interestDayNotify !== false, false, !interestOn)}
        </div>
      </div>
    </div>
  `;
}

function renderToggleRow(label: string, sub: string, key: string, checked: boolean, invert = false, disabled = false): string {
  const isChecked = invert ? !checked : checked;
  return `
    <div class="toggle-row" ${disabled ? 'style="opacity:0.4;pointer-events:none"' : ''}>
      <div>
        <div class="toggle-label">${escapeHtml(label)}</div>
        <div class="toggle-sub">${escapeHtml(sub)}</div>
      </div>
      <label class="toggle"><input data-settings-toggle="${escapeHtml(key)}" ${invert ? 'data-settings-invert="1"' : ''} type="checkbox" ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="toggle-track"></span></label>
    </div>
  `;
}

function renderFamilyRow(member: DemoMember, settings: DemoFamilySettings): string {
  const currency = String(settings.currency || '$');
  const todayKey = todayKeyForSettings(settings);
  const isHereToday = isMemberHereOnDateForSettings(member, todayKey);
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #F3F4F6">
      <span style="font-size:1.6rem">${renderSettingsMemberAvatar(member)}</span>
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(String(member.name || 'Kid'))}</div>
        <div style="font-size:0.78rem;color:var(--muted)">${Number(member.gems || member.diamonds || 0)} gems${settings.savingsEnabled !== false ? ` &middot; ${currency}${Number(member.savings || 0).toFixed(2)} <i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:0.85rem;vertical-align:middle"></i>` : ''}</div>
      </div>
      <div style="display:flex;gap:5px">
        <button class="btn btn-sm" data-member-presence="${escapeHtml(String(member.id || ''))}:home" type="button" style="background:${isHereToday ? 'var(--green)' : '#F3F4F6'};color:${isHereToday ? '#fff' : 'var(--text)'}">Home</button>
        <button class="btn btn-sm" data-member-presence="${escapeHtml(String(member.id || ''))}:away" type="button" style="background:${!isHereToday ? '#EF4444' : '#F3F4F6'};color:${!isHereToday ? '#fff' : 'var(--text)'}">Away</button>
      </div>
    </div>
  `;
}

function todayKeyForSettings(settings: DemoFamilySettings): string {
  const timezone = String(settings.familyTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isMemberHereOnDateForSettings(member: DemoMember, dateKey: string): boolean {
  const split = member.splitHousehold;
  if (split?.overrides && dateKey in split.overrides) return split.overrides[dateKey] !== false;
  if (!split?.enabled) return member.isHereToday !== false;
  const reference = new Date(`${split.referenceMonday || dateKey}T00:00:00`);
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((date.getTime() - reference.getTime()) / 86400000);
  const pos = ((diff % 14) + 14) % 14;
  return split.cycle?.[pos] !== false;
}

function renderSettingsMemberAvatar(member: DemoMember): string {
  const rawAvatar = String(member.avatar || member.icon || 'ph-smiley');
  const color = String(member.avatarColor || member.color || '#9CA3AF');
  if (/\.(png|jpe?g|gif|webp)$/i.test(rawAvatar)) {
    return `<img src="${escapeHtml(rawAvatar)}" class="avatar-img" alt="">`;
  }
  if (rawAvatar.includes('<i') || rawAvatar.includes('<img')) {
    if (/color\s*:/i.test(rawAvatar)) return rawAvatar.replace(/color\s*:\s*[^;"']+/i, `color:${escapeHtml(color)}`);
    return rawAvatar.replace(/<i\b/i, `<i style="color:${escapeHtml(color)}"`);
  }
  const icon = rawAvatar.replace(/^ph-/, '');
  return `<i class="ph-duotone ph-${escapeHtml(icon)}" style="color:${escapeHtml(color)}"></i>`;
}

function renderProviderRow(title: string, sub: string, provider: 'google' | 'apple', linked: boolean, linkedCount: number): string {
  return `
    <div class="settings-provider-row">
      <div class="settings-provider-main">
        ${provider === 'google' ? googleProviderIcon() : appleProviderIcon()}
        <div>
          <div class="settings-provider-title" style="${linked ? '' : 'color:var(--muted)'}">${escapeHtml(title)}</div>
          <div class="settings-provider-sub">${escapeHtml(sub)}</div>
        </div>
      </div>
      ${linked
        ? linkedCount === 1
          ? `<button class="btn btn-secondary btn-sm" style="color:#A16207;border-color:#D6B06A" data-settings-provider-switch="${provider}" type="button">Switch Account</button>`
          : `<button class="btn btn-secondary btn-sm" style="color:#EF4444;border-color:#EF4444" data-settings-provider-unlink="${provider}" type="button">Unlink</button>`
        : `<button class="btn btn-secondary btn-sm" data-settings-provider-link="${provider}" type="button">Sign In</button>`}
    </div>
  `;
}

function googleProviderIcon(): string {
  return `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:22px;height:22px;flex-shrink:0" alt="">`;
}

function appleProviderIcon(): string {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="#000" style="flex-shrink:0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>`;
}

function getBiometricCredentialIdForSettings(): string {
  try {
    return window.localStorage.getItem('gemsprout.v2.biometricCredentialId') || '';
  } catch {
    return '';
  }
}

function getBiometricLabelForSettings(): string {
  return /iPad|iPhone|Mac/i.test(navigator.userAgent) ? 'Face ID / Touch ID' : 'Biometric';
}

function formatSettingsDateTime(value: number): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function buildTimezoneOptions(selected: string): string {
  const defaults = ['America/Phoenix', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York'];
  const zones = Array.from(new Set([selected, ...defaults]));
  return zones.map(zone => `<option value="${escapeHtml(zone)}" ${zone === selected ? 'selected' : ''}>${escapeHtml(zone.replace(/_/g, ' '))}</option>`).join('');
}
