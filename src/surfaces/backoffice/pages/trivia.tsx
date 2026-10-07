import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoTable, type BoColumn } from '../kit';
import { COMMUNITY_NAME } from '../../../data';
import { today } from '../../../lib/clock';
import { useDining } from '../../../store/dining';
import {
  ANSWER_LETTERS,
  TRIVIA_QUESTIONS,
  dayScores,
  monthBoard,
  questionFor,
  serverTrivia,
  setTriviaPrize,
  todayIso,
  triviaPrize,
  useTrivia,
  type BoardEntry,
} from '../../../store/trivia';
import { Avatar, Button, Modal, Tabs, TextArea, toast } from '../../../ui';
import { RankBadge } from '../../server/features/trivia/RankBadge';
import { TriviaServersCard } from '../../server/features/trivia/TriviaServersCard';
import { escapeHtml, printHtml, printableDocument } from '../../server/features/shared/print';
import s from './trivia.module.css';

const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' });

function printBoard(board: BoardEntry[], month: string, prize: string) {
  const rows = board
    .slice(0, 12)
    .map(
      (e) =>
        `<tr><td class="rank${e.rank === 1 ? ' first' : ''}">${e.rank}</td><td class="big">${escapeHtml(e.resident.name)}</td><td class="big num"><b>${e.pts}</b></td><td class="num">${e.days} ${e.days === 1 ? 'day' : 'days'}</td></tr>`,
    )
    .join('');
  const body =
    `<div class="kick">${escapeHtml(COMMUNITY_NAME)} · Trivia of the day</div><h1>${escapeHtml(month)} standings</h1>` +
    `<table><tbody>${rows}</tbody></table>` +
    (prize ? `<div class="prize"><div class="kick">This month's prizes</div>${escapeHtml(prize)}</div>` : '') +
    '<div class="ft">One point for each correct answer, once a day. Ask your server for the trivia question at the end of your meal.</div>';
  const css =
    'h1{font-size:34px}td{height:52px}.big{font-size:26px}.rank{width:60px;font-size:26px;font-weight:bold;color:#145785}.first{color:#b07a1e}.prize{margin-top:22px;padding:14px 18px;border:2px solid #145785;border-radius:10px;font-size:19px;line-height:1.4}';
  printHtml(printableDocument('Trivia champions', body, css));
}

/** Trivia Scoreboard: monthly trivia points, winners and prizes. */
export default function Page(_props: BoPageProps) {
  const state = useTrivia();
  const { orders, history } = useDining();
  const [period, setPeriod] = useState<'this' | 'last'>('this');
  const [big, setBig] = useState(false);
  const savedPrize = triviaPrize(state);
  const [prize, setPrize] = useState(savedPrize);
  const now = today();
  const ref = new Date(now.getFullYear(), now.getMonth() + (period === 'last' ? -1 : 0), 1, 12);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12);
  const board = monthBoard(state, ref.getFullYear(), ref.getMonth());
  const winners = monthBoard(state, prev.getFullYear(), prev.getMonth()).filter((e) => e.rank <= 3);
  const live = useMemo(() => [...orders, ...history], [orders, history]);
  const servers = serverTrivia(state, ref.getFullYear(), ref.getMonth(), live);
  const iso = todayIso();
  const q = questionFor(iso);
  const todays = Object.values(dayScores(state, iso));
  const answers = board.reduce((a, e) => a + e.days, 0);
  const points = board.reduce((a, e) => a + e.pts, 0);

  const columns: Array<BoColumn<BoardEntry>> = [
    { key: 'rank', header: '#', width: 52, render: (e) => <RankBadge rank={e.rank} size={26} /> },
    {
      key: 'who',
      header: 'Resident',
      render: (e) => (
        <span className={s.who}>
          <Avatar person={e.resident} size={28} />
          <span>
            <span className={s.whoName}>{e.resident.name}</span>
            <span className={s.whoApt}>Apt {e.resident.apt || '–'}</span>
          </span>
        </span>
      ),
    },
    { key: 'days', header: 'Days played', align: 'right', render: (e) => <span className={s.num}>{e.days}</span> },
    { key: 'pts', header: 'Points', align: 'right', render: (e) => <b className={s.pts}>{e.pts}</b> },
  ];

  return (
    <BoPage
      title="Trivia Scoreboard"
      actions={
        <>
          <Button variant="ghost" onClick={() => setBig(true)}>
            Large print board
          </Button>
          <Button icon={<Printer size={15} />} onClick={() => printBoard(board, `${monthName(ref)} ${ref.getFullYear()}`, prize.trim())}>
            Print
          </Button>
        </>
      }
    >
      <div className={s.stats}>
        <div className={s.stat}>
          <b>{board.length}</b>
          <span>residents playing in {monthName(ref)}</span>
        </div>
        <div className={s.stat}>
          <b>{answers}</b>
          <span>answers in {monthName(ref)}</span>
        </div>
        <div className={s.stat}>
          <b>{answers ? `${Math.round((points / answers) * 100)}%` : '–'}</b>
          <span>answered correctly in {monthName(ref)}</span>
        </div>
        <div className={s.stat}>
          <b>{todays.length}</b>
          <span>played today{todays.length ? `, ${todays.filter((v) => v === 1).length} right` : ''}</span>
        </div>
      </div>
      <div className={s.grid}>
        <section className={s.standings}>
          <header className={s.standingsHead}>
            <h2>{monthName(ref)} standings</h2>
            <Tabs
              size="sm"
              aria-label="Month"
              value={period}
              onChange={setPeriod}
              options={[
                { id: 'this', label: 'This month' },
                { id: 'last', label: 'Last month' },
              ]}
            />
          </header>
          <BoTable columns={columns} rows={board} rowKey={(e) => e.resident.id} empty={`No one has played yet in ${monthName(ref)}.`} />
        </section>
        <div className={s.side}>
          <TriviaServersCard rows={servers} month={monthName(ref)} />
          <section className={s.card}>
            <h3 className={s.cap}>Prizes</h3>
            <p className={s.hint}>Your community decides. This prints on the large print board.</p>
            <TextArea
              value={prize}
              rows={3}
              onChange={(e) => setPrize(e.target.value)}
              placeholder="For example: first place picks next month's dessert special"
              aria-label="Prizes"
            />
            <div className={s.right}>
              <Button
                size="sm"
                variant="primary"
                disabled={prize.trim() === savedPrize}
                onClick={() => {
                  setTriviaPrize(prize.trim());
                  toast('Prizes saved', { tone: 'success' });
                }}
              >
                Save prizes
              </Button>
            </div>
          </section>
          <section className={s.card}>
            <h3 className={s.cap}>{monthName(prev)} winners</h3>
            {!winners.length && <p className={s.hint}>No scores last month.</p>}
            {winners.map((e) => (
              <div key={e.resident.id} className={s.winner}>
                <RankBadge rank={e.rank} size={26} />
                <Avatar person={e.resident} size={28} />
                <span className={s.winnerName}>{e.resident.name}</span>
                <b>{e.pts} pts</b>
              </div>
            ))}
          </section>
          <section className={s.card}>
            <h3 className={s.cap}>Today's question · {q.category}</h3>
            <p className={s.question}>{q.question}</p>
            <p className={s.answer}>
              Answer: {ANSWER_LETTERS[q.answer]}, {q.choices[q.answer]}
            </p>
            <p className={s.hint}>{TRIVIA_QUESTIONS.length} questions rotate daily, so none repeats for about two months.</p>
          </section>
        </div>
      </div>
      <Modal open={big} onClose={() => setBig(false)} width="100%" tall hideClose className={s.bigModal}>
        <button type="button" className={s.bigBoard} onClick={() => setBig(false)} aria-label="Close the large print board">
          <span className={s.bigHead}>
            <span>
              <span className={s.bigKick}>{COMMUNITY_NAME} · Trivia of the day</span>
              <span className={s.bigTitle}>{monthName(ref)} champions</span>
            </span>
            <span className={s.bigClose}>Tap anywhere to close</span>
          </span>
          {board.slice(0, 10).map((e) => (
            <span key={e.resident.id} className={s.bigRow}>
              <span className={e.rank === 1 ? s.bigRankGold : e.rank <= 3 ? s.bigRankTop : s.bigRank}>{e.rank}</span>
              <Avatar person={e.resident} size={64} />
              <span className={s.bigName}>{e.resident.name}</span>
              <span className={s.bigPts}>{e.pts}</span>
              <span className={s.bigUnit}>{e.pts === 1 ? 'point' : 'points'}</span>
            </span>
          ))}
          {prize.trim() && (
            <span className={s.bigPrize}>
              <span className={s.bigPrizeKick}>Prizes</span>
              {prize.trim()}
            </span>
          )}
        </button>
      </Modal>
    </BoPage>
  );
}
