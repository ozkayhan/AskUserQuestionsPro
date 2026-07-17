(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DraftWriter = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';

  const STORAGE_PREFIX = 'askuserquestionspro:draft:';

  function browserStorage() {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  function pendingKey(roundKey, revision) {
    return `${STORAGE_PREFIX}${roundKey}:${revision}`;
  }

  function readPendingDraft(roundKey, revision, storage = browserStorage()) {
    if (!storage || !Number.isInteger(revision)) return null;
    try {
      const raw = storage.getItem(pendingKey(roundKey, revision));
      return raw == null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Each material edit starts a request synchronously. Later edits wait behind
  // it so their expected revisions remain ordered instead of conflicting. The
  // local mirror is removed only by the matching server revision acknowledgement.
  function createDraftWriter({
    save,
    getRevision,
    setRevision,
    roundKey,
    storage = browserStorage(),
  }) {
    const settings = typeof window !== 'undefined' && window.__ASKUSER_SETTINGS_V2__;
    const autosave = settings && settings.autosave;
    if (autosave && autosave.enabled === false) {
      return { write() {}, replay() {} };
    }
    let inFlight = false;
    let queued = null;

    function persist(draft, revision) {
      if (!storage || !Number.isInteger(revision)) return;
      try {
        storage.setItem(pendingKey(roundKey, revision), JSON.stringify(draft));
      } catch {
        // Browser storage is a delivery mirror, not the authoritative record.
      }
    }

    function acknowledge(draft, revision) {
      removePendingIfMatching(draft, revision);
    }

    function removePendingIfMatching(draft, revision) {
      if (!storage) return;
      const key = pendingKey(roundKey, revision);
      try {
        // Do not clear a newer edit which replaced this entry while its request
        // was in flight but still shares the same expected revision.
        if (storage.getItem(key) === JSON.stringify(draft)) storage.removeItem(key);
      } catch {
        // A later reload can safely retry an already-idempotent payload.
      }
    }

    function drain() {
      if (inFlight || queued == null) return;
      const entry = queued;
      queued = null;
      const { draft } = entry;
      const expectedRevision = getRevision();
      // An edit queued behind a successful request must be replayable at the
      // revision where it will actually be sent. Persist the new key before
      // retiring its older mirror, so a rejected transport survives reload.
      if (entry.revision !== expectedRevision) {
        persist(draft, expectedRevision);
        removePendingIfMatching(draft, entry.revision);
      }
      inFlight = true;
      Promise.resolve(save(draft, expectedRevision))
        .then((saved) => {
          if (Number.isInteger(saved?.revision)) {
            setRevision(saved.revision);
            acknowledge(draft, expectedRevision);
          }
        })
        .catch(() => {
          // Keep the exact failed payload for the next Flow instance. A retry
          // must preserve its original revision so the server can replay an
          // already-committed request without weakening ownership checks.
        })
        .finally(() => {
          inFlight = false;
          drain();
        });
    }

    return {
      write(draft) {
        const revision = getRevision();
        persist(draft, revision);
        queued = { draft, revision };
        drain();
      },
      replay() {
        const revision = getRevision();
        const pending = readPendingDraft(roundKey, revision, storage);
        if (pending != null) {
          queued = { draft: pending, revision };
          drain();
        }
      },
    };
  }

  return { createDraftWriter, readPendingDraft };
});
