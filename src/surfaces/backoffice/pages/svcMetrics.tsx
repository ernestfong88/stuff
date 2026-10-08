import { useState } from 'react';
import type { BoPageProps } from '../nav';
import { BoCallout, BoPage, BoSection } from '../kit';
import { setSetting, useSetting } from '../../../store/serviceConfig';
import { Toggle, cx } from '../../../ui';
import { formatMetric, isScored, metricDefs, weekAverage, type MetricDef } from '../../../domain/metrics/shiftMetrics';
import { Muted, SettingNumber } from '../kit/SettingControls';
import { ConfirmReset } from './ConfirmReset';
import s from './svcMetrics.module.css';

/** Shift Metrics: how a shift is scored against the last seven. */
export default function Page(_props: BoPageProps) {
  const noneBehind = !!useSetting<boolean>('met.noneBehind');
  const tableShorter = !!useSetting<boolean>('met.tableShorter');
  const off = useSetting<Record<string, boolean | undefined>>('met.off') ?? {};
  const defs = metricDefs(tableShorter);
  const scored = defs.filter((m) => isScored(m) && !off[m.k]).length;
  const need = Number(useSetting<number | string | null>('met.need')) || 0;
  const needProblem = !scored
    ? 'No measure counts, so no shift can be great. Turn Counts on for at least one measure below.'
    : need > scored
      ? `Only ${scored} ${scored === 1 ? 'measure counts' : 'measures count'}, so a shift can never reach ${need}. Set it to ${scored} or fewer.`
      : null;

  return (
    <BoPage
      title="Shift Metrics"
      actions={
        <ConfirmReset
          sections={['met']}
          title="Put shift scoring back to the default?"
          message="The margin, the metrics that count and any goals you typed go back to the standard."
          done="Shift metrics are back to the defaults"
        />
      }
    >
      <BoCallout tone="warning">Shift Review doesn't use these yet; they take effect once it does.</BoCallout>
      <BoSection title="When is a shift great?">
        <p className={s.rule}>
          A shift is great when{' '}
          <span className={s.box}>
            <SettingNumber path="met.need" label={`Measures that must beat the last 7 shifts, of ${scored}`} unit="" min={1} max={Math.max(1, scored)} width={46} />
          </span>{' '}
          of {scored} measures beat the last 7 shifts by at least{' '}
          <span className={s.box}>
            <SettingNumber path="met.margin" label="Percent better than the last 7 shifts" unit="" min={1} max={100} width={46} />
          </span>
          %{' '}
          <button
            type="button"
            role="switch"
            aria-checked={noneBehind}
            className={cx(s.chip, noneBehind && s.chipOn)}
            onClick={() => setSetting('met.noneBehind', !noneBehind)}
          >
            <span className={s.chipSwitch} aria-hidden />
            and none falls behind
          </button>
          .
        </p>
        {needProblem && (
          <p className={s.problem} role="alert">
            {needProblem}
          </p>
        )}
      </BoSection>
      <BoSection flush title="What is measured" sub="Each measure is compared with its average over the last 7 shifts.">
        <ul className={s.list}>
          {defs.map((m) => (
            <MeasureRow key={m.k} m={m} counts={!off[m.k]} tableShorter={tableShorter} />
          ))}
        </ul>
      </BoSection>
    </BoPage>
  );
}

function MeasureRow({ m, counts, tableShorter }: { m: MetricDef; counts: boolean; tableShorter: boolean }) {
  const path = `met.avg.${m.k}`;
  const goal = useSetting<number | null | undefined>(path);
  const hasGoal = goal != null && (goal as unknown) !== '';
  const [editing, setEditing] = useState(false);
  const avg = weekAverage(m.k);
  const pct = m.fmt === '%';

  return (
    <li className={s.item}>
      <div className={s.what}>
        <div className={s.name}>{m.label}</div>
        <div className={s.goal}>
          <span className={s.note}>{m.note}</span>
          <span className={s.dot} aria-hidden>
            ·
          </span>
          {editing ? (
            <>
              <SettingNumber
                path={path}
                label={`Goal for ${m.label}`}
                unit={pct ? '%' : m.fmt === 'm' ? 'min' : ''}
                step={pct ? 1 : 0.1}
                width={64}
                placeholder={avg == null ? '' : pct ? String(Math.round(avg * 100)) : String(Math.round(avg * 10) / 10)}
                toStored={pct ? (v) => v / 100 : undefined}
                fromStored={pct ? (v) => Math.round(v * 1000) / 10 : undefined}
                clearRemoves
              />
              <button type="button" className={s.link} onClick={() => setEditing(false)}>
                Done
              </button>
            </>
          ) : hasGoal ? (
            <>
              <button type="button" className={s.goalSet} aria-label={`Change goal for ${m.label}`} onClick={() => setEditing(true)}>
                Goal {formatMetric(m, Number(goal))}
              </button>
              <span className={s.dot} aria-hidden>
                ·
              </span>
              <button type="button" className={s.link} aria-label={`Clear goal for ${m.label}`} onClick={() => setSetting(path, undefined)}>
                Clear
              </button>
            </>
          ) : (
            <button type="button" className={s.link} aria-label={`Use my own goal for ${m.label}`} onClick={() => setEditing(true)}>
              Use my own goal
            </button>
          )}
        </div>
        {m.k === 'table' && (
          <div className={s.extra}>
            <Toggle
              checked={tableShorter}
              onChange={(v) => setSetting('met.tableShorter', v)}
              label={<span className={s.small}>Score it: shorter is better</span>}
            />
          </div>
        )}
      </div>
      <div className={s.better}>{!m.better ? 'For context' : m.better === 'up' ? 'Higher is better' : 'Lower is better'}</div>
      <div className={s.avg}>
        {formatMetric(m, avg)} <span className={s.small}>avg</span>
      </div>
      <div className={s.counts}>
        {isScored(m) ? (
          <Toggle
            checked={counts}
            onChange={(v) => setSetting(`met.off.${m.k}`, v ? undefined : true)}
            label={
              <span className={s.small}>
                <span aria-hidden>Counts</span>
                <span className="sr-only">Count {m.label}</span>
              </span>
            }
          />
        ) : (
          <Muted>{m.count ? 'Shown as a count' : 'Not scored'}</Muted>
        )}
      </div>
    </li>
  );
}
