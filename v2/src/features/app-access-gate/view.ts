import type { AppAccessGate } from '../../platform/remote-config/app-access';
import { Capacitor } from '@capacitor/core';

const APP_STORE_URL = 'https://apps.apple.com/us/app/gemsprout/id6760679496';

export function renderAppAccessGate(gate: AppAccessGate, onRetry: () => void): void {
  const screen = document.getElementById('screen-auth');
  if (!screen) return;

  screen.className = 'screen active access-gate';
  screen.replaceChildren();

  const panel = document.createElement('section');
  panel.className = 'access-gate__panel';

  const logo = document.createElement('img');
  logo.src = '/gemsprout.png';
  logo.alt = 'GemSprout';
  logo.className = 'access-gate__logo';

  const title = document.createElement('h1');
  title.className = 'access-gate__title';
  title.textContent = gate.title;

  const message = document.createElement('p');
  message.className = 'access-gate__message';
  message.textContent = gate.message;

  const button = document.createElement('button');
  button.className = 'btn btn-primary access-gate__button';
  button.type = 'button';
  button.textContent = gate.mode === 'maintenance' ? 'Check Again' : 'Update in the App Store';
  button.addEventListener('click', () => {
    if (gate.mode === 'maintenance') {
      button.disabled = true;
      button.textContent = 'Checking...';
      onRetry();
      return;
    }
    if (Capacitor.isNativePlatform()) window.open(APP_STORE_URL, '_system');
    else window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
  });

  panel.append(logo, title, message, button);
  screen.append(panel);
}
