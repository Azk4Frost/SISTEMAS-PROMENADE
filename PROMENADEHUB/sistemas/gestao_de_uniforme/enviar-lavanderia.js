import { loadLaundryDispatchItems, dispatchUniformesToLaundry } from '../../js/services/uniformes-service.js';
import { mountLaundrySelection } from '../../js/components/laundry-selection.js';

mountLaundrySelection({
  prefix: 'dispatch', action: 'envio', dateKey: 'loanDate',
  load: loadLaundryDispatchItems, submit: dispatchUniformesToLaundry
});
