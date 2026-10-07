import { Placeholder } from '../Placeholder';
import { getMode } from '../../shell/modes';

/** Back office shell: side nav, breadcrumb top bar, Ctrl K page search. */
export default function BackOffice() {
  return <Placeholder mode={getMode('backoffice')} />;
}
