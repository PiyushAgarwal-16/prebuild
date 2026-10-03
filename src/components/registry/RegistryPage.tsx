import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyUlpin } from "../../registry/client";
import type { VerifyResult } from "../../registry/types";
import { useRegistry } from "../../store/registry";
import { baseCentroid, BAND_LABEL, describeLevel, parseUlpin, validateUlpin } from "../../lib/ulpin";
import { formatLngLat } from "../../lib/geo";
import { TENURE_COLOR, TENURE_LABEL, USE_COLOR, USE_LABEL } from "../../lib/palette";
import { IconAlert, IconCheck, IconClose, IconSearch } from "../icons";
import { fieldLabelClass, sectionLabelClass } from "../ui/primitives";

function ValidatorCard() {
  const strata = useRegistry((s) => s.strata);
  const selectStratum = useRegistry((s) => s.selectStratum);
  const navigate = useNavigate();
  const [input, setInput] = useState("");

  const trimmed = input.trim().toUpperCase();
  const parts = parseUlpin(trimmed);
  const valid = trimmed ? validateUlpin(trimmed) : null;
  const centroid = parts ? baseCentroid(parts.base) : null;
  const match = strata.find((s) => s.ulpin === trimmed);
  const [official, setOfficial] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (trimmed.length < 8) {
      setOfficial(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      verifyUlpin(trimmed)
        .then((result) => {
          if (!cancelled) setOfficial(result);
        })
        .catch(() => {
          if (!cancelled) setOfficial(null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className={sectionLabelClass}>
        ULPIN validator
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
        Paste any 3D ULPIN to verify its check character, decode the vertical position, and recover the
        parcel centroid from the embedded geocode — no database lookup required.
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
        Assumes an identifier this system generated. A base declared from an external land record is
        not validated here.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="29TDR1V9QTJ1XH-F07-002-M"
          className="h-9 flex-1 rounded-sm border border-line bg-base px-3 font-mono text-[12px] tracking-wider outline-none focus:border-accent-dim"
        />
        {input && (
          <button
            onClick={() => setInput("")}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-faint hover:text-text"
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      {trimmed && (
        <div className="mt-3 space-y-2">
          <div
            className={`flex items-center gap-2 rounded-sm px-3 py-2 text-[11px] ${
              valid
                ? "border border-[#c5ddc9] bg-[#eef5ef] text-[#2f6a4b]"
                : "border border-[#e0b5ae] bg-[#fbeae8] text-[#8a3226]"
            }`}
          >
            {valid ? <IconCheck size={13} /> : <IconAlert size={13} />}
            {valid
              ? "Structure and ISO 7064 MOD 37,36 check character are valid"
              : "Invalid — malformed structure or failed check character"}
          </div>
          <div
            className={`flex items-start gap-2 rounded-sm border px-3 py-2 text-[11px] ${
              official?.registered
                ? "border-[#c5ddc9] bg-[#eef5ef] text-[#2f6a4b]"
                : "border-line bg-raised text-dim"
            }`}
          >
            {official?.registered ? <IconCheck size={13} /> : <IconSearch size={13} />}
            <div>
              <div>
                {checking
                  ? "Checking the authoritative register…"
                  : official?.registered
                    ? `On the register — ${official.use}, level ${official.level}, since ${new Date(official.registeredAt ?? "").toLocaleDateString()}`
                    : "Not on the authoritative register"}
              </div>
              {official?.registered && (
                <div className="mt-0.5 text-[10px] opacity-80">
                  {official.encumbered ? "Encumbrance recorded" : "No encumbrance recorded"} · holder
                  details are not disclosed to public lookups
                </div>
              )}
            </div>
          </div>

          {parts && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-sm border border-line bg-raised px-3 py-2.5 text-[11px]">
              <dt className="text-faint">Parcel geocode</dt>
              <dd className="text-right font-mono">{parts.base}</dd>
              <dt className="text-faint">Vertical band</dt>
              <dd className="text-right">{BAND_LABEL[parts.band]}</dd>
              <dt className="text-faint">Position</dt>
              <dd className="text-right">{describeLevel(parts.band, parts.level)}</dd>
              <dt className="text-faint">Unit</dt>
              <dd className="text-right font-mono">{parts.unit}</dd>
              {centroid && (
                <>
                  <dt className="text-faint">Decoded centroid</dt>
                  <dd className="text-right font-mono text-[10px]">{formatLngLat(centroid)}</dd>
                </>
              )}
              <dt className="text-faint">In this workspace</dt>
              <dd className="text-right">
                {match ? (
                  <button
                    onClick={() => {
                      selectStratum(match.id);
                      navigate("/app");
                    }}
                    className="text-accent underline underline-offset-2"
                  >
                    {match.label}
                  </button>
                ) : (
                  "not found"
                )}
              </dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

export function RegistryPage() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectStratum = useRegistry((s) => s.selectStratum);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tenure, setTenure] = useState("all");

  const flagged = useMemo(() => {
    const map = new Map<string, "critical" | "warning">();
    for (const c of conflicts)
      for (const id of c.subjects)
        if (c.severity === "critical" || !map.has(id)) map.set(id, c.severity);
    return map;
  }, [conflicts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strata.filter((s) => {
      if (tenure !== "all" && s.tenure !== tenure) return false;
      if (!q) return true;
      const parcel = parcels.find((p) => p.id === s.parcelId);
      return [s.ulpin, s.label, s.holder, s.use, s.tenure, parcel?.surveyNumber ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [strata, parcels, query, tenure]);

  return (
    <div className="h-full overflow-y-auto bg-void px-3 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div className="px-1 pb-1 pt-2">
          <span className={sectionLabelClass}>
            <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle not-italic" />
            VOLUME REGISTER
          </span>
          <h2 className="mt-2 text-[30px] font-light leading-[1.1] tracking-[-0.04em] text-text">
            Every volume,
            <br />
            its own identifier.
          </h2>
        </div>

        <ValidatorCard />

        <div className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[240px] flex-1">
              <IconSearch
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ULPIN, holder, description, survey number…"
                className="h-9 w-full rounded-sm border border-line bg-base pl-8 pr-3 text-[12px] outline-none focus:border-accent-dim"
              />
            </div>
            <select
              value={tenure}
              onChange={(e) => setTenure(e.target.value)}
              className="h-9 rounded-sm border border-line bg-base px-2 text-[11px] outline-none focus:border-accent-dim"
            >
              <option value="all">All tenures</option>
              {Object.entries(TENURE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {rows.length} of {strata.length} volumes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className={fieldLabelClass}>
                  {["3D ULPIN", "Description", "Position", "Use", "Tenure", "Holder", "Built-up", "Status"].map(
                    (h) => (
                      <th key={h} className="border-b border-line px-3 py-2 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const flag = flagged.get(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        selectStratum(s.id);
                        navigate("/app");
                      }}
                      className="cursor-pointer border-b border-line text-[11px] hover:bg-hover"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] tracking-wide">{s.ulpin}</td>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="px-3 py-2 text-dim">{describeLevel(s.band, s.level)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: USE_COLOR[s.use] }}
                          />
                          {USE_LABEL[s.use]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-xs px-1.5 py-0.5 text-[10px]"
                          style={{ background: `${TENURE_COLOR[s.tenure]}22`, color: TENURE_COLOR[s.tenure] }}
                        >
                          {TENURE_LABEL[s.tenure]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-dim">{s.holder}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">{s.builtUpArea} m²</td>
                      <td className="px-3 py-2">
                        {flag ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] ${
                              flag === "critical" ? "text-[#b4553f]" : "text-[#8a6420]"
                            }`}
                          >
                            <IconAlert size={11} /> {flag}
                          </span>
                        ) : (
                          <span className="text-[10px] text-faint">clear</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && (
              <p className="px-3 py-6 text-center text-[11px] text-faint">No volumes match this search.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-line bg-surface p-3">
          <div className={sectionLabelClass}>
            Conflict register — {conflicts.length} open
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {conflicts.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  selectStratum(c.subjects[0]);
                  navigate("/app");
                }}
                className={`rounded-sm border px-3 py-2 text-left text-[11px] leading-relaxed transition-colors ${
                  c.severity === "critical"
                    ? "border-[#e0b5ae] bg-[#fbeae8] text-[#8a3226] hover:border-[#cc3b2e]"
                    : "border-[#e6d3a4] bg-[#fcf4e2] text-[#7a5c1e] hover:border-[#c9a94e]"
                }`}
              >
                <span className="font-mono text-[9px] uppercase tracking-wider">
                  {c.severity} · {c.kind}
                </span>
                <p className="mt-1">{c.message}</p>
              </button>
            ))}
            {!conflicts.length && (
              <p className="rounded-sm border border-[#c5ddc9] bg-[#eef5ef] px-3 py-2 text-[11px] text-[#2f6a4b]">
                No conflicts across {strata.length} registered volumes.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
