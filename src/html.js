'use strict';

const { SIZES, THEMES } = require('./paginate');
const { NAMESPACE, pagePlain } = require('./document');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsString(value) {
  return JSON.stringify(String(value)).replace(/</g, '\\u003c');
}

function readerCss(theme, size) {
  const color = THEMES[theme] || THEMES.paper;
  const type = SIZES[size] || SIZES.md;
  // Colors are written into the stylesheet on the server. The Libra Colour
  // browser drops buttons if a script restyles the page after first paint,
  // and it has no CSS variables. Do not switch themes from JavaScript.
  return [
    'html, body { margin: 0; padding: 0; height: 100%; }',
    'body {',
    '  background: ' + color.bg + ';',
    '  color: ' + color.fg + ';',
    '  font-family: Georgia, "Times New Roman", Times, serif;',
    '  font-size: ' + type.font + 'px;',
    '  line-height: ' + type.line + 'px;',
    '  -webkit-text-size-adjust: 100%;',
    '}',
    'a { color: ' + color.fg + '; }',
    '.sheet { padding: 12px 16px 20px 16px; }',
    '.brand, .kicker, .by, .label, .count, .update, .idle-label, .nav, .url, .caption {',
    '  font-family: Arial, Helvetica, sans-serif;',
    '}',
    '.brand { font-size: 14px; line-height: 18px; font-weight: bold; letter-spacing: 1px; margin: 0 0 8px 0; }',
    '.kicker { font-size: 14px; line-height: 18px; font-weight: bold; margin: 0; }',
    '.by { font-size: 14px; line-height: 18px; margin: 0 0 12px 0; }',
    '.sheet h1 { font-size: 32px; line-height: 38px; margin: 0 0 12px 0; }',
    '.help { font-size: 18px; line-height: 26px; margin: 0 0 12px 0; }',
    '.label { font-size: 14px; line-height: 18px; font-weight: bold; margin: 14px 0 4px 0; }',
    '.code { font-family: Arial, Helvetica, sans-serif; font-size: 40px; line-height: 48px; font-weight: bold; margin: 0; }',
    '.url { font-size: 18px; line-height: 24px; font-weight: bold; word-wrap: break-word; margin: 0 0 8px 0; }',
    '.prose h1 { font-size: ' + type.heading + 'px; line-height: ' + type.headingLine + 'px; margin: 0 0 10px 0; font-weight: bold; }',
    '.prose h2 { font-size: ' + (type.font + 2) + 'px; line-height: ' + (type.line + 2) + 'px; margin: 0 0 8px 0; font-weight: bold; }',
    '.prose p { margin: 0 0 8px 0; }',
    '.break { text-align: center; margin: 4px 0 10px 0; }',
    '.plate { margin: 0 0 8px 0; text-align: center; }',
    'img { max-width: 100%; height: auto; }',
    '.caption { font-size: 16px; line-height: 22px; margin: 0; }',
    'table.frame { width: 100%; height: 100%; border-collapse: collapse; }',
    'td.top { vertical-align: top; }',
    'td.bottom { vertical-align: bottom; }',
    'table.nav { width: 100%; border-collapse: collapse; border-top: 3px solid ' + color.rule + '; background: ' + color.nav + '; }',
    'td.side { width: 33%; vertical-align: middle; }',
    'td.mid { width: 34%; text-align: center; vertical-align: middle; }',
    'td.mid a { display: block; padding: 8px 4px 12px 4px; text-decoration: none; }',
    'form { margin: 0; }',
    'input[type="submit"] {',
    '  -webkit-appearance: none;',
    '  appearance: none;',
    '  border: 0;',
    '  border-radius: 0;',
    '  margin: 0;',
    '  width: 100%;',
    '  padding: 16px 4px;',
    '  font-family: Arial, Helvetica, sans-serif;',
    '  font-size: 18px;',
    '  font-weight: bold;',
    '  color: ' + color.fg + ';',
    '  background: ' + color.nav + ';',
    '}',
    '.sheet input[type="submit"] { border: 3px solid ' + color.rule + '; margin-top: 8px; background: ' + color.bg + '; }',
    '.count { margin: 0; font-size: 16px; line-height: 20px; font-weight: bold; }',
    '.update { margin: 0; font-size: 14px; line-height: 18px; }',
    '.update a { font-weight: bold; }',
    '.idle-label { margin: 0; padding: 16px 4px; text-align: center; font-size: 18px; line-height: 22px; font-weight: bold; }',
    'iframe { width: 1px; height: 1px; border: 0; position: absolute; left: 0; top: 0; }',
  ].join('\n');
}

function spacedCode(code) {
  return escapeHtml(code).split('').join('&#160;&#160;');
}

function renderBlocks(blocks) {
  const html = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type === 'heading' && block.level === 1) {
      html.push('<h1>' + escapeHtml(block.text) + '</h1>');
    } else if (block.type === 'heading') {
      html.push('<h2>' + escapeHtml(block.text) + '</h2>');
    } else if (block.type === 'break') {
      html.push('<p class="break">&#183; &#183; &#183;</p>');
    } else {
      html.push('<p>' + escapeHtml(block.text) + '</p>');
    }
  }
  return html.join('\n');
}

function renderPageBody(page) {
  if (!page) return '';
  if (page.imageUrl) {
    const caption = page.caption ? '<p class="caption">' + escapeHtml(page.caption) + '</p>' : '';
    return '<p class="plate"><img src="' + escapeHtml(page.imageUrl) + '" alt="' + escapeHtml(page.caption || '') + '"></p>' + caption;
  }
  return renderBlocks(page.blocks || []);
}

function pageBar(state) {
  const count = state.pages.length;
  const index = state.index;
  const prev = index > 0
    ? '<form method="post" action="/turn"><input type="hidden" name="dir" value="prev"><input type="submit" value="Previous"></form>'
    : '<p class="idle-label">Previous</p>';
  const next = index < count - 1
    ? '<form method="post" action="/turn"><input type="hidden" name="dir" value="next"><input type="submit" value="Next"></form>'
    : '<p class="idle-label">Next</p>';
  return [
    '<table class="nav" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<td class="side">' + prev + '</td>',
    '<td class="mid"><a href="/"><p class="count">' + (index + 1) + ' / ' + count + '</p>',
    '<p class="update">Update</p></a></td>',
    '<td class="side">' + next + '</td>',
    '</tr>',
    '</table>',
  ].join('');
}

function watchFrame(generation) {
  return '<iframe src="/watch?since=' + generation + '" width="1" height="1" scrolling="no" frameborder="0"></iframe>';
}

function documentShell(options) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(options.title) + '</title>',
    options.refresh ? '<meta http-equiv="refresh" content="' + options.refresh + '">' : '',
    '<style>',
    options.css,
    '</style>',
    '</head>',
    '<body>',
    options.body,
    '</body>',
    '</html>',
  ].join('\n');
}

function renderIdle(state, urls) {
  const links = [];
  for (let i = 0; i < urls.length; i += 1) {
    links.push('<p class="url">' + escapeHtml(urls[i]) + '/sender</p>');
  }
  if (!links.length) links.push('<p class="url">/sender</p>');
  return [
    '<div class="sheet">',
    '<p class="brand">Kobo Cast</p>',
    '<h1>Ready for a page</h1>',
    '<p class="help">On your phone, open this address. Type the room code shown here, then cast a chapter.</p>',
    links.join('\n'),
    '<p class="label">Room code</p>',
    '<p class="code">' + spacedCode(state.code) + '</p>',
    '<p class="help">If a cast does not appear on its own, tap Update. The screen refreshes by reloading, which is the right kind of refresh for this panel.</p>',
    '<p class="update"><a href="/">Update</a></p>',
    '<form method="post" action="/sample">',
    '<input type="submit" value="Read the sample">',
    '</form>',
    '</div>',
    watchFrame(state.generation),
  ].join('\n');
}

function renderReading(state) {
  const page = state.pages[state.index];
  const bits = ['<table class="frame" cellpadding="0" cellspacing="0">'];
  bits.push('<tr><td class="top"><div class="sheet">');
  if (state.title) bits.push('<p class="kicker">' + escapeHtml(state.title) + '</p>');
  if (state.author) bits.push('<p class="by">' + escapeHtml(state.author) + '</p>');
  bits.push('<div class="prose">');
  bits.push(renderPageBody(page));
  bits.push('</div></div></td></tr>');
  bits.push('<tr><td class="bottom">');
  bits.push(pageBar(state));
  bits.push('</td></tr></table>');
  bits.push(watchFrame(state.generation));
  return bits.join('\n');
}

function castScripts(code) {
  const encodedCode = jsString(code);
  const namespace = jsString(NAMESPACE);
  // This script is served only to a Cast device. The Libra Colour page must
  // not include it: that browser cannot load the receiver library.
  return [
    '<script src="https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js"></script>',
    '<script>',
    '(function () {',
    '  if (!window.cast || !window.cast.framework) return;',
    '  var ns = ' + namespace + ';',
    '  var context = cast.framework.CastReceiverContext.getInstance();',
    '  var options = new cast.framework.CastReceiverOptions();',
    '  options.disableIdleTimeout = true;',
    '  options.maxInactivity = 3600;',
    '  options.statusText = "Kobo Cast";',
    '  options.customNamespaces = {};',
    '  options.customNamespaces[ns] = cast.framework.system.MessageType.JSON;',
    '  context.addCustomMessageListener(ns, function (event) {',
    '    var payload = event && event.data;',
    '    if (!payload || typeof payload !== "object") {',
    '      payload = { type: "document", body: String(payload || "") };',
    '    }',
    '    payload.code = ' + encodedCode + ';',
    '    var xhr = new XMLHttpRequest();',
    '    xhr.open("POST", "/api/cast");',
    '    xhr.setRequestHeader("Content-Type", "application/json");',
    '    xhr.onreadystatechange = function () {',
    '      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {',
    '        window.location.replace("/?v=" + String(new Date().getTime()));',
    '      }',
    '    };',
    '    xhr.send(JSON.stringify(payload));',
    '  });',
    '  context.start(options);',
    '})();',
    '</script>',
  ].join('\n');
}

function renderReader(options) {
  const state = options.state;
  const idle = state.pages.length === 0;
  const title = idle
    ? 'Kobo Cast'
    : (state.title || 'Kobo Cast') + ' (' + (state.index + 1) + ' of ' + state.pages.length + ')';
  const inner = idle ? renderIdle(state, options.urls || []) : renderReading(state);
  const body = options.mode === 'cast' ? inner + '\n' + castScripts(state.code) : inner;
  return documentShell({
    title: title,
    css: readerCss(state.theme, state.size),
    body: body,
  });
}

function senderCss() {
  return [
    'body { margin: 0; background: #f4f0e6; color: #1a1a1a; font-family: Georgia, "Times New Roman", Times, serif; }',
    'main { max-width: 38rem; margin: 0 auto; padding: 1.25rem 1rem 3rem; }',
    'header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }',
    'h1 { font-size: 2rem; line-height: 1.15; margin: 0; }',
    'p, li { font-size: 1.05rem; line-height: 1.45; }',
    'a { color: #1a1a1a; }',
    'label, .hint, .status, .error, button, input[type="submit"] { font-family: Arial, Helvetica, sans-serif; }',
    'label.field { display: block; font-size: 0.85rem; font-weight: bold; margin: 1rem 0 0.35rem; }',
    'input[type="text"], textarea { width: 100%; box-sizing: border-box; font: 1.05rem/1.45 Georgia, "Times New Roman", serif; padding: 0.6rem 0.7rem; border: 2px solid #1a1a1a; background: #fffdf8; color: #1a1a1a; }',
    'textarea { min-height: 14rem; }',
    '.code-input { font-family: Arial, Helvetica, sans-serif; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase; }',
    '.choices { display: flex; flex-wrap: wrap; gap: 0.5rem; }',
    '.choices label { font-family: Arial, Helvetica, sans-serif; border: 2px solid #1a1a1a; padding: 0.45rem 0.7rem; }',
    'button, input[type="submit"] { font-weight: bold; font-size: 1rem; background: #1a1a1a; color: #f4f0e6; border: 2px solid #1a1a1a; padding: 0.85rem 1rem; }',
    '.cast { width: 100%; margin-top: 1rem; }',
    '.remote { display: flex; gap: 0.5rem; margin-top: 0.75rem; }',
    '.remote form { flex: 1; }',
    '.remote input[type="submit"], .clear input[type="submit"] { width: 100%; }',
    '.clear input[type="submit"] { background: #f4f0e6; color: #1a1a1a; margin-top: 0.5rem; }',
    '.error { background: #fffdf8; border: 2px solid #7a2e24; color: #7a2e24; padding: 0.7rem 0.8rem; }',
    '.status { background: #fffdf8; border: 2px solid #1a1a1a; padding: 0.7rem 0.8rem; }',
    'blockquote { margin: 0.5rem 0 0; white-space: pre-wrap; font-size: 1rem; line-height: 1.4; }',
    '.hint { font-size: 0.85rem; line-height: 1.4; margin: 0.35rem 0 0; }',
    'google-cast-launcher { width: 28px; height: 28px; }',
  ].join('\n');
}

function previewText(text) {
  if (text.length <= 500) return text;
  const cut = text.slice(0, 500);
  const space = cut.lastIndexOf(' ');
  return (space > 400 ? cut.slice(0, space) : cut) + '…';
}

function choiceList(name, options, current) {
  const items = [];
  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    const checked = option.id === current ? ' checked' : '';
    items.push(
      '<label><input type="radio" name="' + name + '" value="' + option.id + '"' + checked + '> ' +
      escapeHtml(option.label) + '</label>'
    );
  }
  return '<div class="choices">' + items.join('') + '</div>';
}

function themeChoices(current) {
  return choiceList('theme', [THEMES.paper, THEMES.sepia, THEMES.night], current || 'paper');
}

function sizeChoices(current) {
  return choiceList('size', [SIZES.sm, SIZES.md, SIZES.lg], current || 'md');
}

function senderCastLauncher(appId) {
  if (!appId) return '';
  const id = jsString(appId);
  return [
    '<script>',
    'window.__onGCastApiAvailable = function (isAvailable) {',
    '  if (!isAvailable || !window.cast || !window.cast.framework) return;',
    '  var context = cast.framework.CastContext.getInstance();',
    '  context.setOptions({',
    '    receiverApplicationId: ' + id + ',',
    '    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED',
    '  });',
    '};',
    '</script>',
    '<script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"></script>',
  ].join('\n');
}

function renderSender(options) {
  const state = options.state;
  const values = options.values || {};
  const excerpt = state.pages.length ? previewText(pagePlain(state.pages[state.index])) : '';
  const parts = [];
  parts.push('<header><h1>Cast to Kobo</h1>');
  if (options.appId) parts.push('<google-cast-launcher></google-cast-launcher>');
  parts.push('</header>');
  parts.push('<p>The Libra Colour is the receiver. Paste a chapter, and it will show up as a still page on the eReader.</p>');
  if (options.error) parts.push('<p class="error">' + escapeHtml(options.error) + '</p>');
  else if (options.sent) parts.push('<p class="status">Cast sent. The Libra Colour reloads when the page arrives.</p>');

  if (state.pages.length) {
    let status = 'On the Kobo: page ' + (state.index + 1) + ' of ' + state.pages.length;
    if (state.title) status += ' — ' + escapeHtml(state.title);
    parts.push('<p class="status">' + status + '.</p>');
    if (excerpt) parts.push('<blockquote>' + escapeHtml(excerpt) + '</blockquote>');
    parts.push('<div class="remote">');
    parts.push('<form method="post" action="/turn"><input type="hidden" name="from" value="sender"><input type="hidden" name="dir" value="prev"><input type="submit" value="Previous page"></form>');
    parts.push('<form method="post" action="/turn"><input type="hidden" name="from" value="sender"><input type="hidden" name="dir" value="next"><input type="submit" value="Next page"></form>');
    parts.push('</div>');
    parts.push('<form class="clear" method="post" action="/clear"><input type="hidden" name="from" value="sender"><input type="submit" value="Clear the Kobo"></form>');
  }

  parts.push('<form method="post" action="/cast">');
  parts.push('<label class="field" for="code">Room code</label>');
  parts.push('<input class="code-input" id="code" name="code" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" required value="' + escapeHtml(options.codeValue || '') + '">');
  parts.push('<p class="hint">Read this off the waiting screen on the Libra Colour.</p>');
  parts.push('<label class="field" for="title">Title</label>');
  parts.push('<input id="title" name="title" type="text" maxlength="180" value="' + escapeHtml(values.title || '') + '">');
  parts.push('<label class="field" for="author">Author</label>');
  parts.push('<input id="author" name="author" type="text" maxlength="180" value="' + escapeHtml(values.author || '') + '">');
  parts.push('<label class="field" for="body">Page text</label>');
  parts.push('<textarea id="body" name="body">' + escapeHtml(values.body || '') + '</textarea>');
  parts.push('<p class="hint">A line that starts with # is a heading. A line that is only --- is a break. Blank lines start a new paragraph.</p>');
  parts.push('<label class="field" for="imageUrl">Image address, optional</label>');
  parts.push('<input id="imageUrl" name="imageUrl" type="text" maxlength="2000" value="' + escapeHtml(values.imageUrl || '') + '">');
  parts.push('<p class="hint">The image is loaded by the Kobo. Use an http or https address. It gets a page of its own.</p>');
  parts.push('<label class="field">Paper</label>');
  parts.push(themeChoices(values.theme || state.theme || 'paper'));
  parts.push('<label class="field">Type size</label>');
  parts.push(sizeChoices(values.size || state.size || 'md'));
  parts.push('<input class="cast" type="submit" value="Cast to Kobo">');
  parts.push('</form>');
  parts.push('<p class="hint"><a href="/">Open the receiver preview</a></p>');

  return documentShell({
    title: 'Cast to Kobo',
    css: senderCss(),
    body: '<main>\n' + parts.join('\n') + '\n</main>\n' + senderCastLauncher(options.appId),
  });
}

function renderWatch(options) {
  const generation = String(options.generation);
  if (options.changed) {
    return [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"><title>Update</title></head>',
      '<body><script type="text/javascript">',
      'if (window.parent && window.parent !== window) {',
      '  window.parent.location.replace("/?v=' + generation + '");',
      '} else {',
      '  window.location.replace("/?v=' + generation + '");',
      '}',
      '</script></body></html>',
    ].join('');
  }
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    '<meta http-equiv="refresh" content="1;url=/watch?since=' + generation + '">',
    '<title>Waiting</title></head><body></body></html>',
  ].join('');
}

function renderMessage(title, message) {
  return documentShell({
    title: title,
    css: readerCss('paper', 'md'),
    body: '<div class="sheet"><p class="brand">Kobo Cast</p><h1>' + escapeHtml(title) + '</h1><p class="help">' + escapeHtml(message) + '</p><p class="update"><a href="/">Back to the receiver</a></p></div>',
  });
}

module.exports = {
  escapeHtml,
  renderReader,
  renderSender,
  renderWatch,
  renderMessage,
};
