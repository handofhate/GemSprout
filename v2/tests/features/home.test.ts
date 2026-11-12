import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLandingScreen } from '../../src/features/home/view';

test('landing logo uses a path that works under the GitHub Pages project prefix', () => {
  const markup = renderLandingScreen();
  assert.match(markup, /src="gemsprout\.png"/);
  assert.doesNotMatch(markup, /src="\/gemsprout\.png"/);
});
