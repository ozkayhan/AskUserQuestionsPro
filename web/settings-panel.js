/* global React, Settings_Schema */
/* askuseroz · settings-panel — ortada modal ayar paneli + sol-alt fab. Şema-tabanlı:
   tüm kontroller Settings_Schema.entries()'ten türer. Canlı önizleme + Kaydet. */
const { useState: useStateSet, useEffect: useEffectSet } = React;

function currentSettings() {
  return (typeof window !== "undefined" && window.__ASKUSER_SETTINGS__) || Settings_Schema.defaults();
}

/* Sol-alt sabit ayar (dişli) butonu — her ekranda görünür. */
function SettingsButton({ onOpen }) {
  return (
    <button className="settings-fab" onClick={onOpen} title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
           strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      {entry.type === "toggle" ? (
        <button className="setting-toggle" data-on={value === true} type="button"
                role="switch" aria-checked={value === true}
                onClick={() => onChange(!value)}>
          <span className="setting-toggle__dot" />
        </button>
      ) : (
        <div className="setting-seg">
          {entry.options.map((o) => (
            <button key={o.value} className="setting-seg__btn" data-active={o.value === value}
                    type="button" onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ onClose }) {
  const [baseline, setBaseline] = useStateSet(() => ({ ...currentSettings() }));
  const [draft, setDraft] = useStateSet(() => ({ ...currentSettings() }));
  const [saved, setSaved] = useStateSet(false);
  const [saveError, setSaveError] = useStateSet(false);
  const [needsReload, setNeedsReload] = useStateSet(false);

  // Esc ile kapat (cancel = revert).
  useEffectSet(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  function change(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    const e = Settings_Schema.byKey(key);
    if (e && e.applies === "live") { try { e.apply(value); } catch (err) { /* yok say */ } }
  }

  function cancel() {
    // Kaydedilmişse revert etme — sadece önizleme yapılıp vazgeçilmişse geri al.
    if (!saved) Settings_Schema.applyAll(baseline);
    onClose();
  }

  function save() {
    setSaveError(false);
    fetch("/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res || !res.ok) throw new Error("save failed");
        window.__ASKUSER_SETTINGS__ = res.settings;
        // reload gerektiren bir ayar değiştiyse kullanıcıyı uyar.
        const reloadChanged = Settings_Schema.entries().some((e) =>
          e.applies === "reload" && res.settings[e.key] !== baseline[e.key]);
        setNeedsReload(reloadChanged);
        setBaseline({ ...res.settings });
        setSaved(true);
      })
      .catch(() => { setSaved(false); setSaveError(true); });
  }

  const groups = Settings_Schema.groups();
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="settings">
        <div className="settings__chip">Settings</div>
        {groups.map((g) => (
          <div key={g} className="settings__group">
            <div className="settings__group-title">{g}</div>
            {Settings_Schema.entries().filter((e) => e.group === g).map((e) => (
              <SettingRow key={e.key} entry={e} value={draft[e.key]}
                          onChange={(v) => change(e.key, v)} />
            ))}
          </div>
        ))}
        {needsReload && (
          <div className="settings__notice">Reload the page for this to fully take effect.</div>
        )}
        {saveError && (
          <div className="settings__notice">Save failed — please try again.</div>
        )}
        <div className="settings__foot">
          <span className="settings__saved">{saved ? "Saved ✓" : ""}</span>
          <div className="settings__actions">
            <button className="btn" onClick={cancel}>Cancel</button>
            <button className="btn btn--primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Boot: yüklemede inject edilen ayarları uygula (uiScale/reduceMotion; tema themes.js'te). */
if (typeof window !== "undefined" && window.__ASKUSER_SETTINGS__) {
  Settings_Schema.applyAll(window.__ASKUSER_SETTINGS__);
}
