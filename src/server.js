'use strict';

const http = require('http');
const os = require('os');
const sample = require('./sample');
const {
  codesMatch,
  applyMessage,
  turn,
  clearDocument,
} = require('./document');
const { renderReader, renderSender, renderWatch, renderMessage } = require('./html');

const MAX_POST = 300000;
const COOKIE = 'kobo_cast_code';

function createServer(options) {
  const opts = options || {};
  const state = opts.state;
  if (!state) throw new Error('createServer requires a state object.');
  const holdMs = opts.holdMs || 20000;
  const appId = opts.appId || '';

  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://127.0.0.1');
    } catch (err) {
      sendError(req, res, 400, 'Bad request.');
      return;
    }
    // handle() can throw before it returns a promise (a bad page turn, for
    // example). Starting the chain inside then() turns that into a rejection.
    Promise.resolve()
      .then(() => handle(req, res, url))
      .catch((err) => {
        if (res.headersSent) return;
        sendError(req, res, err.status || 500, err.status ? err.message : 'Something went wrong.');
      });
  });

  return server;

  function handle(req, res, url) {
    const path = url.pathname;
    if (req.method === 'GET' && path === '/health') return Promise.resolve(text(res, 200, 'ok'));
    if (req.method === 'GET' && path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return Promise.resolve();
    }
    if (req.method === 'GET' && path === '/watch') return Promise.resolve(watch(req, res, url));
    if (req.method === 'GET' && path === '/api/state') return Promise.resolve(json(res, 200, publicState()));
    if (req.method === 'GET' && (path === '/' || path === '/cast' || path === '/sender')) {
      return Promise.resolve(sendPage(req, res, path, url));
    }
    if (req.method === 'GET' && path === '/turn') {
      return Promise.resolve(doTurn(res, url.searchParams.get('dir'), url.searchParams.get('from')));
    }
    if (req.method === 'POST') {
      return readBody(req).then((raw) => {
        const data = parseRaw(req, raw);
        if (path === '/turn') return doTurn(res, data.dir, data.from);
        if (path === '/sample') return doSample(res);
        if (path === '/clear') return doClear(res, data.from);
        if (path === '/cast' || path === '/api/cast') return doCast(req, res, data, path === '/api/cast');
        return sendError(req, res, 404, 'That page is not on this receiver.');
      });
    }
    return Promise.resolve(sendError(req, res, 404, 'That page is not on this receiver.'));
  }

  function sendPage(req, res, path, url) {
    const urls = lanUrls(req);
    if (path === '/sender') {
      const saved = readCookies(req)[COOKIE] || '';
      return html(res, 200, renderSender({
        state: state,
        codeValue: codesMatch(state.code, saved) ? state.code : '',
        appId: appId,
        sent: url.searchParams.get('sent') === '1',
        error: '',
        values: {
          theme: state.theme || 'paper',
          size: state.size || 'md',
          title: '',
          author: '',
          body: '',
          imageUrl: '',
        },
        urls: urls,
      }));
    }
    const device = url.searchParams.get('device');
    const ua = req.headers['user-agent'] || '';
    const castDevice = path === '/cast' || device === 'cast' || (device !== 'kobo' && isCastDevice(ua));
    return html(res, 200, renderReader({
      state: state,
      mode: castDevice ? 'cast' : 'kobo',
      urls: urls,
    }));
  }

  function doCast(req, res, data, asJson) {
    if (!codesMatch(state.code, data.code)) {
      const error = httpError(403, 'That room code does not match the Kobo.');
      if (asJson) throw error;
      return senderError(req, res, data, error);
    }
    try {
      applyMessage(state, data);
    } catch (err) {
      if (asJson) throw err;
      return senderError(req, res, data, err);
    }
    if (asJson) return json(res, 200, publicState());
    return redirect(res, '/sender?sent=1', [cookieHeader()]);
  }

  function doTurn(res, dir, from) {
    if (dir !== 'next' && dir !== 'prev') throw httpError(400, 'Turn to the next or previous page.');
    turn(state, dir);
    const target = from === 'sender' ? '/sender' : '/?v=' + state.generation;
    return redirect(res, target);
  }

  function doSample(res) {
    applyMessage(state, sample);
    return redirect(res, '/?v=' + state.generation);
  }

  function doClear(res, from) {
    clearDocument(state);
    const target = from === 'sender' ? '/sender' : '/?v=' + state.generation;
    return redirect(res, target);
  }

  function senderError(req, res, data, err) {
    const status = err.status || 400;
    return html(res, status, renderSender({
      state: state,
      codeValue: String(data.code || ''),
      appId: appId,
      sent: false,
      error: err.message || 'The cast did not go through.',
      values: {
        title: data.title || '',
        author: data.author || '',
        body: data.body || data.text || '',
        imageUrl: data.imageUrl || data.image || '',
        theme: data.theme || state.theme || 'paper',
        size: data.size || state.size || 'md',
      },
    }));
  }

  function watch(req, res, url) {
    const since = Number(url.searchParams.get('since'));
    if (!Number.isFinite(since) || state.generation !== since) {
      return html(res, 200, renderWatch({ changed: true, generation: state.generation }));
    }
    const hold = clampHold(url.searchParams.get('hold'));
    let done = false;
    let timer = null;

    function cancel() {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      state.waiters.delete(wake);
    }

    function wake() {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      state.waiters.delete(wake);
      html(res, 200, renderWatch({ changed: true, generation: state.generation }));
    }

    timer = setTimeout(() => {
      if (done) return;
      done = true;
      state.waiters.delete(wake);
      html(res, 200, renderWatch({ changed: false, generation: state.generation }));
    }, hold);

    state.waiters.add(wake);
    res.on('close', () => {
      if (!res.writableEnded) cancel();
    });
  }

  function clampHold(query) {
    if (!opts.allowShortHold) return holdMs;
    const requested = Number(query);
    if (!Number.isFinite(requested)) return holdMs;
    return Math.max(50, Math.min(requested, holdMs));
  }

  function publicState() {
    return {
      generation: state.generation,
      idle: state.pages.length === 0,
      title: state.title,
      author: state.author,
      theme: state.theme,
      size: state.size,
      index: state.index,
      pageCount: state.pages.length,
    };
  }

  function cookieHeader() {
    return COOKIE + '=' + encodeURIComponent(state.code) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000';
  }

  function lanUrls(req) {
    const found = [];
    const port = req.socket && req.socket.localPort;
    const nets = os.networkInterfaces();
    const names = Object.keys(nets);
    for (let i = 0; i < names.length; i += 1) {
      const entries = nets[names[i]] || [];
      for (let j = 0; j < entries.length; j += 1) {
        const net = entries[j];
        const v4 = net.family === 'IPv4' || net.family === 4;
        if (!v4 || net.internal) continue;
        const url = 'http://' + net.address + ':' + port;
        if (found.indexOf(url) === -1) found.push(url);
      }
    }
    const host = req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const current = host ? proto + '://' + host : '';
    if (current && found.indexOf(current) === -1) {
      if (isLoopback(current)) found.push(current);
      else found.unshift(current);
    }
    const reachable = [];
    for (let i = 0; i < found.length; i += 1) {
      if (!isLoopback(found[i])) reachable.push(found[i]);
    }
    const shown = reachable.length ? reachable : found;
    return shown.slice(0, 2);
  }
}

function isCastDevice(ua) {
  return /CrKey|Chromecast/i.test(ua || '');
}

function isLoopback(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
}

function readCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (err) {
      out[key] = value;
    }
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_POST) {
        if (!settled) {
          settled = true;
          reject(httpError(413, 'That cast is too large.'));
        }
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function parseRaw(req, raw) {
  const type = String(req.headers['content-type'] || '');
  if (type.indexOf('application/json') !== -1) {
    let data;
    try {
      data = JSON.parse(raw || '{}');
    } catch (err) {
      throw httpError(400, 'That cast was not valid JSON.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw httpError(400, 'The cast body must be an object.');
    }
    return data;
  }
  const params = new URLSearchParams(raw);
  const data = {};
  params.forEach((value, key) => {
    data[key] = value;
  });
  return data;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function html(res, status, body, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function redirect(res, location, extra) {
  const headers = {
    Location: location,
    'Cache-Control': 'no-store',
  };
  if (extra && extra.length) headers['Set-Cookie'] = extra[0];
  res.writeHead(303, headers);
  res.end();
}

function sendError(req, res, status, message) {
  const wantsJson = String(req.headers.accept || '').indexOf('application/json') !== -1
    || String(req.url || '').indexOf('/api/') === 0;
  if (wantsJson) return json(res, status, { error: message });
  return html(res, status, renderMessage(status === 404 ? 'Not found' : 'Not cast', message));
}

module.exports = {
  createServer,
};
