/**
 * Plan and hospice changes made from the Residents list or a resident's
 * page: the same store change, toast and Undo wherever they are made.
 */
import { flag, type DiningConfig } from '../../../../domain/config';
import { switchHospice } from '../../../../store/config';
import { toast } from '../../../../ui';
import { changeResidentPlan } from '../../../../store/residentRecords';
import { BACK_OFFICE_USER } from '../../seed/associates';

const firstName = (name: string) => name.split(' ')[0];

/** Change a resident's meal plan, recorded for billing, with an Undo toast. */
export function changePlanWithUndo(rid: string, name: string, planId: string): void {
  const change = changeResidentPlan(rid, planId, BACK_OFFICE_USER.name);
  if (!change) return;
  const undo = () => {
    change.undo();
    toast(`${firstName(name)}'s plan is back to ${change.from}.`);
  };
  toast(`${firstName(name)}'s plan changed to ${change.to}. The change is recorded for billing.`, {
    tone: 'success',
    action: { label: 'Undo', onClick: undo },
  });
}

/** What hospice does while it is on, from the Pacing & Coursing switches ("meals are comped at close and …"). */
export function hospiceDoes(cfg: DiningConfig): string {
  return [flag(cfg, 'hospiceAuto') && 'meals are comped at close', flag(cfg, 'freeDeliveryComp') && 'delivery fees are waived']
    .filter(Boolean)
    .join(' and ');
}

/** Switch hospice on or off (logged), with an Undo toast. */
export function toggleHospiceWithUndo(rid: string, name: string, on: boolean, cfg: DiningConfig): void {
  const undo = switchHospice(rid, on, BACK_OFFICE_USER.name);
  const does = hospiceDoes(cfg);
  const first = firstName(name);
  toast(on ? `${first} is on hospice${does ? `: ${does} from now on` : ''}.` : `${first} is no longer on hospice.`, {
    tone: 'success',
    action: {
      label: 'Undo',
      onClick: () => {
        undo();
        toast(on ? `${first} is back off hospice.` : `${first} is back on hospice.`);
      },
    },
  });
}
