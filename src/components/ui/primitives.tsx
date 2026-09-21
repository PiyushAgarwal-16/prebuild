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




