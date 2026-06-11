/* global React */
/* askuseroz · ui-kit — ikonlar, sabitler, saf yardımcılar (durumsuz, JSX) */

const CUSTOM_LABEL = "Other";
const CUSTOM_DESC = "Let me describe something else.";

/* ── ikonlar (design-reference/project/app.jsx ile birebir) ── */
const Check = ({ c = "currentColor", s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3.5 8.5l3 3 6-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

// q.options + her zaman görünen "Other" şıkkı; Other son indekstir.
function fullOptions(q) {
  return [...q.options, { label: CUSTOM_LABEL, description: CUSTOM_DESC, custom: true }];
}
