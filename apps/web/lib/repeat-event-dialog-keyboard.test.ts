import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleRepeatEventDialogKeyboard,
  restoreRepeatEventDialogFocus,
} from './repeat-event-dialog-keyboard.ts';

function setup() {
  const focused: string[] = [];
  const first = {
    focus: () => { focused.push('first'); },
    isConnected: true,
  } as unknown as HTMLElement;
  const last = {
    focus: () => { focused.push('last'); },
    isConnected: true,
  } as unknown as HTMLElement;
  const prevented: string[] = [];
  const closed: string[] = [];
  const event = (key: string, shiftKey = false) => ({
    key,
    shiftKey,
    preventDefault: () => prevented.push(key),
  });
  return { first, last, focused, prevented, closed, event };
}

test('repeat-event dialog closes on Escape', () => {
  const state = setup();
  handleRepeatEventDialogKeyboard(
    state.event('Escape'),
    [state.first, state.last],
    state.first,
    () => state.closed.push('close'),
  );
  assert.deepEqual(state.prevented, ['Escape']);
  assert.deepEqual(state.closed, ['close']);
});

test('repeat-event dialog traps Tab in both directions', () => {
  const state = setup();
  handleRepeatEventDialogKeyboard(
    state.event('Tab'),
    [state.first, state.last],
    state.last,
    () => state.closed.push('close'),
  );
  handleRepeatEventDialogKeyboard(
    state.event('Tab', true),
    [state.first, state.last],
    state.first,
    () => state.closed.push('close'),
  );
  assert.deepEqual(state.focused, ['first', 'last']);
  assert.deepEqual(state.prevented, ['Tab', 'Tab']);
  assert.deepEqual(state.closed, []);
});

test('repeat-event dialog returns focus to its opener only while it exists', () => {
  const state = setup();
  restoreRepeatEventDialogFocus(state.first);
  restoreRepeatEventDialogFocus({
    focus: () => { state.focused.push('removed'); },
    isConnected: false,
  } as unknown as HTMLElement);
  assert.deepEqual(state.focused, ['first']);
});
