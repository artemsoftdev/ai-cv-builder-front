// The field may sit in a tab panel or section that only becomes visible after the next render.
export function focusFirstInvalidField(root: HTMLElement | null, framesLeft = 10): void {
  const field = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!field) return;
  if (!field.closest("[hidden]")) {
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ block: "center" });
    return;
  }
  if (framesLeft > 0) requestAnimationFrame(() => focusFirstInvalidField(root, framesLeft - 1));
}
