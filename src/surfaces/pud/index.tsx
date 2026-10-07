import { getMode } from '../../shell/modes';
import { Placeholder } from '../Placeholder';

export default function Surface() {
  return <Placeholder mode={getMode('pud')} />;
}
