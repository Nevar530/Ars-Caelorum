// dev/devLogger.js
//
// Lightweight rolling debug log (FIFO).
// Dev-only system for tracking actions like:
// - spawn
// - move
// - targeting
// - to-hit / damage debugging
//
// Does NOT depend on rendering.
// UI can subscribe to it or poll it.

const DEFAULT_MAX_ENTRIES = 25;

class DevLogger {
  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.entries = [];
    this.listeners = new Set();
  }

  log(message) {
    const entry = {
      id: this._generateId(),
      message,
      timestamp: Date.now()
    };

    this.entries.unshift(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    this._notify();
  }

  clear() {
    this.entries = [];
    this._notify();
  }

  setMaxEntries(count) {
    this.maxEntries = Math.max(1, count);
    this.entries = this.entries.slice(0, this.maxEntries);
    this._notify();
  }

  getEntries() {
    return [...this.entries];
  }

  getFormattedEntries() {
    return this.entries.map((entry) => {
      const time = new Date(entry.timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${time
        .getSeconds()
        .toString()
        .padStart(2, "0")}`;

      return `[${timeStr}] ${entry.message}`;
    });
  }

  subscribe(callback) {
    if (typeof callback !== "function") return;

    this.listeners.add(callback);
    callback(this.getEntries());

    return () => {
      this.listeners.delete(callback);
    };
  }

  _notify() {
    for (const listener of this.listeners) {
      listener(this.getEntries());
    }
  }

  _generateId() {
    return `log_${Math.random().toString(36).slice(2, 9)}`;
  }
}

const devLogger = new DevLogger();

export default devLogger;

export function logDev(message) {
  devLogger.log(message);
}

export function clearDevLog() {
  devLogger.clear();
}

export function getDevLog() {
  return devLogger.getEntries();
}

export function getDevLogFormatted() {
  return devLogger.getFormattedEntries();
}

export function setDevLogSize(size) {
  devLogger.setMaxEntries(size);
}

export function subscribeToDevLog(callback) {
  return devLogger.subscribe(callback);
}
