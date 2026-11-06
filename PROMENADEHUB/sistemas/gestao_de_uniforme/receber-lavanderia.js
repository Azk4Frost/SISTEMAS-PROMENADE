import { loadLaundryReceiptItems, receiveUniformesFromLaundry } from '../../js/services/uniformes-service.js';
import { mountLaundrySelection } from '../../js/components/laundry-selection.js';

mountLaundrySelection({
  prefix: 'receipt', action: 'recebimento', dateKey: 'sentDate',
  load: loadLaundryReceiptItems, submit: receiveUniformesFromLaundry,
  onSummary(summary, context) {
    document.querySelector('#summary-returning').textContent = summary.pieces;
    const label = context?.connection === 'ready' ? context.afterReceiptStatus?.label : null;
    document.querySelector('#summary-after-status').textContent = typeof label === 'string' && label.trim() ? label : 'Não informado';
  }
});
