'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SIZES, paginate } = require('../src/paginate');

function lineOf(char, size) {
  return char.repeat(size.charsPerLine);
}

test('a short chapter stays on one page', () => {
  const pages = paginate('# Title\n\nHello there.', 'md');
  assert.equal(pages.length, 1);
  assert.equal(pages[0][0].type, 'heading');
  assert.equal(pages[0][0].level, 1);
  assert.equal(pages[0][0].text, 'Title');
  assert.equal(pages[0][1].text, 'Hello there.');
});

test('Windows newlines and a second-level heading are kept', () => {
  const pages = paginate('## Section\r\n\r\nFirst line.\r\nSecond line.', 'md');
  assert.equal(pages[0][0].type, 'heading');
  assert.equal(pages[0][0].level, 2);
  assert.equal(pages[0][0].text, 'Section');
  assert.equal(pages[0][1].text, 'First line. Second line.');
});

test('blank input produces no pages', () => {
  assert.deepEqual(paginate('   \n\n  ', 'md'), []);
  assert.deepEqual(paginate('---\n\n***', 'md'), []);
});

test('a scene break sits between the paragraphs it separates', () => {
  const pages = paginate('Before.\n\n---\n\nAfter.', 'md');
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].map((block) => block.type), ['paragraph', 'break', 'paragraph']);
});

test('a heading is not left alone at the bottom of a page', () => {
  const size = SIZES.md;
  const paragraphs = [];
  for (let i = 0; i < size.maxLines - 1; i += 1) paragraphs.push(lineOf('a', size));
  const body = paragraphs.join('\n\n') + '\n\n# Chapter\n\nThe following paragraph must sit with the heading.';
  const pages = paginate(body, 'md');
  assert.ok(pages.length >= 2);
  assert.notEqual(pages[0][pages[0].length - 1].type, 'heading');
  assert.equal(pages[1][0].type, 'heading');
  assert.equal(pages[1][0].text, 'Chapter');
  assert.equal(pages[1][1].type, 'paragraph');
});

test('a word shorter than a line is never cut in half', () => {
  const body = 'aaaa '.repeat(40) + 'BETA-MARKER stays whole on the page.';
  const pages = paginate(body, 'lg');
  const pieces = [];
  for (let i = 0; i < pages.length; i += 1) {
    for (let j = 0; j < pages[i].length; j += 1) pieces.push(pages[i][j].text);
  }
  assert.match(pieces.join('\n'), /BETA-MARKER/);
  for (let i = 0; i < pieces.length; i += 1) {
    if (pieces[i].includes('BETA')) assert.match(pieces[i], /BETA-MARKER/);
  }
});

test('a long paragraph splits on word boundaries and larger type makes more pages', () => {
  const body = 'hello '.repeat(500).trim();
  const medium = paginate(body, 'md');
  const large = paginate(body, 'lg');
  const small = paginate(body, 'sm');
  assert.ok(medium.length > 1);
  assert.ok(large.length > medium.length);
  assert.ok(medium.length > small.length);
  for (let i = 0; i < medium.length; i += 1) {
    const text = medium[i].map((block) => block.text).join(' ');
    assert.match(text, /^(hello )+hello$/);
    let lines = 0;
    for (let j = 0; j < medium[i].length; j += 1) {
      lines += Math.ceil(medium[i][j].text.length / SIZES.md.charsPerLine);
    }
    assert.ok(lines <= SIZES.md.maxLines);
  }
});
