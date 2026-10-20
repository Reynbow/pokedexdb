import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PHONE_QUERY = "(max-width: 900px)";

const isPhone = () => typeof window !== "undefined" && window.matchMedia?.(PHONE_QUERY).matches;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A popover window anchored under its trigger on desktop, a bottom sheet on phones.
 * Escape or a click outside closes it; focus moves in on open and back to the trigger on close.
 */
export default function Sheet({ open, onClose, anchorRef, label, width = 380, align = "start", className = "", children }) {
  const sheetRef = useRef(null);
  // Parents often pass an inline onClose; read it through a ref so focus handling runs once per open
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [pos, setPos] = useState(null);
  const [phone, setPhone] = useState(isPhone);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const onPhone = isPhone();
      setPhone(onPhone);
      const anchor = anchorRef?.current;
      if (onPhone || !anchor) {
        setPos(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const w = Math.min(width, window.innerWidth - 24);
      let left = align === "end" ? rect.right - w : rect.left;
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      const top = rect.bottom + 8;
      setPos({ top, left, width: w, maxHeight: Math.max(240, window.innerHeight - top - 16) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef, width, align]);

  useEffect(() => {
    if (!open) return undefined;
    const trigger = anchorRef?.current;
    const node = sheetRef.current;
    const first =
      node?.querySelector("[data-autofocus]") || node?.querySelector('[aria-pressed="true"], [aria-current="true"]') || node?.querySelector(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const style = !phone && pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : undefined;

  return createPortal(
    <>
      <div className={`scrim${phone ? "" : " scrim--clear"}`} onMouseDown={() => onCloseRef.current?.()} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`sheet popsheet${phone ? " popsheet--bottom" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={style}
      >
        {phone ? <div className="popsheet__grip" aria-hidden="true" /> : null}
        {children}
      </div>
    </>,
    document.body
  );
}
