import { type DemoAppState } from './local-demo-state';
import { escapeHtml, statusPill } from '../ui/html';
import { type LabScenarioResult } from './approval-lab-scenarios';

export type LabLog = {
  at: string;
  text: string;
};

function devMetric(label: string, value: string | number): string {
  return `<div class="dev-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

export function renderDevLab(state: DemoAppState, logs: LabLog[], lastScenario: LabScenarioResult | null): string {
  return `
    <details class="card dev-lab">
      <summary>
        <span><i class="ph-duotone ph-flask"></i> v2 Approval Lab</span>
        <span class="text-muted">local fake Firestore</span>
      </summary>
      <div class="dev-lab-grid">
        ${devMetric('Request', statusPill(state.request?.status))}
        ${devMetric('Completion', statusPill(state.completion?.status))}
        ${devMetric('Operation', statusPill(state.operation?.status))}
        ${devMetric('Gems', Number(state.member?.gems || 0))}
        ${devMetric('Savings', `$${Number(state.member?.savings || 0).toFixed(2)}`)}
        ${devMetric('History rows', state.historyRows.length)}
      </div>
      <div class="dev-lab-actions">
        <button class="btn btn-primary btn-sm" id="lab-approve-btn" type="button">Approve</button>
        <button class="btn btn-secondary btn-sm" id="lab-replay-btn" type="button">Replay</button>
        <button class="btn btn-secondary btn-sm" id="race-btn" type="button">Two Devices</button>
        <button class="btn btn-secondary btn-sm" id="prize-fail-btn" type="button">Prize Failure</button>
        <button class="btn btn-secondary btn-sm" id="stale-approved-btn" type="button">Stale Approved</button>
        <button class="btn btn-secondary btn-sm" id="stale-denied-btn" type="button">Stale Denied</button>
        <button class="btn btn-secondary btn-sm" id="savings-btn" type="button">Savings</button>
      </div>
      ${lastScenario ? `
        <div class="dev-lab-grid">
          ${devMetric('Scenario', escapeHtml(lastScenario.name))}
          ${devMetric('First applied', lastScenario.firstApplied ? 'yes' : 'no')}
          ${devMetric('Second duplicate', lastScenario.secondDuplicate ? 'yes' : 'no')}
          ${devMetric('Reason', escapeHtml(lastScenario.reason || 'none'))}
        </div>
      ` : ''}
      <div class="dev-log">
        ${logs.length ? logs.map(entry => `<div class="dev-log-row"><span>${escapeHtml(entry.at)}</span>${escapeHtml(entry.text)}</div>`).join('') : '<div class="dev-log-row"><span>ready</span>Seed loaded.</div>'}
      </div>
    </details>
  `;
}
