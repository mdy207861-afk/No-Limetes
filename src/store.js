const fs = require('node:fs/promises');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'store.json');

const emptyStore = () => ({
  users: {},
  active: {},
  panel: { channelId: null, messageId: null }
});

let state = emptyStore();
let writeQueue = Promise.resolve();

async function initStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    state = {
      users: parsed.users || {},
      active: parsed.active || {},
      panel: parsed.panel || { channelId: null, messageId: null }
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Could not read data/store.json:', err);
      throw err;
    }
    await persist();
  }
}

function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tempFile = `${dataFile}.tmp`;
    await fs.writeFile(tempFile, snapshot, 'utf8');
    await fs.rename(tempFile, dataFile);
  });
  return writeQueue;
}

function getUser(userId) {
  if (!state.users[userId]) {
    state.users[userId] = { language: 'ar', totalMs: 0 };
  }
  return state.users[userId];
}

async function setLanguage(userId, language) {
  getUser(userId).language = language;
  await persist();
}

function getLanguage(userId) {
  return getUser(userId).language || 'ar';
}

async function checkIn(userId, username, now = Date.now()) {
  if (state.active[userId]) return { ok: false, reason: 'already_active' };
  const user = getUser(userId);
  state.active[userId] = { startedAt: now, username };
  await persist();
  return { ok: true, startedAt: now, totalMs: user.totalMs };
}

async function checkOut(userId, username, now = Date.now()) {
  const active = state.active[userId];
  if (!active) return { ok: false, reason: 'not_active' };

  const startedAt = active.startedAt;
  const durationMs = Math.max(0, now - startedAt);
  const user = getUser(userId);
  user.totalMs += durationMs;
  delete state.active[userId];
  await persist();

  return { ok: true, startedAt, endedAt: now, durationMs, totalMs: user.totalMs };
}

function getActive(userId) {
  return state.active[userId] || null;
}

function getTotalMs(userId, now = Date.now()) {
  const user = getUser(userId);
  const active = state.active[userId];
  return user.totalMs + (active ? Math.max(0, now - active.startedAt) : 0);
}

function getTop10(now = Date.now()) {
  const ids = new Set([...Object.keys(state.users), ...Object.keys(state.active)]);
  return [...ids]
    .map(id => ({
      userId: id,
      totalMs: getTotalMs(id, now),
      active: Boolean(state.active[id])
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);
}

async function setPanel(channelId, messageId) {
  state.panel = { channelId, messageId };
  await persist();
}

function getPanel() {
  return state.panel;
}

module.exports = {
  initStore, persist, getUser, setLanguage, getLanguage,
  checkIn, checkOut, getActive, getTotalMs, getTop10,
  setPanel, getPanel
};
