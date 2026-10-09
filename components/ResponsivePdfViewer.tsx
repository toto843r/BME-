'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

// The PDF engine is loaded ONLY when a student opens a PDF. Nothing is
// prefetched or permanently saved; the site's offline cache still excludes PDFs.
export default function ResponsivePdfViewer({ url, title }: { url: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageRatio, setPageRatio] = useState(1.414);
  const [pageWidth, setPageWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateWidth = () => setPageWidth(Math.max(0, el.clientWidth - 24));
    updateWidth();
    const resize = new ResizeObserver(updateWidth);
    resize.observe(el);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    setDocument(null);
    setError('');
    setZoom(1);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (cancelled) return;
        // Bundle the matching PDF worker locally; no third-party viewer or CDN.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ url, withCredentials: false, disableAutoFetch: true, disableStream: true });
        const pdf = await loadingTask.promise;
        if (cancelled) { await pdf.destroy(); return; }
        const first = await pdf.getPage(1);
        const view = first.getViewport({ scale: 1 });
        if (cancelled) { await pdf.destroy(); return; }
        setPageRatio(view.height / view.width);
        setDocument(pdf);
      } catch {
        if (!cancelled) setError('تعذر فتح المعاينة الداخلية. تحقق من الإنترنت أو افتح الملف بالمتصفح.');
      }
    })();

    return () => {
      cancelled = true;
      // Destroy cancels outstanding range requests and releases document memory.
      void loadingTask?.destroy();
    };
  }, [url]);

  const changeZoom = (value: number) => setZoom(Math.max(0.75, Math.min(2.5, value)));

  return <div className="flex h-full min-h-0 flex-col" aria-label={`معاينة ${title}`}>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-panel px-3 py-2">
      <span className="truncate text-xs text-muted">{document ? `${document.numPages} صفحة · ملائم للشاشة` : 'معاينة PDF'}</span>
      <div className="flex items-center gap-1" role="group" aria-label="التحكم بحجم PDF">
        <button type="button" aria-label="تصغير PDF" disabled={!document || zoom <= 0.75}
          onClick={() => changeZoom(+(zoom - 0.25).toFixed(2))}
          className="rounded-lg border border-line p-2 disabled:opacity-40"><Minus size={16} /></button>
        <span className="min-w-12 text-center text-xs tabular-nums" dir="ltr">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="تكبير PDF" disabled={!document || zoom >= 2.5}
          onClick={() => changeZoom(+(zoom + 0.25).toFixed(2))}
          className="rounded-lg border border-line p-2 disabled:opacity-40"><Plus size={16} /></button>
        <button type="button" aria-label="ملاءمة العرض" disabled={!document}
          onClick={() => changeZoom(1)} className="rounded-lg border border-line p-2 disabled:opacity-40"><RotateCcw size={16} /></button>
      </div>
    </div>
    <div ref={scrollRef} dir="ltr" className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#dce3e5] dark:bg-[#26373a]">
      {error ? <div dir="rtl" className="mx-3 my-8 rounded-lg bg-panel p-4 text-center text-sm text-ink">
        <p className="mb-3">{error}</p>
        <a className="font-semibold text-brand underline" href={url} target="_blank" rel="noopener noreferrer">فتح الملف في المتصفح</a>
      </div> : !document || !pageWidth ? <p dir="rtl" className="p-6 text-center text-sm text-muted" role="status">جارٍ فتح الملزمة…</p> :
        <div className="space-y-3 p-3">
          {Array.from({ length: document.numPages }, (_, i) =>
            <PdfPage key={`${url}-${i}`} document={document} number={i + 1}
              width={pageWidth} zoom={zoom} ratio={pageRatio} root={scrollRef} />)}
        </div>}
    </div>
  </div>;
}

function PdfPage({ document, number, width, zoom, ratio, root }: {
  document: PDFDocumentProxy; number: number; width: number; zoom: number;
  ratio: number; root: RefObject<HTMLDivElement | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(number === 1);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [ownRatio, setOwnRatio] = useState<number | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: root.current,
      rootMargin: '500px 0px',
      threshold: 0,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, number]);

  useEffect(() => {
    if (!visible || !canvas.current) { setReady(false); return; }
    let cancelled = false;
    let task: RenderTask | undefined;
    const element = canvas.current;
    setReady(false);
    setBroken(false);
    (async () => {
      try {
        const page = await document.getPage(number);
        if (cancelled) return;
        const normal = page.getViewport({ scale: 1 });
        const nextRatio = normal.height / normal.width;
        setOwnRatio((old) => old === nextRatio ? old : nextRatio);
        const viewport = page.getViewport({ scale: width / normal.width * zoom });
        // Limit pixels for older phones and large technical drawings.
        const dpr = Math.min(window.devicePixelRatio || 1, 2,
          Math.sqrt(5_000_000 / Math.max(1, viewport.width * viewport.height)));
        element.width = Math.max(1, Math.floor(viewport.width * dpr));
        element.height = Math.max(1, Math.floor(viewport.height * dpr));
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        const context = element.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas not available');
        task = page.render({
          canvas: element,
          canvasContext: context,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        await task.promise;
        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setReady(false);
          setBroken(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      // Reclaim pixel buffers when a page moves far outside the viewport.
      element.width = 0;
      element.height = 0;
    };
  }, [document, number, width, zoom, visible]);

  const height = Math.round(width * zoom * (ownRatio || ratio));
  return <div ref={host} className="relative mx-auto bg-white shadow-sm"
    style={{ width: `${Math.round(width * zoom)}px`, minHeight: `${height}px` }}
    aria-label={`صفحة ${number}`}>
    {!ready && <span className="absolute inset-0 flex items-start justify-center pt-6 text-xs text-[#64748b]">{broken ? `تعذر عرض الصفحة ${number}` : `صفحة ${number}`}</span>}
    <canvas ref={canvas} className="block" aria-label={`محتوى الصفحة ${number}`} />
  </div>;
}
