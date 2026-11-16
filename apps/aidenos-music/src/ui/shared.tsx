import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { m } from "motion/react";
import { Icon, type IconName, TideMark } from "./icons";
import s from "./music.module.css";

export const FALLBACK = "/assets/img/music/cover-fallback.webp";
export function Cover({
  src,
  alt = "",
  className,
  style,
  eager = false,
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
}) {
  return (
    <img
      src={src || FALLBACK}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = "true";
          event.currentTarget.src = FALLBACK;
        }
      }}
    />
  );
}
export function IconButton({
  icon,
  label,
  active = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${s.iconButton} ${active ? s.iconActive : ""} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
export function EmptyState({
  title,
  body,
  action,
  icon = "headphones",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={s.emptyState}>
      <span className={s.emptyMark}>
        <Icon name={icon} size={31} />
      </span>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
export function Loading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? s.loadingCompact : s.loading}
      role="status"
      aria-label="正在载入"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
      {!compact && <small>声音正从远处而来</small>}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <EmptyState
      title="这一程，暂时没有接通"
      body={error.message}
      icon="refresh"
      action={
        <button className={s.secondaryButton} onClick={retry}>
          <Icon name="refresh" size={16} />
          重新连接
        </button>
      }
    />
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  label,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) || [],
      ).filter((x) => !x.hidden);
    const focusTimer = window.setTimeout(() => {
      (
        node?.querySelector<HTMLElement>("[data-autofocus]") ||
        focusables()[0] ||
        node
      )?.focus();
    }, 30);
    return () => {
      clearTimeout(focusTimer);
      if (old?.isConnected) old.focus({ preventScroll: true });
    };
  }, []);
  return (
    <m.div
      className={s.modalBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <m.section
        ref={ref}
        className={`${s.dialog} ${wide ? s.dialogWide : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        tabIndex={-1}
        initial={{ y: 18, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const items = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
              ) || [],
            ).filter((x) => x.offsetParent !== null);
            if (!items.length) {
              event.preventDefault();
              return;
            }
            const first = items[0],
              last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className={s.dialogHeader}>
          <div>
            <span className={s.eyebrow}>TINGCHAO / MUSIC</span>
            <h2>{title}</h2>
          </div>
          <IconButton icon="close" label="关闭对话框" onClick={onClose} />
        </div>
        {children}
      </m.section>
    </m.div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.sectionHeading}>
      <div>
        {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Brand() {
  return (
    <div className={s.brand}>
      <TideMark size={38} />
      <div>
        <strong>听潮</strong>
        <small>TINGCHAO MUSIC</small>
      </div>
    </div>
  );
}
