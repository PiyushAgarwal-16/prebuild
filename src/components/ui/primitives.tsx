export const sectionLabelBase = "font-mono text-[9px] uppercase tracking-[0.16em]";
export const fieldLabelBase = "font-mono text-[9px] uppercase tracking-[0.14em]";
export const microLabelBase = "font-mono text-[8px] uppercase tracking-[0.12em]";

export const sectionLabelClass = `${sectionLabelBase} text-faint`;
export const fieldLabelClass = `${fieldLabelBase} text-faint`;
export const microLabelClass = `${microLabelBase} text-faint`;

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-sm border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function SmallLabel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`${sectionLabelClass} ${className}`}>
      {children}
    </span>
  );
}

export function SectionHead({
  title,
  aside,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2.5">
      <SmallLabel>{title}</SmallLabel>
      {aside}
    </div>
  );
}

export function FactRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className={fieldLabelClass}>{label}</span>
      <span className="text-right text-[12px] text-text">{value}</span>
    </div>
  );
}

export function TextLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 text-[12px] text-accent transition-colors hover:text-accent-strong"
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </button>
  );
}
