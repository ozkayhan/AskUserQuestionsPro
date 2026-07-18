/* global React, Settings_Schema */
/* askuseroz · settings-panel — ortada modal ayar paneli + sol-alt fab. Şema-tabanlı:
   tüm kontroller Settings_Schema.entries()'ten türer. Canlı önizleme + Kaydet. */
const { useState: useStateSet, useEffect: useEffectSet, useRef: useRefSet } = React;

function currentSettings() {
  const value =
    typeof window !== 'undefined' &&
    (window.__ASKUSER_SETTINGS_V2__ || window.__ASKUSER_SETTINGS__);
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
function SettingsButton({ onOpen, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      className="settings-fab"
      onClick={onOpen}
      title="Settings"
      aria-label="Settings"
    >
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
      <div className="setting-row__copy">
        <div className="setting-row__label">{entry.label}</div>
        <div className="setting-row__description">
          Configure {entry.label.toLowerCase()} for this round.
        </div>
        <div className="setting-row__effect">
          Current value: <strong>{String(value)}</strong> · Applies{' '}
          {entry.applies === 'reload' ? 'after reload' : 'now'}
        </div>
      </div>
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

const SETTINGS_NAMESPACES = [
  'browser',
  'recovery',
  'autosave',
  'diagnostics',
  'delivery',
  'closure',
  'adapters',
];

function currentEnvelope() {
  const value = typeof window !== 'undefined' && window.__ASKUSER_SETTINGS_V2__;
  return value && value._v === 2
    ? JSON.parse(JSON.stringify(value))
    : Settings_Schema.envelopeFromLegacy(currentSettings());
}

async function settingsJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Settings request failed');
  return body;
}

function SettingsDataPanel({ sessionBaseline, onSettingsChanged }) {
  const [doctor, setDoctor] = useStateSet(null);
  const [doctorError, setDoctorError] = useStateSet('');
  const [busy, setBusy] = useStateSet(false);
  const [message, setMessage] = useStateSet('');
  const [error, setError] = useStateSet('');
  const [namespace, setNamespace] = useStateSet('browser');
  const [preview, setPreview] = useStateSet(null);
  const importRef = useRefSet(null);

  async function loadDoctor() {
    try {
      setDoctorError('');
      const result = await settingsJson('/settings/doctor');
      setDoctor(result);
      return result;
    } catch (err) {
      setDoctorError(err.message || 'Could not load settings status.');
      return null;
    }
  }

  useEffectSet(() => {
    loadDoctor();
  }, []);

  function clearFeedback() {
    setMessage('');
    setError('');
  }

  async function previewPayload(payload, successMessage) {
    clearFeedback();
    setBusy(true);
    try {
      const status = doctor || (await loadDoctor());
      const result = await settingsJson('/settings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, baselineRevision: status && status.revision }),
      });
      setPreview({ payload, result, successMessage });
    } catch (err) {
      setError(err.message || 'Could not preview settings.');
    } finally {
      setBusy(false);
    }
  }

  async function applyPreview() {
    if (!preview || !preview.result.canApply) return;
    clearFeedback();
    setBusy(true);
    try {
      const result = await settingsJson('/settings/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId: preview.result.previewId,
          payload: preview.payload,
          baselineRevision: preview.result.baselineRevision,
        }),
      });
      onSettingsChanged(result.settings);
      setPreview(null);
      setMessage(preview.successMessage || 'Settings applied.');
      await loadDoctor();
    } catch (err) {
      setError(err.message || 'Could not apply settings. Refresh the preview and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await previewPayload(payload, `Preview ready for ${file.name}.`);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err.message);
    }
  }

  async function resetNamespace() {
    if (!doctor || !window.confirm(`Reset the ${namespace} settings to defaults?`)) return;
    clearFeedback();
    setBusy(true);
    try {
      const result = await settingsJson('/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace, baselineRevision: doctor.revision }),
      });
      onSettingsChanged(result.settings);
      setMessage(`${namespace} reset to defaults.`);
      await loadDoctor();
    } catch (err) {
      setError(err.message || 'Could not reset this namespace.');
    } finally {
      setBusy(false);
    }
  }

  function rollbackSession() {
    previewPayload(sessionBaseline, 'Session-start settings are ready to apply.');
  }

  const effective = doctor && doctor.effective;
  return (
    <div className="settings__data" aria-labelledby="settings-data-title">
      <div id="settings-data-title" className="settings__group-title">
        Data & recovery
      </div>
      <p className="settings__data-copy">
        Export a portable backup, review an import before it changes anything, or recover one
        namespace without touching the others.
      </p>
      <div className="settings__data-actions">
        <button
          className="btn"
          type="button"
          onClick={() => {
            const link = document.createElement('a');
            link.href = '/settings/export';
            link.download = 'askuserquestionspro-settings-v2.json';
            link.click();
          }}
          disabled={busy}
        >
          Export backup
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => importRef.current?.click()}
          disabled={busy}
        >
          Import backup
        </button>
        <input
          ref={importRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />
      </div>
      {preview && (
        <div className="settings__preview" role="status" aria-live="polite">
          <strong>Import preview</strong>
          <span>
            {preview.result.valid ? 'Schema is valid.' : 'Schema needs attention.'}{' '}
            {preview.result.migration ? 'Legacy format will be migrated safely.' : ''}
          </span>
          {preview.result.ignored && preview.result.ignored.count > 0 && (
            <span>{preview.result.ignored.count} unknown field(s) will be ignored.</span>
          )}
          {preview.result.errors?.length > 0 && (
            <span className="settings__notice--error">
              {preview.result.errors.map((item) => item.error).join(', ')}
            </span>
          )}
          <div className="settings__data-actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={applyPreview}
              disabled={busy || !preview.result.canApply}
            >
              Apply import
            </button>
            <button className="btn" type="button" onClick={() => setPreview(null)} disabled={busy}>
              Discard
            </button>
          </div>
        </div>
      )}
      <div className="settings__reset-row">
        <select
          aria-label="Settings namespace"
          value={namespace}
          onChange={(event) => setNamespace(event.target.value)}
          disabled={busy}
        >
          {SETTINGS_NAMESPACES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="btn" type="button" onClick={resetNamespace} disabled={busy || !doctor}>
          Reset namespace
        </button>
        <button className="btn" type="button" onClick={rollbackSession} disabled={busy}>
          Undo session changes
        </button>
      </div>
      {message && (
        <div className="settings__notice" role="status" aria-live="polite">
          {message}
        </div>
      )}
      {error && (
        <div
          className="settings__notice settings__notice--error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
      {doctorError && (
        <div className="settings__notice settings__notice--error" role="alert">
          {doctorError}
        </div>
      )}
      <details className="settings__doctor">
        <summary>Effective settings & health</summary>
        {effective ? (
          <pre>
            {JSON.stringify(
              { status: doctor.status, migration: doctor.migration, effective },
              null,
              2
            )}
          </pre>
        ) : (
          <span>Loading…</span>
        )}
        <button className="btn" type="button" onClick={loadDoctor} disabled={busy}>
          Refresh status
        </button>
      </details>
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
  const sessionBaselineEnvelope = useRefSet(() => currentEnvelope()).current;
  // ponytail: isSaving guard — prevents double-save and guards cancel/Escape during fetch.
  const [isSaving, setIsSaving] = useStateSet(false);
  // AbortController ref for in-flight save fetch; aborted on unmount.
  const abortRef = useRefSet(null);
  const dialogRef = useRefSet(null);
  const closeRef = useRefSet(null);

  // Esc ile kapat (cancel = revert) — blocked while saving.
  useEffectSet(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!isSaving) cancel();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = [
          ...dialogRef.current.querySelectorAll('button:not([disabled]), input, select, textarea'),
        ];
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isSaving]);

  // Abort only when the modal is actually unmounted. The keyboard effect above
  // also tracks isSaving, so aborting from its cleanup would cancel every save
  // immediately after the state changes to true.
  useEffectSet(
    () => () => {
      if (abortRef.current) abortRef.current.abort();
    },
    []
  );

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
        // Keep both settings representations aligned. The v2 envelope is the
        // source used when the modal opens; leaving it stale makes a later
        // unsaved change revert to the pre-save value instead of the last
        // persisted setting.
        const nextEnvelope = currentEnvelope();
        nextEnvelope.browser = Settings_Schema.mergeBrowserLegacy(
          nextEnvelope.browser,
          res.settings
        );
        window.__ASKUSER_SETTINGS_V2__ = nextEnvelope;
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

  function adoptEnvelope(envelope) {
    const legacy = Settings_Schema.browserToLegacy(envelope.browser);
    window.__ASKUSER_SETTINGS_V2__ = envelope;
    window.__ASKUSER_SETTINGS__ = legacy;
    Settings_Schema.applyAll(legacy);
    const next = { ...legacy };
    setBaseline(next);
    setDraft(next);
    setNeedsReload(
      (prev) =>
        prev ||
        Settings_Schema.entries().some(
          (e) => e.applies === 'reload' && next[e.key] !== sessionBaseline[e.key]
        )
    );
    setSaved(true);
  }

  const groups = Settings_Schema.groups();
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
      >
        <h2 id="settings-title" className="sr-only">
          Settings
        </h2>
        <p id="settings-description" className="sr-only">
          Review and save your AskUserQuestionsPro settings.
        </p>
        <div className="settings__head">
          <div className="settings__chip">Settings</div>
          <button
            ref={closeRef}
            className="btn settings__close"
            onClick={cancel}
            disabled={isSaving}
            aria-label="Close settings"
          >
            Close
          </button>
        </div>
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
        <SettingsDataPanel
          sessionBaseline={sessionBaselineEnvelope}
          onSettingsChanged={adoptEnvelope}
        />
        {needsReload && (
          <div role="status" aria-live="polite" className="settings__notice">
            Reload the page for this to fully take effect.
          </div>
        )}
        {saveError && (
          <div
            role="alert"
            aria-live="assertive"
            className="settings__notice settings__notice--error"
          >
            Settings could not be saved. Your previous settings are still active. Try again.
          </div>
        )}
        <div className="settings__foot">
          <span role="status" aria-live="polite" className="settings__saved">
            {saved ? 'Settings saved.' : ''}
          </span>
          <div className="settings__actions">
            <button className="btn" onClick={cancel} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save settings'}
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
