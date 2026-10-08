import { useState } from 'react';
import { uid } from '../../../../lib/id';
import { Download } from 'lucide-react';
import { Button, EmptyState, Modal, toast } from '../../../../ui';
import type { BoModGroup } from '../../../../store/menuEdits';
import { BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { Field, Select } from '../ui/controls';
import { GroupDetail } from './GroupDetail';
import { GroupList } from './GroupList';
import { OTHER_COMMUNITY_MODS, planCopy } from './copyGroups';
import { andList } from '../model/menuPrint';
import s from './ModifiersPage.module.css';

const COMMUNITIES = Object.keys(OTHER_COMMUNITY_MODS);

/** Modifiers: groups of choices servers add to an item, their rules and pins. */
export function ModifiersPage() {
  const bo = useBo();
  const active = bo.modGroups.filter((g) => g.active).sort((a, b) => b.usage90 - a.usage90);
  const [selId, setSelId] = useState<string | null>(active[0]?.id ?? null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [from, setFrom] = useState(COMMUNITIES[0]);
  const sel = bo.modGroups.find((g) => g.id === selId && g.active) ?? active[0];
  const plan = planCopy(bo.modGroups, OTHER_COMMUNITY_MODS[from] ?? [], () => uid('g'));
  const changes = plan.added.length + plan.extended.length;

  const copy = () => {
    const before = bo.modGroups;
    updateBo(() => ({ modGroups: plan.groups }));
    setCopyOpen(false);
    toast(`Copied from ${from}: ${plan.added.length} new ${plan.added.length === 1 ? 'group' : 'groups'}, ${plan.extended.length} updated.`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => updateBo(() => ({ modGroups: before })) },
    });
  };

  const update = (id: string, fn: (g: BoModGroup) => BoModGroup) =>
    updateBo((st) => ({ modGroups: st.modGroups.map((g) => (g.id === id ? fn(g) : g)) }));

  const retire = (g: BoModGroup) => {
    update(g.id, (x) => ({ ...x, active: false }));
    setSelId(active.find((x) => x.id !== g.id)?.id ?? null);
    toast('Group retired. Past orders keep their labels.', {
      action: {
        label: 'Undo',
        onClick: () => {
          update(g.id, (x) => ({ ...x, active: true }));
          setSelId(g.id);
        },
      },
    });
  };

  return (
    <BoPage
      title="Modifiers"
      actions={
        <Button icon={<Download size={15} />} onClick={() => setCopyOpen(true)}>
          Copy from another community
        </Button>
      }
    >
      <div className={s.layout}>
        <GroupList
          groups={bo.modGroups}
          selectedId={sel?.id ?? null}
          onSelect={setSelId}
          onAdd={(name) => {
            const id = 'g_' + Date.now().toString(36);
            updateBo((st) => ({ modGroups: [...st.modGroups, { id, name, active: true, mods: [], usage90: 0, pinned: [] }] }));
            setSelId(id);
            toast('Group added', { tone: 'success' });
          }}
          onRestore={(g) => {
            update(g.id, (x) => ({ ...x, active: true }));
            setSelId(g.id);
            toast(`${g.name} is back`, { tone: 'success' });
          }}
        />
        {sel ? (
          <GroupDetail key={sel.id} group={sel} onChange={(fn) => update(sel.id, fn)} onRetire={() => retire(sel)} />
        ) : (
          <div className={s.emptyDetail}>
            <EmptyState title="No modifier groups yet">Add a group on the left, then its choices.</EmptyState>
          </div>
        )}
      </div>

      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy modifiers from another community"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCopyOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Download size={15} />} disabled={!changes} onClick={copy}>
              Copy modifiers
            </Button>
          </>
        }
      >
        <p className={s.dialogText}>Adds the groups and choices you don't have yet. Nothing here is removed or renamed.</p>
        <Field label="Copy from">
          <Select value={from} onChange={setFrom} options={COMMUNITIES.map((c) => ({ value: c, label: c }))} />
        </Field>
        <div className={s.plan} aria-live="polite">
          {!changes && <p className={s.planLine}>You already have everything {from} has.</p>}
          {plan.added.length > 0 && (
            <p className={s.planLine}>
              <strong>New {plan.added.length === 1 ? 'group' : 'groups'}:</strong> {andList(plan.added)}
            </p>
          )}
          {plan.extended.map((x) => (
            <p key={x.name} className={s.planLine}>
              <strong>{x.name} gains</strong> {andList(x.choices)}
            </p>
          ))}
        </div>
      </Modal>
    </BoPage>
  );
}
