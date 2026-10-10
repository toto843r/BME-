'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

// Keep PDF.js in the existing lazy-loaded component. The PDF is not downloaded
// until a student opens it, and no PDF content is added to offline storage.
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3.5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Anchor = {
  page: number;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
};
type PinchState = {
  startDistance: number;
  startZoom: number;
  latestZoom: number;
  clientX: number;
  clientY: number;
};

function midpoint(a: Touch, b: Touch) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}
function distance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export default function ResponsivePdfViewer({ url, title }: { url: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const skipBlurResetRef = useRef(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageRatio, setPageRatio] = useState(1.414);
  const [pageWidth, setPageWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [error, setError] = useState('');
  const pendingAnchor = useRef<Anchor | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouchDoubleRef = useRef(0);

  // Fit page width by default; track only the actual viewer size.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const updateWidth = () => setPageWidth(Math.max(0, element.clientWidth - 24));
    updateWidth();
    const resize = new ResizeObserver(updateWidth);
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    setPdfDoc(null);
    setError('');
    setZoom(1);
    zoomRef.current = 1;
    setCurrentPage(1);
    setPageInput('1');
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
      scrollRef.current.scrollTop = 0;
    }

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({
          url, withCredentials: false, disableAutoFetch: true, disableStream: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) { await pdf.destroy(); return; }
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        if (cancelled) { await pdf.destroy(); return; }
        setPageRatio(viewport.height / viewport.width);
        setPdfDoc(pdf);
      } catch {
        if (!cancelled) setError('تعذر فتح ملف PDF. تحقق من اتصال الإنترنت أو افتحه بالمتصفح.');
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [url]);

  // Identify the page under a finger or cursor, so zoom stays centred on it.
  const captureAnchor = useCallback((clientX: number, clientY: number): Anchor | null => {
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    if (!scroll || !stack) return null;
    const pages = stack.querySelectorAll<HTMLElement>('[data-pdf-page]');
    if (!pages.length) return null;
    let selected = pages[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const page of pages) {
      const rect = page.getBoundingClientRect();
      const verticalDistance = Math.max(rect.top - clientY, clientY - rect.bottom, 0);
      if (verticalDistance < bestDistance) {
        bestDistance = verticalDistance;
        selected = page;
        if (verticalDistance === 0) break;
      }
    }
    const rect = selected.getBoundingClientRect();
    return {
      page: Number(selected.dataset.pdfPage) || 1,
      x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1),
      clientX, clientY,
    };
  }, []);

  const setZoomAt = useCallback((value: number, clientX?: number, clientY?: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const next = Math.round(clamp(value, MIN_ZOOM, MAX_ZOOM) * 100) / 100;
    if (next === zoomRef.current) return;
    const rect = scroll.getBoundingClientRect();
    pendingAnchor.current = captureAnchor(
      clientX ?? rect.left + rect.width / 2,
      clientY ?? rect.top + rect.height / 2,
    );
    zoomRef.current = next;
    setZoom(next);
  }, [captureAnchor]);

  // After page sizes change, restore the exact reading point (not page 1).
  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    pendingAnchor.current = null;
    if (!anchor || !scroll || !stack) return;
    const page = stack.querySelector<HTMLElement>(`[data-pdf-page="${anchor.page}"]`);
    if (!page) return;
    const rect = page.getBoundingClientRect();
    scroll.scrollLeft += rect.left + rect.width * anchor.x - anchor.clientX;
    scroll.scrollTop += rect.top + rect.height * anchor.y - anchor.clientY;
  }, [zoom]);

  const toggleTapZoom = useCallback((x: number, y: number) => {
    setZoomAt(zoomRef.current < 1.5 ? 2 : 1, x, y);
  }, [setZoomAt]);

  // Native non-passive touch handling is needed to prevent browser page zoom
  // during a two-finger gesture. Nothing is re-rendered by React until release.
  useEffect(() => {
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    if (!scroll || !stack) return;
    const clearPreview = () => {
      stack.style.transform = '';
      stack.style.transformOrigin = '';
      stack.style.willChange = '';
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        tapStartRef.current = { time: Date.now(), x: touch.clientX, y: touch.clientY };
        return;
      }
      tapStartRef.current = null;
      if (event.touches.length !== 2) return;
      const a = event.touches[0];
      const b = event.touches[1];
      const center = midpoint(a, b);
      lastTapRef.current = null;
      const current = zoomRef.current;
      pinchRef.current = {
        startDistance: Math.max(1, distance(a, b)),
        startZoom: current, latestZoom: current,
        clientX: center.x, clientY: center.y,
      };
      const rect = stack.getBoundingClientRect();
      stack.style.transformOrigin = `${center.x - rect.left}px ${center.y - rect.top}px`;
      stack.style.willChange = 'transform';
    };
    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch && event.touches.length === 1 && tapStartRef.current) {
        const first = tapStartRef.current;
        const touch = event.touches[0];
        if (Math.hypot(touch.clientX - first.x, touch.clientY - first.y) > 16) {
          tapStartRef.current = null; // Scrolling is not a double tap.
        }
      }
      if (!pinch || event.touches.length < 2) return;
      if (event.cancelable) event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const center = midpoint(a, b);
      pinch.clientX = center.x;
      pinch.clientY = center.y;
      pinch.latestZoom = clamp(pinch.startZoom * distance(a, b) / pinch.startDistance, MIN_ZOOM, MAX_ZOOM);
      stack.style.transform = `scale(${pinch.latestZoom / pinch.startZoom})`;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (pinch) {
        if (event.touches.length >= 2) return;
        pinchRef.current = null;
        tapStartRef.current = null;
        clearPreview();
        setZoomAt(pinch.latestZoom, pinch.clientX, pinch.clientY);
        lastTapRef.current = null;
        return;
      }
      if (event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const tapStart = tapStartRef.current;
      tapStartRef.current = null;
      const time = Date.now();
      if (!tapStart || time - tapStart.time > 350 ||
          Math.hypot(touch.clientX - tapStart.x, touch.clientY - tapStart.y) > 16) {
        lastTapRef.current = null;
        return;
      }
      const previous = lastTapRef.current;
      if (previous && time - previous.time < 330 && Math.hypot(previous.x - touch.clientX, previous.y - touch.clientY) < 30) {
        if (event.cancelable) event.preventDefault();
        lastTouchDoubleRef.current = time;
        toggleTapZoom(touch.clientX, touch.clientY);
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { time, x: touch.clientX, y: touch.clientY };
      }
    };
    const onTouchCancel = () => {
      pinchRef.current = null;
      lastTapRef.current = null;
      tapStartRef.current = null;
      clearPreview();
    };
    scroll.addEventListener('touchstart', onTouchStart, { passive: true });
    scroll.addEventListener('touchmove', onTouchMove, { passive: false });
    scroll.addEventListener('touchend', onTouchEnd, { passive: false });
    scroll.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      scroll.removeEventListener('touchstart', onTouchStart);
      scroll.removeEventListener('touchmove', onTouchMove);
      scroll.removeEventListener('touchend', onTouchEnd);
      scroll.removeEventListener('touchcancel', onTouchCancel);
      clearPreview();
    };
  }, [pdfDoc, pageWidth, setZoomAt, toggleTapZoom]);

  // Lightweight page indicator: one animation frame per scroll, no PDF renders.
  useEffect(() => {
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    if (!scroll || !stack || !pdfDoc) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = scroll.getBoundingClientRect();
      const markerY = bounds.top + Math.min(120, scroll.clientHeight / 3);
      const markerX = bounds.left + bounds.width / 2;
      // elementFromPoint avoids measuring hundreds of pages on every scroll.
      const target = window.document.elementFromPoint(markerX, markerY);
      const page = target?.closest<HTMLElement>('[data-pdf-page]');
      const closestPage = page ? Number(page.dataset.pdfPage) || 1 : null;
      if (!closestPage) return;
      setCurrentPage((value) => value === closestPage ? value : closestPage);
      if (window.document.activeElement !== pageInputRef.current) setPageInput(String(closestPage));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroll.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { scroll.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [pdfDoc, pageWidth]);

  const goToPage = useCallback((requested: number) => {
    if (!pdfDoc || !Number.isFinite(requested)) return;
    const pageNumber = clamp(Math.round(requested), 1, pdfDoc.numPages);
    const scroll = scrollRef.current;
    const page = stackRef.current?.querySelector<HTMLElement>(`[data-pdf-page="${pageNumber}"]`);
    if (!scroll || !page) return;
    const scrollRect = scroll.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    scroll.scrollTo({ top: scroll.scrollTop + pageRect.top - scrollRect.top - 12, behavior: 'smooth' });
    setCurrentPage(pageNumber);
    setPageInput(String(pageNumber));
    skipBlurResetRef.current = true;
    pageInputRef.current?.blur();
  }, [pdfDoc, pageWidth]);

  return <div className="flex h-full min-h-0 flex-col" aria-label={`معاينة ${title}`}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-2 py-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-1" dir="ltr" aria-label="صفحات ملف PDF">
        <button type="button" disabled={!pdfDoc || currentPage <= 1} onClick={() => goToPage(currentPage - 1)}
          className="rounded-lg p-2 hover:bg-line/60 disabled:opacity-35" aria-label="الصفحة السابقة" title="الصفحة السابقة"><ChevronLeft size={16} /></button>
        <input ref={pageInputRef} type="number" min={1} max={pdfDoc?.numPages || 1} inputMode="numeric"
          value={pageInput} onChange={(event) => setPageInput(event.target.value)}
          onBlur={() => {
            if (skipBlurResetRef.current) { skipBlurResetRef.current = false; return; }
            setPageInput(String(currentPage));
          }}
          onKeyDown={(event) => { if (event.key === 'Enter') goToPage(Number(pageInput)); }}
          disabled={!pdfDoc} aria-label="رقم الصفحة" className="w-11 rounded-md border border-line bg-panel px-1 py-1 text-center text-xs tabular-nums" />
        <span className="text-xs text-muted tabular-nums">/ {pdfDoc?.numPages || '…'}</span>
        <button type="button" disabled={!pdfDoc || currentPage >= pdfDoc.numPages} onClick={() => goToPage(currentPage + 1)}
          className="rounded-lg p-2 hover:bg-line/60 disabled:opacity-35" aria-label="الصفحة التالية" title="الصفحة التالية"><ChevronRight size={16} /></button>
      </div>
      <div className="flex items-center gap-1" dir="ltr" role="group" aria-label="التحكم بتكبير PDF">
        <button type="button" aria-label="تصغير PDF" title="تصغير" disabled={!pdfDoc || zoom <= MIN_ZOOM}
          onClick={() => setZoomAt(zoom - .25)} className="rounded-lg border border-line p-2 disabled:opacity-35"><Minus size={16} /></button>
        <span className="min-w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="تكبير PDF" title="تكبير" disabled={!pdfDoc || zoom >= MAX_ZOOM}
          onClick={() => setZoomAt(zoom + .25)} className="rounded-lg border border-line p-2 disabled:opacity-35"><Plus size={16} /></button>
        <button type="button" aria-label="ملاءمة عرض الشاشة" title="ملاءمة الشاشة" disabled={!pdfDoc}
          onClick={() => setZoomAt(1)} className="rounded-lg border border-line p-2 disabled:opacity-35"><RotateCcw size={16} /></button>
      </div>
    </div>
    <div ref={scrollRef} dir="ltr" tabIndex={0}
      aria-label="صفحات ملف PDF: اضغط مرتين للتكبير، واستخدم إصبعين للتكبير أو التصغير"
      onDoubleClick={(event) => {
        if (Date.now() - lastTouchDoubleRef.current > 500) toggleTapZoom(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoomAt(zoomRef.current + .25); }
        if (event.key === '-') { event.preventDefault(); setZoomAt(zoomRef.current - .25); }
        if (event.key === '0') { event.preventDefault(); setZoomAt(1); }
      }}
      style={{ touchAction: 'pan-x pan-y' }}
      className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#dce3e5] dark:bg-[#26373a]">
      {error ? <div dir="rtl" className="mx-3 my-8 rounded-lg bg-panel p-4 text-center text-sm text-ink">
        <p className="mb-3">{error}</p>
        <a className="font-semibold text-brand underline" href={url} target="_blank" rel="noopener noreferrer">فتح الملف بالمتصفح</a>
      </div> : !pdfDoc || !pageWidth ? <p dir="rtl" role="status" className="p-6 text-center text-sm text-muted">جارٍ فتح ملف PDF…</p> :
        <div ref={stackRef} className="flex flex-col items-center gap-3 p-3"
          style={{ width: `${Math.max(pageWidth + 24, Math.round(pageWidth * zoom) + 24)}px` }}>
          {Array.from({ length: pdfDoc.numPages }, (_, i) =>
            <PdfPage key={`${url}-${i}`} pdf={pdfDoc} number={i + 1} width={pageWidth}
              zoom={zoom} ratio={pageRatio} root={scrollRef} />)}
        </div>}
    </div>
    {pdfDoc && <p dir="rtl" className="sr-only">اضغط مرتين على الصفحة للتكبير، أو قرّب إصبعين للتكبير، ويمكنك كتابة رقم الصفحة والضغط على إدخال.</p>}
  </div>;
}

// Memo prevents the page tree re-rendering when only the page counter changes.
const PdfPage = memo(function PdfPage({ pdf, number, width, zoom, ratio, root }: {
  pdf: PDFDocumentProxy; number: number; width: number; zoom: number;
  ratio: number; root: RefObject<HTMLDivElement | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const visibleCanvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(number === 1);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [ownRatio, setOwnRatio] = useState<number | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: root.current, rootMargin: '240px 0px', threshold: 0,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, number]);

  useEffect(() => {
    const display = visibleCanvas.current;
    if (!visible || !display) {
      if (display) { display.width = 0; display.height = 0; }
      setReady(false);
      return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    let scratch: HTMLCanvasElement | undefined;
    setBroken(false);
    (async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const normal = page.getViewport({ scale: 1 });
        const nextRatio = normal.height / normal.width;
        setOwnRatio((old) => old === nextRatio ? old : nextRatio);
        const viewport = page.getViewport({ scale: width / normal.width * zoom });
        const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2,
          Math.sqrt(3_500_000 / Math.max(1, viewport.width * viewport.height))));
        // Preserve the already visible page while PDF.js draws at the new size.
        display.style.width = `${viewport.width}px`;
        display.style.height = `${viewport.height}px`;
        scratch = window.document.createElement('canvas');
        scratch.width = Math.max(1, Math.floor(viewport.width * dpr));
        scratch.height = Math.max(1, Math.floor(viewport.height * dpr));
        const context = scratch.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas unavailable');
        task = page.render({ canvas: scratch, canvasContext: context, viewport,
          transform: [dpr, 0, 0, dpr, 0, 0] });
        await task.promise;
        if (cancelled || !scratch) return;
        display.width = scratch.width;
        display.height = scratch.height;
        const visibleContext = display.getContext('2d', { alpha: false });
        if (!visibleContext) throw new Error('Canvas unavailable');
        visibleContext.drawImage(scratch, 0, 0);
        setReady(true);
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.name === 'RenderingCancelledException')) {
          setBroken(true);
        }
      } finally {
        if (scratch) { scratch.width = 0; scratch.height = 0; }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, number, width, zoom, visible]);

  const height = Math.round(width * zoom * (ownRatio || ratio));
  return <div ref={host} data-pdf-page={number}
    className="relative shrink-0 bg-white shadow-sm"
    style={{ width: `${Math.round(width * zoom)}px`, minHeight: `${height}px` }}
    aria-label={`صفحة ${number}`}>
    {!ready && <span className="absolute inset-0 flex items-start justify-center pt-6 text-xs text-[#64748b]">
      {broken ? `تعذر عرض الصفحة ${number}` : `صفحة ${number}`}
    </span>}
    <canvas ref={visibleCanvas} className="block max-w-none" aria-label={`محتوى الصفحة ${number}`} />
  </div>;
});
