import { useState } from "react";
import type { DocumentKind, Stratum } from "../../types";
import { useRegistry } from "../../store/registry";
import { sectionLabelClass } from "../ui/primitives";
import { IconDocument, IconPlus, IconTrash } from "../icons";

const KINDS: [DocumentKind, string][] = [
  ["sale-deed", "Sale deed"],
  ["sanctioned-plan", "Sanctioned plan"],
  ["encumbrance-certificate", "Encumbrance certificate"],
  ["occupancy-certificate", "Occupancy certificate"],
  ["tax-receipt", "Tax receipt"],
  ["other", "Other"],
];

const LABEL = Object.fromEntries(KINDS) as Record<DocumentKind, string>;

export function DocumentVault({ stratum }: { stratum: Stratum }) {
  const attachDocument = useRegistry((s) => s.attachDocument);
  const removeDocument = useRegistry((s) => s.removeDocument);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DocumentKind>("sale-deed");

  const documents = stratum.documents ?? [];

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    attachDocument(stratum.id, trimmed, kind);
    setName("");
    setAdding(false);
  };

  return (
    <div className="border-b border-line px-3 py-3">
      <div className="flex items-center justify-between">
        <span className={sectionLabelClass}>Attached documents</span>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 text-[10px] text-dim hover:text-text"
        >
          <IconPlus size={11} /> attach
        </button>
      </div>

      {documents.length === 0 && !adding && (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          No instrument attached to this volume yet.
        </p>
      )}

      <div className="mt-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-2 border-b border-line py-1.5 last:border-b-0">
            <IconDocument size={12} className="mt-0.5 shrink-0 text-faint" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] text-text">{doc.name}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                {LABEL[doc.kind]} · {doc.addedOn}
              </div>
            </div>
            <button
              onClick={() => removeDocument(stratum.id, doc.id)}
              className="text-faint hover:text-[#cc3b2e]"
            >
              <IconTrash size={11} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-2 space-y-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Instrument reference, e.g. Doc 4821/2026"
            className="h-7 w-full rounded-sm border border-line bg-base px-2 text-[11px] outline-none focus:border-accent-dim"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DocumentKind)}
            className="h-7 w-full rounded-sm border border-line bg-base px-1.5 text-[11px] outline-none focus:border-accent-dim"
          >
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            className="h-7 w-full rounded-sm bg-accent text-[11px] font-medium text-white hover:bg-accent-strong"
          >
            Attach
          </button>
        </div>
      )}
    </div>
  );
}
