import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection, BoTable, type BoColumn } from '../kit';
import { setSetting, useSetting } from '../../../store/serviceConfig';
import { Toggle } from '../../../ui';
import { formatMetric, isScored, metricDefs, weekAverage, type MetricDef } from '../../../domain/metrics/shiftMetrics';
import { Muted, NameAndNote, ResetButton, SettingNumber } from '../kit/SettingControls';

/** Shift Metrics: how a shift is scored against the last seven. */
export default function Page(_props: BoPageProps) {
  const noneBehind = !!useSetting<boolean>('met.noneBehind');
  const tableShorter = !!useSetting<boolean>('met.tableShorter');
  const off = useSetting<Record<string, boolean | undefined>>('met.off') ?? {};
  const defs = metricDefs(tableShorter);
  const scored = defs.filter((m) => isScored(m) && !off[m.k]).length;

  const columns: Array<BoColumn<MetricDef>> = [
    {
      key: 'metric',
      header: 'Metric',
      render: (m) => <NameAndNote name={m.label} note={m.note} />,
    },
    { key: 'better', header: 'Better when', render: (m) => (!m.better ? 'Context only' : m.better === 'up' ? 'Higher' : 'Lower') },
    { key: 'avg', header: 'Week average', render: (m) => formatMetric(m, weekAverage(m.k)) },
    {
      key: 'goal',
      header: 'Compare against',
      render: (m) => {
        const avg = weekAverage(m.k) ?? 0;
        const pct = m.fmt === '%';
        return (
          <SettingNumber
            path={`met.avg.${m.k}`}
            label={`Week average for ${m.label}`}
            unit={pct ? '%' : m.fmt === 'm' ? 'min' : ''}
            step={pct ? 1 : 0.1}
            width={78}
            placeholder={pct ? String(Math.round(avg * 100)) : String(Math.round(avg * 10) / 10)}
            toStored={pct ? (v) => v / 100 : undefined}
            fromStored={pct ? (v) => Math.round(v * 1000) / 10 : undefined}
            clearRemoves
          />
        );
      },
    },
    {
      key: 'counts',
      header: 'Counts toward great shift',
      render: (m) =>
        isScored(m) ? (
          <Toggle checked={!off[m.k]} onChange={(v) => setSetting(`met.off.${m.k}`, v ? undefined : true)} label={<span className="sr-only">Count {m.label}</span>} />
        ) : (
          <Muted>{m.count ? 'Shown as a count' : 'Not scored'}</Muted>
        ),
    },
  ];

  return (
    <BoPage
      title="Shift Metrics"
      sub="How a shift is scored against the last seven."
      actions={<ResetButton sections={['met']} message="Shift metrics are back to the defaults" />}
    >
      <BoSection title="Great shift" sub="A shift is great when enough scored metrics are ahead of the week average.">
        <BoRow label="Ahead means better than the week by" hint="Smaller numbers make it easier to be ahead, and to be behind.">
          <SettingNumber path="met.margin" label="Ahead by percent" unit="%" min={1} />
        </BoRow>
        <BoRow label="Metrics that must be ahead">
          <SettingNumber path="met.need" label="Metrics that must be ahead" unit={`of ${scored}`} min={1} />
        </BoRow>
        <BoRow label="None can be behind" hint="Off counts a shift as great even if one metric is behind.">
          <Toggle checked={noneBehind} onChange={(v) => setSetting('met.noneBehind', v)} />
        </BoRow>
        <BoRow label="Score table time: shorter is better" hint="Off keeps table time for context only, since a longer visit is not always a worse one.">
          <Toggle checked={tableShorter} onChange={(v) => setSetting('met.tableShorter', v)} />
        </BoRow>
      </BoSection>
      <BoSection
        flush
        title="What is measured"
        sub="The week average is the last seven shifts. Type a number to compare against your own goal instead; leave it blank to use the real average."
      >
        <BoTable columns={columns} rows={defs} rowKey={(m) => m.k} />
      </BoSection>
    </BoPage>
  );
}
