export function handleRepeatEventDialogKeyboard(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  focusable: readonly HTMLElement[],
  activeElement: Element | null,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function restoreRepeatEventDialogFocus(previous: HTMLElement | null): void {
  if (previous?.isConnected) previous.focus();
}
