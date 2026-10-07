import { dinerPerson } from '../../../../domain/orders';
import type { Diner, Resident } from '../../../../domain/types';

/**
 * Whose allergies count for a diner's food. A guest's diner points at the
 * host resident (for billing and contacts), but the host's allergies are not
 * the guest's, so a guest has none on file.
 */
export function allergyPerson(d: Diner): Resident | undefined {
  if (d.isGuest) return undefined;
  return dinerPerson(d) as Resident | undefined;
}
