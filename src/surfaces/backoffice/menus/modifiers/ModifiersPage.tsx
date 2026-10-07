import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, EmptyState, Modal, toast } from '../../../../ui';
import type { BoModGroup } from '../../../../store/menuEdits';
import { BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { Field, Select } from '../ui/controls';
import { GroupDetail } from './GroupDetail';
import { GroupList } from './GroupList';
import s from './ModifiersPage.module.css';

const COMMUNITIES = ['Cypress Court (template)', 'Cardinal at North Hills', 'La Posada'];

/** Modifiers: groups of choices servers add to an item, their rules and pins. */
export function ModifiersPage() {
  const bo = useBo();
  const active = bo.modGroups.filter((g) => g.active).sort((a, b) => b.usage90 - a.usage90);
  const [selId, setSelId] = useState<string | null>(active[0]?.id ?? null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [from, setFrom] = useState(COMMUNITIES[0]);
  const sel = bo.modGroups.find((g) => g.id === selId && g.active) ?? active[0];

  const update = (id: string, fn: (g: BoModGroup) => BoModGroup) => updateBo((st) => ({ modGroups: st.modGroups.map((g) => (g.id === id ? fn(g) : g)) }));

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
      sub="Choices servers add to an item, like breads, sides, toppings and cooking styles."
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
            <Button
              variant="primary"
              icon={<Download size={15} />}
              onClick={() => {
                setCopyOpen(false);
                toast(`Modifiers copied from ${from.replace(/ \(template\)$/, '')}. Review before publishing.`, { tone: 'success' });
              }}
            >
              Copy modifiers
            </Button>
          </>
        }
      >
        <p className={s.dialogText}>Copies every group and choice from the chosen community into this one.</p>
        <Field label="Copy from">
          <Select value={from} onChange={setFrom} options={COMMUNITIES.map((c) => ({ value: c, label: c }))} />
        </Field>
      </Modal>
    </BoPage>
  );
}
