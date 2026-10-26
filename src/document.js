'use strict';

const crypto = require('crypto');
const { SIZES, THEMES, paginate } = require('./paginate');

const NAMESPACE = 'urn:x-cast:com.kobo.libra.reader';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_BODY = 200000;
const MAX_TITLE = 180;

function createCode() {
  const bytes = crypto.randomBytes(4);
  let code = '';
  for (let i = 0; i < 4; i += 1) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4 || code.length > 12) return '';
  return code;
}

function createState(code) {
  return {
    code: code || createCode(),
    generation: 0,
    title: '',
    author: '',
    theme: 'paper',
    size: 'md',
    pages: [],
    index: 0,
    waiters: new Set(),
  };
}

function bump(state) {
  state.generation += 1;
  const waiters = Array.from(state.waiters);
  state.waiters.clear();
  for (let i = 0; i < waiters.length; i += 1) waiters[i]();
}

function codesMatch(expected, given) {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(given || '').trim().toUpperCase());
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function oneLine(value, max) {
  return String(value || '')
    .replace(/[\u0000\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeImageUrl(value) {
  const raw = oneLine(value, 2000);
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  return url.toString();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function applyDocument(state, input) {
  const title = oneLine(input.title, MAX_TITLE);
  const author = oneLine(input.author, MAX_TITLE);
  const theme = Object.prototype.hasOwnProperty.call(THEMES, input.theme)
    ? input.theme
    : (state.theme || 'paper');
  const size = Object.prototype.hasOwnProperty.call(SIZES, input.size)
    ? input.size
    : (state.size || 'md');
  const imageUrl = safeImageUrl(input.imageUrl || input.image || '');
  const body = String(input.body || input.text || '').replace(/\0/g, '');

  if (!body.trim() && !imageUrl) {
    throw httpError(400, 'Paste some text or an image address.');
  }
  if (body.length > MAX_BODY) {
    throw httpError(413, 'That text is too long for one cast. Split it into a shorter chapter.');
  }

  const pages = [];
  if (imageUrl) pages.push({ imageUrl: imageUrl, caption: title });
  const textPages = paginate(body, size);
  for (let i = 0; i < textPages.length; i += 1) pages.push({ blocks: textPages[i] });

  if (!pages.length) throw httpError(400, 'Nothing to show on that page.');

  state.title = title;
  state.author = author;
  state.theme = theme;
  state.size = size;
  state.pages = pages;
  state.index = 0;
  bump(state);
  return state;
}

function turn(state, dir) {
  if (!state.pages.length) return false;
  const next = dir === 'prev' ? state.index - 1 : state.index + 1;
  if (next < 0 || next >= state.pages.length) return false;
  state.index = next;
  bump(state);
  return true;
}

function clearDocument(state) {
  if (!state.pages.length && !state.title) return false;
  state.title = '';
  state.author = '';
  state.pages = [];
  state.index = 0;
  bump(state);
  return true;
}

function applyMessage(state, input) {
  const type = String(input.type || 'document').toLowerCase();
  if (type === 'clear') return clearDocument(state);
  if (type === 'turn') return turn(state, input.dir === 'prev' ? 'prev' : 'next');
  applyDocument(state, input);
  return true;
}

function pagePlain(page) {
  if (!page) return '';
  if (page.imageUrl) return page.caption ? 'Image. ' + page.caption : 'Image';
  const parts = [];
  const blocks = page.blocks || [];
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].type === 'break') parts.push('· · ·');
    else if (blocks[i].text) parts.push(blocks[i].text);
  }
  return parts.join('\n\n');
}

module.exports = {
  NAMESPACE,
  MAX_BODY,
  createCode,
  normalizeCode,
  createState,
  codesMatch,
  safeImageUrl,
  applyDocument,
  applyMessage,
  turn,
  clearDocument,
  pagePlain,
};
