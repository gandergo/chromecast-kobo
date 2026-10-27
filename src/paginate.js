'use strict';

// Page budget for the Kobo Libra Colour experimental browser.
//
// A probe of that browser (AppleWebKit 538.1) measured about 732×762 CSS
// pixels. The panel is 1264×1680, but the browser does not give a page that
// canvas, and scrolling there is awkward. Each cast is split into views that
// fit without scrolling. Opening the next view is a full reload, which is
// also the clean e-ink refresh between pages.
//
// Vertical slack, in CSS pixels, for the medium size:
//   13 lines × 32px text  = 416
//   title and author      ≈  48
//   paragraph gaps        ≈  48
//   bottom page bar       ≈  70
//   page padding          ≈  32
//                         ≈ 614 of the 762px viewport

const SIZES = {
  sm: {
    id: 'sm',
    label: 'Smaller',
    font: 18,
    line: 26,
    charsPerLine: 62,
    maxLines: 16,
    heading: 24,
    headingLine: 30,
  },
  md: {
    id: 'md',
    label: 'Reader',
    font: 22,
    line: 32,
    charsPerLine: 50,
    maxLines: 13,
    heading: 30,
    headingLine: 36,
  },
  lg: {
    id: 'lg',
    label: 'Larger',
    font: 28,
    line: 40,
    charsPerLine: 38,
    maxLines: 9,
    heading: 36,
    headingLine: 42,
  },
};

// Kaleido 3 colour is muted, and pale gray type sinks into the filter.
// These three themes stay high contrast: near-black on a warm ground,
// or warm off-white on black. No gradients, no translucency.
const THEMES = {
  paper: {
    id: 'paper',
    label: 'Paper',
    bg: '#f4f0e6',
    fg: '#1a1a1a',
    nav: '#efe6d4',
    rule: '#1a1a1a',
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    bg: '#f3e6d0',
    fg: '#2a2118',
    nav: '#ead7b8',
    rule: '#2a2118',
  },
  night: {
    id: 'night',
    label: 'Night',
    bg: '#000000',
    fg: '#f3efe4',
    nav: '#14120e',
    rule: '#f3efe4',
  },
};

function parseBlocks(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').replace(/\0/g, '').split('\n');
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    paragraph = [];
    if (text) blocks.push({ type: 'paragraph', text });
  }

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (trimmed === '---' || trimmed === '***') {
      flushParagraph();
      blocks.push({ type: 'break' });
      continue;
    }
    const heading = /^(#{1,2})\s+(\S.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

function textLines(text, size) {
  return Math.max(1, Math.ceil(String(text || '').length / size.charsPerLine));
}

function takeChars(text, maxChars) {
  if (maxChars < 1) return '';
  if (text.length <= maxChars) return text;
  const space = text.lastIndexOf(' ', maxChars);
  if (space > 0) return text.slice(0, space);
  return '';
}

function paginate(body, sizeName) {
  const size = SIZES[sizeName] || SIZES.md;
  const blocks = parseBlocks(body);
  const pages = [];
  let page = [];
  let lines = 0;

  function flush() {
    if (page.length) pages.push(page);
    page = [];
    lines = 0;
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (block.type === 'break') {
      if (!page.length) continue;
      if (page[page.length - 1].type === 'break') continue;
      if (lines + 1 > size.maxLines) {
        flush();
        continue;
      }
      let hasMore = false;
      for (let j = i + 1; j < blocks.length; j += 1) {
        if (blocks[j].type !== 'break') {
          hasMore = true;
          break;
        }
      }
      if (!hasMore) continue;
      page.push(block);
      lines += 1;
      continue;
    }

    if (block.type === 'heading') {
      const cost = Math.max(2, textLines(block.text, size));
      let follow = 0;
      for (let j = i + 1; j < blocks.length; j += 1) {
        if (blocks[j].type === 'break') continue;
        if (blocks[j].type === 'paragraph') follow = Math.min(2, textLines(blocks[j].text, size));
        else follow = 2;
        break;
      }
      if (page.length && lines + cost + follow > size.maxLines) flush();
      page.push(block);
      lines += cost;
      if (lines >= size.maxLines) flush();
      continue;
    }

    let text = block.text;
    while (text) {
      if (size.maxLines - lines <= 0) {
        flush();
        continue;
      }
      const room = size.maxLines - lines;
      const onlyHeading = page.length === 1 && page[0].type === 'heading';
      if (room < 2 && page.length && !onlyHeading) {
        flush();
        continue;
      }
      const budget = room * size.charsPerLine;
      if (text.length <= budget) {
        page.push({ type: 'paragraph', text: text });
        lines += textLines(text, size);
        text = '';
        if (lines >= size.maxLines) flush();
        continue;
      }
      let take = takeChars(text, budget);
      if (!take) {
        // The next word does not fit on this page. Carry it forward.
        // A word longer than a whole page is the only time a word is cut.
        if (page.length) {
          flush();
          continue;
        }
        take = text.slice(0, Math.max(1, budget));
      }
      page.push({ type: 'paragraph', text: take });
      text = text.slice(take.length).replace(/^\s+/, '');
      flush();
    }
  }

  flush();
  return pages;
}

module.exports = {
  SIZES,
  THEMES,
  parseBlocks,
  paginate,
};
