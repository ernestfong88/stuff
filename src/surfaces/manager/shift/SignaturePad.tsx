import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '../../../ui';
import s from './SignaturePad.module.css';

/** __SigPad: sign with a finger to confirm the shift. */
export function SignaturePad({ name, onSign, onCancel }: { name: string; onSign: () => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!drawing.current || !ctx) return;
    const [x, y] = point(e);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b2630';
    ctx.lineTo(x, y);
    ctx.stroke();
    setSigned(true);
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setSigned(false);
  };

  return (
    <div className={s.pad}>
      <div className={s.title}>Sign to confirm, {name}</div>
      <div className={s.sub}>I confirm these charges and comps are correct and every table is closed.</div>
      <canvas
        ref={canvas}
        width={1200}
        height={240}
        className={s.canvas}
        aria-label="Signature"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className={s.actions}>
        <Button onClick={onCancel}>Not yet</Button>
        <Button onClick={clear} disabled={!signed}>
          Clear
        </Button>
        <Button variant="primary" className={s.grow} onClick={onSign} disabled={!signed}>
          Sign off and end shift
        </Button>
      </div>
    </div>
  );
}
