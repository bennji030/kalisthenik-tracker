import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Bottom-Sheet (breit: Panel in der Mitte); schließt nur über die Knöpfe im Inhalt. */
export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  // In body, damit weder Transforms von <main> noch die Tab-Leiste das Sheet einfangen.
  return createPortal(
    <div className="scrim" data-no-swipe>
      <div className="sheet" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} data-no-swipe>
        <div className="sheet-body">
          <h2 id={titleId} className="sheet-title">{title}</h2>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
