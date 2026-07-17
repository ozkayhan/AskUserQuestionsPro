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
  function createDraftWriter({ save, getRevision, setRevision, roundKey, storage = browserStorage() }) {
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
      const draft = queued;
      queued = null;
      const expectedRevision = getRevision();
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
        persist(draft, getRevision());
        queued = draft;
        drain();
      },
      replay() {
        const pending = readPendingDraft(roundKey, getRevision(), storage);
        if (pending != null) {
          queued = pending;
          drain();
        }
      },
    };
  }

  return { createDraftWriter, readPendingDraft };
});
