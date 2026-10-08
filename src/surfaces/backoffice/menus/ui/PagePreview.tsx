import { useLayoutEffect, useRef, useState } from 'react';
import { pageSize, paperOf, type Paper } from '../model/menuPrint';
import s from './PagePreview.module.css';

/**
 * A printout drawn at its paper's width and scaled to fit its column. It
 * grows to the printout's full length, so a two-page menu shows both pages.
 */
export function PagePreview({
  html,
  title,
  landscape,
  paper = paperOf('letter'),
}: {
  html: string;
  title: string;
  landscape?: boolean;
  paper?: Paper;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const size = pageSize(paper, landscape);
  const pageW = Math.round(size.w * 96);
  const minH = Math.round(size.h * 96);
  const [contentH, setContentH] = useState(minH);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = width ? width / pageW : 0;
  const pageH = Math.max(minH, contentH);
  return (
    <div ref={box} className={s.box} style={{ height: scale ? pageH * scale : undefined }}>
      {scale > 0 && (
        <iframe
          title={title}
          srcDoc={html}
          className={s.frame}
          style={{ width: pageW, height: pageH, transform: `scale(${scale})` }}
          tabIndex={-1}
          onLoad={(e) => setContentH(Math.ceil(e.currentTarget.contentDocument?.documentElement.getBoundingClientRect().height ?? minH))}
        />
      )}
    </div>
  );
}
