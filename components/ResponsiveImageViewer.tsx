'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Minus, Plus, RotateCcw, ImageOff } from 'lucide-react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Point = { x: number; y: number };
type View = { scale: number; x: number; y: number };
type Drag = { x: number; y: number; startPanX: number; startPanY: number; moved: boolean };
type Pinch = { distance: number; scale: number; anchorX: number; anchorY: number };

function length(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function center(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** A lightweight, native-image viewer. No pdf.js or additional packages are loaded. */
export default function ResponsiveImageViewer({ url, title }: { url: string; title: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<Drag | null>(null);
  const pinchRef = useRef<Pinch | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastDoubleTapRef = useRef(0);
  const [scaleLabel, setScaleLabel] = useState(1);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  // The image is fitted by CSS on first open; only the active image is fetched.
  const apply = useCallback((nextScale: number, nextX: number, nextY: number, animate = false) => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;
    const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2);
    const x = clamp(nextX, -maxX, maxX);
    const y = clamp(nextY, -maxY, maxY);
    viewRef.current = { scale, x, y };
    image.style.transition = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'transform 160ms ease-out' : 'none';
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const zoomAt = useCallback((nextScale: number, at?: Point) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const focus = at || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const before = viewRef.current;
    const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    // Preserve the point underneath the user's fingers when zooming.
    const fx = focus.x - rect.left - rect.width / 2;
    const fy = focus.y - rect.top - rect.height / 2;
    const x = fx - (fx - before.x) * scale / before.scale;
    const y = fy - (fy - before.y) * scale / before.scale;
    apply(scale, scale === 1 ? 0 : x, scale === 1 ? 0 : y, true);
    setScaleLabel(scale);
  }, [apply]);

  const reset = useCallback(() => zoomAt(1), [zoomAt]);

  useEffect(() => {
    // Maintain correct pan bounds if the device rotates or the modal resizes.
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const view = viewRef.current;
      apply(view.scale, view.x, view.y);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [apply]);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (loadState !== 'ready') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      const view = viewRef.current;
      dragRef.current = { x: event.clientX, y: event.clientY,
        startPanX: view.x, startPanY: view.y, moved: false };
      pinchRef.current = null;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = center(a, b);
      const stage = stageRef.current!;
      const rect = stage.getBoundingClientRect();
      const current = viewRef.current;
      const fx = mid.x - rect.left - rect.width / 2;
      const fy = mid.y - rect.top - rect.height / 2;
      pinchRef.current = {
        distance: Math.max(1, length(a, b)),
        scale: current.scale,
        anchorX: (fx - current.x) / current.scale,
        anchorY: (fy - current.y) / current.scale,
      };
      dragRef.current = null;
      lastTapRef.current = null;
    }
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()];
      const mid = center(a, b);
      const rect = stageRef.current!.getBoundingClientRect();
      const pinch = pinchRef.current;
      const scale = clamp(pinch.scale * length(a, b) / pinch.distance, MIN_ZOOM, MAX_ZOOM);
      apply(scale,
        mid.x - rect.left - rect.width / 2 - pinch.anchorX * scale,
        mid.y - rect.top - rect.height / 2 - pinch.anchorY * scale);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved && viewRef.current.scale > 1) {
      apply(viewRef.current.scale, drag.startPanX + dx, drag.startPanY + dy);
    }
  };

  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    const wasPinching = pinchRef.current !== null;
    if (wasPinching) {
      pinchRef.current = null;
      lastTapRef.current = null;
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        const view = viewRef.current;
        dragRef.current = { x: remaining.x, y: remaining.y,
          startPanX: view.x, startPanY: view.y, moved: true };
      }
    } else if (event.pointerType === 'touch' && dragRef.current && !dragRef.current.moved) {
      const tap = lastTapRef.current;
      const time = Date.now();
      if (tap && time - tap.time < 340 && Math.hypot(tap.x - event.clientX, tap.y - event.clientY) < 35) {
        lastDoubleTapRef.current = time;
        zoomAt(viewRef.current.scale < 1.5 ? 2 : 1, { x: event.clientX, y: event.clientY });
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { time, x: event.clientX, y: event.clientY };
      }
    } else {
      lastTapRef.current = null;
    }
    if (!pointers.size) dragRef.current = null;
    setScaleLabel(viewRef.current.scale); // One React update after the gesture, not on every move.
  };

  return <div className="flex h-full min-h-0 flex-col" aria-label={`معاينة الصورة: ${title}`}>
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-line bg-panel p-2" dir="ltr" role="group" aria-label="التحكم بتكبير الصورة">
      <button type="button" aria-label="تصغير الصورة" disabled={scaleLabel <= MIN_ZOOM || loadState !== 'ready'}
        onClick={() => zoomAt(scaleLabel - .25)} className="rounded-lg border border-line p-2 disabled:opacity-35"><Minus size={16} /></button>
      <span className="min-w-12 text-center text-xs tabular-nums">{Math.round(scaleLabel * 100)}%</span>
      <button type="button" aria-label="تكبير الصورة" disabled={scaleLabel >= MAX_ZOOM || loadState !== 'ready'}
        onClick={() => zoomAt(scaleLabel + .25)} className="rounded-lg border border-line p-2 disabled:opacity-35"><Plus size={16} /></button>
      <button type="button" aria-label="ملاءمة الصورة للشاشة" onClick={reset} disabled={loadState !== 'ready'}
        title="ملاءمة للشاشة" className="rounded-lg border border-line p-2 disabled:opacity-35"><RotateCcw size={16} /></button>
    </div>
    <div ref={stageRef} className="relative flex min-h-0 flex-1 cursor-grab items-center justify-center overflow-hidden bg-bg/40 active:cursor-grabbing"
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
      onDoubleClick={(event) => {
        // Some mobile browsers fire dblclick after touch double-tap; don't toggle twice.
        if (Date.now() - lastDoubleTapRef.current < 450) return;
        zoomAt(viewRef.current.scale < 1.5 ? 2 : 1, { x: event.clientX, y: event.clientY });
      }}>
      {loadState === 'loading' && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted" role="status">جارٍ تحميل الصورة…</p>}
      {loadState === 'error' && <div className="flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted">
        <ImageOff size={28} aria-hidden="true"/><span>تعذر عرض الصورة. يمكنك استخدام زر التحميل.</span>
      </div>}
      <img ref={imageRef} src={url} alt={title} draggable={false} decoding="async" loading="eager"
        onLoad={() => { setLoadState('ready'); apply(1, 0, 0); }}
        onError={() => setLoadState('error')}
        className={`pointer-events-none block max-h-full max-w-full select-none object-contain ${loadState === 'error' ? 'hidden' : ''}`}
        style={{ transformOrigin: 'center center', userSelect: 'none', WebkitUserSelect: 'none' }} />
    </div>
    <p className="shrink-0 border-t border-line bg-panel px-3 py-1.5 text-center text-xs text-muted">
      اضغط مرتين للتكبير، أو استخدم إصبعين للتحكم بالصورة
    </p>
  </div>;
}
