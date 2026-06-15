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

/* Özgün marka: bir girdiden iki seçeneğe ayrılan "karar düğümü" (Vercel üçgeni DEĞİL) */
const Brand = ({ s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M6 10h3.5M9.5 10L13.5 6M9.5 10L13.5 14" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5" cy="10" r="2" fill="var(--accent)" />
    <circle cx="14.5" cy="5.5" r="1.8" fill="var(--fg)" />
    <circle cx="14.5" cy="14.5" r="1.8" fill="var(--fg)" />
  </svg>
);

// q.options + her zaman görünen "Other" şıkkı; Other son indekstir.
function fullOptions(q) {
  return [...q.options, { label: CUSTOM_LABEL, description: CUSTOM_DESC, custom: true }];
}
