'use strict';

// Original sample, long enough to cover more than one Libra Colour page
// at every type size. Shown from the waiting screen so the layout can be
// checked on the device before a phone is involved.

module.exports = {
  title: 'On Colour Paper',
  author: 'Kobo Cast',
  theme: 'paper',
  size: 'md',
  body: [
    '# A page that stays still',
    '',
    'The Libra Colour is a reading machine. Its screen is a sheet of colour e-ink, 1264 by 1680 dots, and it would rather hold a page than play a film. This receiver treats a cast the way the device treats a chapter: one full page, then another, with a real refresh in between.',
    '',
    'Paste from your phone. The page arrives here, set in a large serif, in paper, sepia, or night. Nothing moves until you ask for the next page.',
    '',
    '# How a cast becomes a page',
    '',
    'The browser on this eReader is an old WebKit. It can show a document, follow a link, and submit a form. It cannot run the Cast receiver library, and it has no way to fetch in the background. So the receiver is ordinary HTML. Turning the page is a button. When a new cast arrives, a small hidden frame asks the server to speak up, and the whole screen reloads once.',
    '',
    'That reload is not a flaw. On this panel, a reload is a clean refresh, which is what you want between pages.',
    '',
    '---',
    '',
    'The room code on the waiting screen is there so someone else on the same network cannot overwrite your chapter by accident. It is not a lock for the public internet. Keep the server on your own Wi-Fi.',
    '',
    '# Type that survives the panel',
    '',
    'Pale gray type disappears into the Kaleido colour filter. These pages use black, or a warm off-white on a black night page. The line is long enough for a sentence and short enough that you do not lose your place. If a page feels cramped, cast again at a smaller size. If it feels slight, choose the larger one. The split moves with the type.',
    '',
    'Images, when you send one, sit on a page of their own. A chart, a cover, a single plate. Video stays on glass screens. This one is for reading.',
    '',
    '# The buttons',
    '',
    'Previous and Next sit at the bottom, where a thumb can find them. The page-turn buttons on the bezel do not reach this browser, so the words on the glass are the controls. Update is there if a cast does not appear on its own. The phone you sent from can turn pages too, which is useful when the Libra is across the table.',
    '',
    'When the chapter ends, Next rests. There is no loop and no surprise. The last page stays until you cast something else, or clear the screen and go back to the code.',
  ].join('\n'),
};
