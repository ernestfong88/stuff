import { getResident } from '../../../../data';
import { Sheet, useViewportWidth } from '../../../../ui';
import { ResidentProfile } from './ResidentProfile';
import s from './ResidentProfileSheet.module.css';

/** A resident's profile (story, loves, good to know, diet, plan) in a sheet. */
export function ResidentProfileSheet({ residentId, onClose }: { residentId: string | null; onClose: () => void }) {
  const resident = getResident(residentId);
  const vw = useViewportWidth();
  if (!resident) return null;
  return (
    <Sheet open onClose={onClose} width={Math.min(1120, vw)} className={s.sheet} title="Resident profile">
      <ResidentProfile resident={resident} wide={vw >= 900} />
    </Sheet>
  );
}
