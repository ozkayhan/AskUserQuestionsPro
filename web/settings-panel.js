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

function settingValueLabel(entry, value) {
  if (entry.type === 'toggle') return value ? 'On' : 'Off';
  const option = entry.options.find((item) => item.value === value);
  return option ? option.label : String(value);
}

/* Tek kontrol satırı — type'a göre select segment veya toggle switch. */
function SettingRow({ entry, value, onChange }) {
  const controlId = `setting-${entry.key}`;
  const valueLabel = settingValueLabel(entry, value);
  return (
    <div className="setting-row" data-setting={entry.key}>
      <div className="setting-row__copy">
        <div id={`${controlId}-label`} className="setting-row__label">
          {entry.label}
        </div>
        <div id={`${controlId}-description`} className="setting-row__description">
          {entry.description}
        </div>
        <div className="setting-row__meta">
          <span>
            Current: <strong>{valueLabel}</strong>
          </span>
          <span className="setting-row__effect" data-applies={entry.applies}>
            {entry.applies === 'reload' ? 'After reload' : 'Applies now'}
          </span>
        </div>
      </div>
      {entry.type === 'toggle' ? (
        <button
          id={controlId}
          className="setting-toggle"
          data-on={value === true}
          type="button"
          role="switch"
          aria-checked={value === true}
          aria-label={entry.label}
          aria-describedby={`${controlId}-description`}
          onClick={() => onChange(!value)}
        >
          <span className="setting-toggle__dot" />
        </button>
      ) : (
        <div className="setting-seg" role="group" aria-labelledby={`${controlId}-label`}>
          {entry.options.map((o) => (
            <button
              key={o.value}
              className="setting-seg__btn"
              data-active={o.value === value}
              type="button"
              aria-pressed={o.value === value}
              aria-label={`${entry.label}: ${o.label}`}
              aria-describedby={`${controlId}-description`}
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

const SETTINGS_NAMESPACE_LABELS = {
  browser: 'Browser',
  recovery: 'Recovery',
  autosave: 'Autosave',
  diagnostics: 'Diagnostics',
  delivery: 'Delivery',
  closure: 'Closure',
  adapters: 'Adapters',
};

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
  const [dataOpen, setDataOpen] = useStateSet(false);
  const [resetConfirm, setResetConfirm] = useStateSet(false);
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
    setDataOpen(true);
    try {
      const payload = JSON.parse(await file.text());
      await previewPayload(payload, `Preview ready for ${file.name}.`);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err.message);
    }
  }

  async function resetNamespace() {
    if (!doctor) return;
    setResetConfirm(false);
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
    setDataOpen(true);
    previewPayload(sessionBaseline, 'Session-start settings are ready to apply.');
  }

  const effective = doctor && doctor.effective;
  return (
    <details
      className="settings__data"
      open={dataOpen}
      onToggle={(event) => setDataOpen(event.currentTarget.open)}
    >
      <summary id="settings-data-title" className="settings__data-summary">
        <span>
          <strong>Data & recovery</strong>
          <small>Backups, imports, and targeted resets</small>
        </span>
        <span className="settings__summary-chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="settings__data-body">
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
              <button
                className="btn"
                type="button"
                onClick={() => setPreview(null)}
                disabled={busy}
              >
                Discard
              </button>
            </div>
          </div>
        )}
        <div className="settings__reset-row">
          <label htmlFor="settings-namespace">Reset one area</label>
          <select
            id="settings-namespace"
            aria-label="Settings namespace"
            value={namespace}
            onChange={(event) => {
              setNamespace(event.target.value);
              setResetConfirm(false);
            }}
            disabled={busy}
          >
            {SETTINGS_NAMESPACES.map((item) => (
              <option key={item} value={item}>
                {SETTINGS_NAMESPACE_LABELS[item]}
              </option>
            ))}
          </select>
          <button
            className="btn btn--danger-quiet"
            type="button"
            onClick={() => setResetConfirm(true)}
            disabled={busy || !doctor}
          >
            Reset area
          </button>
          <button className="btn" type="button" onClick={rollbackSession} disabled={busy}>
            Undo session changes
          </button>
        </div>
        {resetConfirm && (
          <div className="settings__confirm" role="alertdialog" aria-labelledby="reset-title">
            <div>
              <strong id="reset-title">Reset {SETTINGS_NAMESPACE_LABELS[namespace]}?</strong>
              <span>This only changes this area. You can cancel before applying it.</span>
            </div>
            <div className="settings__data-actions">
              <button className="btn" type="button" onClick={() => setResetConfirm(false)}>
                Keep settings
              </button>
              <button className="btn btn--danger" type="button" onClick={resetNamespace}>
                Reset area
              </button>
            </div>
          </div>
        )}
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
          <summary>Advanced: effective settings & health</summary>
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
    </details>
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
  const [showDiscardPrompt, setShowDiscardPrompt] = useStateSet(false);
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

  function discardAndClose() {
    if (isSaving) return;
    Settings_Schema.applyAll(baseline);
    setShowDiscardPrompt(false);
    onClose();
  }

  function cancel() {
    // Block cancel while save is in-flight to avoid state inconsistency.
    if (isSaving) return;
    if (isDirty) {
      setShowDiscardPrompt(true);
      return;
    }
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
        setShowDiscardPrompt(false);
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
  const changedCount = Settings_Schema.entries().filter(
    (entry) => draft[entry.key] !== baseline[entry.key]
  ).length;
  const isDirty = changedCount > 0;
  const groupDescriptions = {
    Appearance: 'Personalize the look and feel.',
    'Question types': 'Choose formats allowed in new rounds.',
    Behavior: 'Choose how rounds advance and submit.',
    Interface: 'Keep the workspace focused.',
  };
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
        <div className="settings__head">
          <div className="settings__heading">
            <span className="settings__eyebrow">Workspace preferences</span>
            <h2 id="settings-title">Settings</h2>
            <p id="settings-description">
              Tune the workspace. Changes preview instantly and save together.
            </p>
          </div>
          <button
            ref={closeRef}
            className="btn settings__close"
            onClick={cancel}
            disabled={isSaving}
            aria-label="Close settings"
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close settings</span>
          </button>
        </div>
        <div className="settings__statusbar" role="status" aria-live="polite">
          <span
            className={isDirty ? 'settings__status settings__status--dirty' : 'settings__status'}
          >
            <span className="settings__status-dot" aria-hidden="true" />
            {isDirty
              ? `${changedCount} unsaved ${changedCount === 1 ? 'change' : 'changes'}`
              : saved
                ? 'All changes saved'
                : 'No changes yet'}
          </span>
          <span className="settings__status-hint">Esc to close</span>
        </div>
        <div className="settings__body">
          {groups.map((g) => (
            <section key={g} className="settings__group" aria-labelledby={`settings-group-${g}`}>
              <div className="settings__group-head">
                <h3 id={`settings-group-${g}`} className="settings__group-title">
                  {g}
                </h3>
                <p>{groupDescriptions[g]}</p>
              </div>
              <div className="settings__group-rows">
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
            </section>
          ))}
          <SettingsDataPanel
            sessionBaseline={sessionBaselineEnvelope}
            onSettingsChanged={adoptEnvelope}
          />
          {needsReload && (
            <div
              role="status"
              aria-live="polite"
              className="settings__notice settings__notice--reload"
            >
              <strong>Reload required</strong>
              <span>Reload the page after saving for this change to fully take effect.</span>
            </div>
          )}
          {saveError && (
            <div
              role="alert"
              aria-live="assertive"
              className="settings__notice settings__notice--error"
            >
              <strong>Couldn’t save settings</strong>
              <span>Your previous settings are still active. Try again.</span>
            </div>
          )}
        </div>
        {showDiscardPrompt && (
          <div className="settings__discard" role="alertdialog" aria-labelledby="discard-title">
            <div>
              <strong id="discard-title">Discard unsaved changes?</strong>
              <span>Your current choices will be reverted.</span>
            </div>
            <div className="settings__actions">
              <button className="btn" type="button" onClick={() => setShowDiscardPrompt(false)}>
                Keep editing
              </button>
              <button className="btn btn--danger" type="button" onClick={discardAndClose}>
                Discard changes
              </button>
            </div>
          </div>
        )}
        <div className="settings__foot">
          <span role="status" aria-live="polite" className="settings__saved">
            {isSaving ? 'Saving your changes…' : saved && !isDirty ? 'Settings saved.' : ''}
          </span>
          <div className="settings__actions">
            <button className="btn" type="button" onClick={cancel} disabled={isSaving}>
              {isDirty ? 'Review & close' : 'Close'}
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={save}
              disabled={isSaving || !isDirty}
            >
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
