import s from './PageLoading.module.css';

/**
 * Quiet stand-in while a page's code loads. It fades in only after a short
 * delay, so fast loads show nothing at all instead of a flash.
 */
export function PageLoading() {
  return (
    <div className={s.wrap} aria-busy="true" aria-label="Loading the page">
      <div className={s.title} />
      <div className={s.sub} />
      <div className={s.block} />
    </div>
  );
}
