let cancelled = false;

class CancelledError extends Error {
  constructor() {
    super('ユーザーの要求により中断されました');
    this.name = 'CancelledError';
  }
}

function requestCancel() { cancelled = true; }
function resetCancel() { cancelled = false; }
function isCancelled() { return cancelled; }
function throwIfCancelled() {
  if (cancelled) throw new CancelledError();
}

module.exports = {
  requestCancel, resetCancel, isCancelled, throwIfCancelled, CancelledError,
};
