'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer } = require('../src/server');
const { createState } = require('../src/document');

const KOBO_UA = 'Mozilla/5.0 (Linux; U; Android 2.0; en-us;) AppleWebKit/538.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/538.1 (Kobo Touch)';

function listen() {
  const state = createState('Z9XQ');
  const server = createServer({
    state: state,
    allowShortHold: true,
    holdMs: 400,
    appId: '',
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server: server, state: state }));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function request(server, method, path, options) {
  const opts = options || {};
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      agent: false,
      hostname: '127.0.0.1',
      port: address.port,
      path: path,
      method: method,
      headers: opts.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.setTimeout(3000, () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function assertKoboSafe(html) {
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('fetch('), false);
  assert.equal(html.includes('XMLHttpRequest'), false);
  assert.equal(/display\s*:\s*flex/.test(html), false);
  assert.equal(/display\s*:\s*grid/.test(html), false);
  assert.equal(html.includes('var(--'), false);
  assert.equal(html.includes('=>'), false);
  assert.equal(html.includes('position:sticky'), false);
  assert.match(html, /name="viewport" content="width=device-width/);
  assert.match(html, /Georgia/);
}

test('the waiting screen is plain HTML the Libra Colour browser can paint', async () => {
  const ctx = await listen();
  try {
    const page = await request(ctx.server, 'GET', '/', {
      headers: { 'User-Agent': KOBO_UA },
    });
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'], /text\/html/);
    assert.match(page.headers['cache-control'], /no-store/);
    assertKoboSafe(page.body);
    assert.match(page.body, /Z&#160;&#160;9&#160;&#160;X&#160;&#160;Q/);
    assert.match(page.body, /\/sender/);
    assert.match(page.body, /action="\/sample"/);
    assert.equal(page.body.includes('cast_receiver_framework'), false);
    assert.equal(page.body.includes('value="Z9XQ"'), false);
  } finally {
    await close(ctx.server);
  }
});

test('a cast shows up escaped, themed, and paged', async () => {
  const ctx = await listen();
  try {
    const sent = await request(ctx.server, 'POST', '/cast', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=z9xq&title=Notes&author=Ada&theme=night&size=md&body=' + encodeURIComponent('# Hello\n\n<script>alert(1)</script>'),
    });
    assert.equal(sent.status, 303);
    assert.equal(sent.headers.location, '/sender?sent=1');
    const cookie = [].concat(sent.headers['set-cookie'] || []).join(';');
    assert.match(cookie, /kobo_cast_code=Z9XQ/);

    const page = await request(ctx.server, 'GET', sent.headers.location.replace('/sender?sent=1', '/'), {
      headers: { 'User-Agent': KOBO_UA },
    });
    assertKoboSafe(page.body);
    assert.match(page.body, /background: #000000/);
    assert.equal(page.body.includes('#f4f0e6'), false);
    assert.match(page.body, /Notes/);
    assert.match(page.body, /Ada/);
    assert.match(page.body, /<h1>Hello<\/h1>/);
    assert.match(page.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.equal(page.body.includes('<script'), false);
    assert.match(page.body, /\/watch\?since=1/);
    assert.match(page.body, />Next</);
    assert.equal(page.body.includes('value="Next"'), false);
  } finally {
    await close(ctx.server);
  }
});

test('the phone sender asks for the room code until it has been accepted', async () => {
  const ctx = await listen();
  try {
    const first = await request(ctx.server, 'GET', '/sender');
    assert.equal(first.body.includes('value="Z9XQ"'), false);
    assert.match(first.body, /Cast to Kobo/);
    assert.match(first.body, /display:\s*flex/);

    const rejected = await request(ctx.server, 'POST', '/cast', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=NOPE&title=Kept&body=' + encodeURIComponent('Keep this chapter'),
    });
    assert.equal(rejected.status, 403);
    assert.match(rejected.body, /does not match/);
    assert.match(rejected.body, /Keep this chapter/);
    assert.match(rejected.body, /value="Kept"/);

    const sent = await request(ctx.server, 'POST', '/cast', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=Z9XQ&title=Kept&body=Hello+from+the+phone.',
    });
    const saved = await request(ctx.server, 'GET', '/sender', {
      headers: { Cookie: 'kobo_cast_code=Z9XQ' },
    });
    assert.match(saved.body, /value="Z9XQ"/);
    assert.match(saved.body, /Hello from the phone/);
    assert.equal(sent.status, 303);
  } finally {
    await close(ctx.server);
  }
});

test('page turns move forward and stop at the ends', async () => {
  const ctx = await listen();
  try {
    const filler = 'Alpha page sentence. '.repeat(80);
    const body = filler + 'BETA-MARKER stays on a later page.';
    const sent = await request(ctx.server, 'POST', '/api/cast', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'Z9XQ', title: 'Long', body: body, size: 'lg' }),
    });
    assert.equal(sent.status, 200);
    const first = await request(ctx.server, 'GET', '/');
    assert.equal(first.body.includes('BETA-MARKER'), false);
    assert.match(first.body, /value="Next"/);
    assert.equal(first.body.includes('value="Previous"'), false);

    let page = first;
    let sawMarker = false;
    for (let i = 0; i < 12 && page.body.includes('value="Next"'); i += 1) {
      const turned = await request(ctx.server, 'POST', '/turn', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'dir=next',
      });
      assert.equal(turned.status, 303);
      page = await request(ctx.server, 'GET', turned.headers.location);
      if (page.body.includes('BETA-MARKER')) sawMarker = true;
    }
    assert.equal(sawMarker, true);
    assert.equal(page.body.includes('value="Next"'), false);
    assert.match(page.body, />Next</);
    const stuck = await request(ctx.server, 'GET', '/turn?dir=next');
    assert.equal(stuck.status, 303);
    const after = await request(ctx.server, 'GET', stuck.headers.location);
    assert.equal(after.body.includes('value="Next"'), false);
    assert.match(after.body, /on a later page/);
    const back = await request(ctx.server, 'POST', '/turn', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'dir=prev&from=sender',
    });
    assert.equal(back.status, 303);
    assert.equal(back.headers.location, '/sender');
  } finally {
    await close(ctx.server);
  }
});

test('the hidden frame wakes as soon as a cast arrives', async () => {
  const ctx = await listen();
  try {
    const pending = request(ctx.server, 'GET', '/watch?since=' + ctx.state.generation);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await request(ctx.server, 'POST', '/api/cast', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'Z9XQ', body: 'Hello from the phone.' }),
    });
    const watched = await pending;
    assert.equal(watched.status, 200);
    assert.match(watched.body, /window\.parent\.location\.replace\("\/\?v=/);
    assert.equal(watched.body.includes('=>'), false);
    assert.equal(watched.body.includes('const '), false);
    assert.equal(watched.body.includes('let '), false);

    const idle = await request(ctx.server, 'GET', '/watch?since=' + ctx.state.generation + '&hold=80');
    assert.match(idle.body, /http-equiv="refresh"/);
    assert.equal(idle.body.includes('parent.location'), false);
  } finally {
    await close(ctx.server);
  }
});

test('images stay on their own page and unsafe addresses are dropped', async () => {
  const ctx = await listen();
  try {
    const bad = await request(ctx.server, 'POST', '/api/cast', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'Z9XQ', imageUrl: 'javascript:alert(1)' }),
    });
    assert.equal(bad.status, 400);

    const good = await request(ctx.server, 'POST', '/api/cast', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'Z9XQ',
        title: 'Plate',
        imageUrl: 'https://example.com/plate.jpg',
        body: 'The caption page follows the picture.',
      }),
    });
    assert.equal(good.status, 200);
    const plate = await request(ctx.server, 'GET', '/');
    assert.match(plate.body, /src="https:\/\/example\.com\/plate\.jpg"/);
    assert.equal(plate.body.includes('The caption page follows'), false);
    const next = await request(ctx.server, 'POST', '/turn', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'dir=next',
    });
    const text = await request(ctx.server, 'GET', next.headers.location);
    assert.match(text.body, /The caption page follows the picture/);
  } finally {
    await close(ctx.server);
  }
});

test('a Cast device gets the receiver runtime and the Kobo does not', async () => {
  const ctx = await listen();
  try {
    const cast = await request(ctx.server, 'GET', '/', {
      headers: { 'User-Agent': 'Mozilla/5.0 CrKey/1.56.500000' },
    });
    assert.match(cast.body, /cast_receiver_framework\.js/);
    assert.match(cast.body, /urn:x-cast:com\.kobo\.libra\.reader/);
    assert.match(cast.body, /Z9XQ/);

    const direct = await request(ctx.server, 'GET', '/cast');
    assert.match(direct.body, /cast_receiver_framework\.js/);

    const forced = await request(ctx.server, 'GET', '/?device=kobo', {
      headers: { 'User-Agent': 'Mozilla/5.0 CrKey/1.56.500000' },
    });
    assert.equal(forced.body.includes('cast_receiver_framework'), false);
    assertKoboSafe(forced.body);
  } finally {
    await close(ctx.server);
  }
});

test('the sample, a clear, and a few refusals', async () => {
  const ctx = await listen();
  try {
    const sample = await request(ctx.server, 'POST', '/sample', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    assert.equal(sample.status, 303);
    const opened = await request(ctx.server, 'GET', sample.headers.location);
    assert.match(opened.body, /On Colour Paper/);
    assert.match(opened.body, /A page that stays still/);
    assertKoboSafe(opened.body);

    const cleared = await request(ctx.server, 'POST', '/clear', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const waiting = await request(ctx.server, 'GET', cleared.headers.location);
    assert.match(waiting.body, /Ready for a page/);

    const huge = await request(ctx.server, 'POST', '/api/cast', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'Z9XQ', body: 'a'.repeat(200001) }),
    });
    assert.equal(huge.status, 413);

    const missing = await request(ctx.server, 'GET', '/nope');
    assert.equal(missing.status, 404);
    const health = await request(ctx.server, 'GET', '/health');
    assert.equal(health.body, 'ok');
    const badTurn = await request(ctx.server, 'GET', '/turn?dir=sideways');
    assert.equal(badTurn.status, 400);
  } finally {
    await close(ctx.server);
  }
});
