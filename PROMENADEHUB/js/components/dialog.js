/** Dialog nativo: foco contido, Escape e retorno ao elemento de origem. */
export function createNoticeDialog(dialog) {
  let trigger = null;
  let confirmAction = null;
  const close = () => dialog.close();
  dialog.querySelectorAll('.dialog-close, .dialog-cancel').forEach((button) => {
    button.addEventListener('click', close);
  });
  dialog.querySelector('.dialog-confirm').addEventListener('click', () => {
    const action = confirmAction;
    close();
    action?.();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter((node) => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (trigger?.isConnected) trigger.focus();
  });
  return {
    open({ title, description, origin, onConfirm = null, confirmLabel = 'Entendi', detail = 'Nenhuma operação foi realizada.' }) {
      trigger = origin ?? document.activeElement;
      confirmAction = onConfirm;
      dialog.querySelector('#dialog-title').textContent = title;
      dialog.querySelector('#dialog-description').textContent = description;
      dialog.querySelector('.dialog-detail').textContent = detail;
      dialog.querySelector('.dialog-confirm').textContent = confirmLabel;
      const cancelButton = dialog.querySelector('.dialog-cancel');
      if (cancelButton) cancelButton.hidden = !onConfirm;
      dialog.showModal();
      document.body.classList.add('dialog-open');
      dialog.querySelector('.dialog-confirm').focus();
    }
  };
}
