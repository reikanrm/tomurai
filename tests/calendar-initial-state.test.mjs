import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Wiring regression only; actual opening, selection and return paths are also
// checked in the local UI. This does not execute the React component.
test('death-date question uses the collapsed calendar default, keeping its value and upper bound', () => {
  const onboarding = readFileSync('apps/mobile/src/components/Onboarding.tsx', 'utf8');
  const field = readFileSync('apps/mobile/src/components/CalendarDateField.tsx', 'utf8');
  const call = onboarding.match(/<CalendarDateField\b[\s\S]*?\/>/)?.[0];
  assert.ok(call);
  assert.doesNotMatch(call, /\binitialOpen\b/);
  assert.match(call, /value=\{selected === 'unknown' \? '' : selected \?\? ''\}/);
  assert.match(call, /onChange=\{choose\}/);
  assert.match(call, /maxDate=\{question\.id === 'deathDate' \? today : undefined\}/);
  assert.match(call, /key=\{question\.id\}/);
  assert.match(field, /initialOpen = false/);
  assert.match(field, /const \[open, setOpen\] = useState\(initialOpen\)/);
  assert.match(field, /aria-expanded=\{open\} onPress=\{toggle\}/);
  assert.match(field, /\{open && <View style=\{s\.panel\}>/);
});
