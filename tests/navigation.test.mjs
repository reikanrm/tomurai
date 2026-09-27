import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navigationIcons } from '../apps/mobile/src/data/navigation.ts';

test('bottom navigation uses the approved Iconoir names while preserving its four destinations', () => {
  assert.deepEqual(navigationIcons, { home: 'HomeSimple', tasks: 'TaskList', specialists: 'Community', care: 'Heart' });
});

test('the application renders decorative navigation through the shared 22px adapter', () => {
  const source = readFileSync(new URL('../apps/mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /<AppIcon\s+name=\{navigationIcons\[/);
  assert.match(source, /<AppIcon\s+name=\{navigationIcons\[[\s\S]*?size=\{22\}/);
  assert.doesNotMatch(source, /<Text[^>]*>[{]navigationIcons\[/);
});
