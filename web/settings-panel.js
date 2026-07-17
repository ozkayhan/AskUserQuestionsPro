/* global React, Settings_Schema */
/* askuseroz · settings-panel — ortada modal ayar paneli + sol-alt fab. Şema-tabanlı:
   tüm kontroller Settings_Schema.entries()'ten türer. Canlı önizleme + Kaydet. */
const { useState: useStateSet, useEffect: useEffectSet, useRef: useRefSet } = React;

function currentSettings() {
  const value = typeof window !== 'undefined' && (window.__ASKUSER_SETTINGS_V2__ || window.__ASKUSER_SETTINGS__);
  if (value && value._v === 2 && value.browser) {
    return Object.assign({}, Settings_Schema.defaults(), value.browser, {
      qtypeBinary: value.browser.questionTypes.binary,
      qtypeScale: value.browser.questionTypes.scale,
      qtypeRanking: value.browser.questionTypes.ranking,
      qtypeTree: value.browser.questionTypes.tree,
      autoAdvance: value.browser.behavior.autoAdvance,
      confirmSubmit: value.browser.behavior.confirmSubmit,
      showKeyHints: value.browser.interface.showKeyHints,
      showCounter: value.browser.interface.showCounter,
      focusMode: value.browser.interface.focusMode,
    });
  }
  return value || Settings_Schema.defaults();
}

/* Sol-alt sabit ayar (dişli) butonu — her ekranda görünür. */
function SettingsButton({ onOpen }) {
  return (
    <button className="settings-fab" onClick={onOpen} title="Settings" aria-label="Settings">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

/* Tek kontrol satırı — type'a göre select segment veya toggle switch. */
function SettingRow({ entry, value, onChange }) {
  return (
    <div className="setting-row">
      <div className="setting-row__label">{entry.label}</div>
      {entry.type === 'toggle' ? (
        <button
          className="setting-toggle"
          data-on={value === true}
          type="button"
          role="switch"
          aria-checked={value === true}
          aria-label={entry.label}
          onClick={() => onChange(!value)}
        >
          <span className="setting-toggle__dot" />
        </button>
      ) : (
        <div className="setting-seg">
          {entry.options.map((o) => (
            <button
              key={o.value}
              className="setting-seg__btn"
              data-active={o.value === value}
              type="button"
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ onClose }) {
  // ponytail: sessionBaseline frozen at open-time; used for sticky needsReload comparison.
  const sessionBaseline = useRefSet(() => ({ ...currentSettings() })).current;
  const [baseline, setBaseline] = useStateSet(() => ({ ...currentSettings() }));
  const [draft, setDraft] = useStateSet(() => ({ ...currentSettings() }));
  const [saved, setSaved] = useStateSet(false);
  const [saveError, setSaveError] = useStateSet(false);
  const [needsReload, setNeedsReload] = useStateSet(false);
  // ponytail: isSaving guard — prevents double-save and guards cancel/Escape during fetch.
  const [isSaving, setIsSaving] = useStateSet(false);
  // AbortController ref for in-flight save fetch; aborted on unmount.
  const abortRef = useRefSet(null);

  // Esc ile kapat (cancel = revert) — blocked while saving.
  useEffectSet(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      // Abort any in-flight save fetch on unmount.
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function change(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    // Clear stale error/reload notices when the user makes a new change.
    setSaveError(false);
    const e = Settings_Schema.byKey(key);
    if (e && e.applies === 'live') {
      try {
        e.apply(value);
      } catch (err) {
        /* yok say */
      }
    }
  }

  function cancel() {
    // Block cancel while save is in-flight to avoid state inconsistency.
    if (isSaving) return;
    // Kaydedilmişse revert etme — sadece önizleme yapılıp vazgeçilmişse geri al.
    if (!saved) Settings_Schema.applyAll(baseline);
    onClose();
  }

  function save() {
    // ponytail: reentrancy guard — double-save protection.
    if (isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    // Capture draft at submit time; only accept response if draft hasn't changed.
    const submittedDraft = draft;
    const ac = new AbortController();
    abortRef.current = ac;
    fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submittedDraft),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res || !res.ok) throw new Error('save failed');
        window.__ASKUSER_SETTINGS__ = res.settings;
        // ponytail: compare against sessionBaseline so needsReload stays sticky across
        // multiple saves (e.g. save reduceMotion, then save theme — reload notice persists).
        const reloadChanged = Settings_Schema.entries().some(
          (e) => e.applies === 'reload' && res.settings[e.key] !== sessionBaseline[e.key]
        );
        setNeedsReload((prev) => prev || reloadChanged);
        setBaseline({ ...res.settings });
        setIsSaving(false);
        setSaved(true);
      })
      .catch((err) => {
        // Ignore abort errors (unmount cleanup).
        if (err && err.name === 'AbortError') return;
        setIsSaving(false);
        setSaved(false);
        setSaveError(true);
      });
  }

  const groups = Settings_Schema.groups();
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-description">
        <h2 id="settings-title" className="sr-only">Settings</h2>
        <p id="settings-description" className="sr-only">Review and save your AskUserQuestionsPro settings.</p>
        <div className="settings__chip">Settings</div>
        {groups.map((g) => (
          <div key={g} className="settings__group">
            <div className="settings__group-title">{g}</div>
            {Settings_Schema.entries()
              .filter((e) => e.group === g)
              .map((e) => (
                <SettingRow
                  key={e.key}
                  entry={e}
                  value={draft[e.key]}
                  onChange={(v) => change(e.key, v)}
                />
              ))}
          </div>
        ))}
        {needsReload && (
          <div className="settings__notice">Reload the page for this to fully take effect.</div>
        )}
        {saveError && <div className="settings__notice">Save failed — please try again.</div>}
        <div className="settings__foot">
          <span className="settings__saved">{saved ? 'Saved ✓' : ''}</span>
          <div className="settings__actions">
            <button className="btn" onClick={cancel} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Boot: yüklemede inject edilen ayarları uygula (uiScale/reduceMotion; tema themes.js'te). */
if (typeof window !== 'undefined' && window.__ASKUSER_SETTINGS__) {
  Settings_Schema.applyAll(window.__ASKUSER_SETTINGS__);
}
