(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DraftWriter = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';

  // Each material edit starts a request synchronously. Later edits wait behind
  // it so their expected revisions remain ordered instead of conflicting.
  function createDraftWriter({ save, getRevision, setRevision }) {
    let inFlight = false;
    let queued = null;

    function drain() {
      if (inFlight || queued == null) return;
      const draft = queued;
      queued = null;
      inFlight = true;
      Promise.resolve(save(draft, getRevision()))
        .then((saved) => {
          if (Number.isInteger(saved?.revision)) setRevision(saved.revision);
        })
        .catch(() => {
          // A later edit may still be sent with the last known revision. The
          // next user edit also retries after a transient failure.
        })
        .finally(() => {
          inFlight = false;
          drain();
        });
    }

    return {
      write(draft) {
        queued = draft;
        drain();
      },
    };
  }

  return { createDraftWriter };
});
