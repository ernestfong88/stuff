import { useLayoutEffect, useRef, useState } from 'react';
import s from './PagePreview.module.css';

/**
 * A printout drawn at letter width and scaled to fit its column. It grows
 * to the printout's full length, so a two-page menu shows both pages.
 */
export function PagePreview({ html, title, landscape }: { html: string; title: string; landscape?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const pageW = landscape ? 1056 : 816;
  const minH = landscape ? 816 : 1056;
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
          onLoad={(e) => setContentH(e.currentTarget.contentDocument?.body.scrollHeight ?? minH)}
        />
      )}
    </div>
  );
}
