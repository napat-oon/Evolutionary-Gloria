/**
 * Full-viewport background artwork behind a page. The wallpaper is wider than
 * it is tall, so each page picks the vertical band to show via `shiftY`.
 */
export default function PageBackdrop({ src, shiftY }: { src: string; shiftY: number }) {
  return (
    <div className="page-bg" aria-hidden>
      <img src={src} alt="" style={{ transform: `translateY(${shiftY}px)` }} />
    </div>
  )
}
