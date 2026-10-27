# Kobo Cast

A reading receiver for the [Kobo Libra Colour](https://www.kobo.com/us/en/ereaders/kobo-libra-colour). A phone sends a chapter. The Libra Colour shows it as a still page: black type on a paper, sepia, or night ground, one screen at a time.

The Libra Colour is not a Chromecast, and its experimental browser cannot pretend to be one. That browser is AppleWebKit 538.1. On a Libra Colour it reports a viewport of about 732×762 CSS pixels, it has no `fetch` and no `XMLHttpRequest`, and it does not support flexbox, grid, or CSS variables. Google’s Cast receiver library does not run there. This server speaks the Cast receiver protocol to a real Cast device, and it serves a separate page the Libra’s browser can actually paint. Both screens show the same chapter.

Video is out of scope. Kaleido is for pages that sit still.

## Run

The server is Node.js and has no dependencies.

```bash
node server.js
```

Or `npm start`. The terminal prints a room code and the addresses to open.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Defaults to `8080`. |
| `CAST_CODE` | A stable room code, 4 to 12 letters or digits. Without it, a new code is chosen each time the server starts. |
| `CAST_APP_ID` | Enables the Cast button on the phone page. See below. |

Keep this on your own Wi-Fi. The room code is a speed bump so a neighbour who stumbles on the port does not overwrite a chapter. It is not an account system, and the server should not be port-forwarded.

## On the Libra Colour

1. Connect the eReader to the same Wi-Fi as the computer running the server. A guest network that isolates clients will not work.
2. From Home, tap **More** (bottom right), then **Beta Features**, then **Web Browser**, then **Start**.
3. Open the address printed by the server, for example `http://192.168.1.20:8080/`.

The waiting screen shows the room code. **Read the sample** loads a short chapter so you can check the type before a phone is involved.

Previous and Next are at the bottom. The bezel page-turn buttons do not reach this browser, so those words are the controls. **Update** reloads the screen if a cast does not appear on its own. When the browser’s JavaScript is available, a hidden frame asks the server to hold the connection and the page reloads once, which is the full refresh this panel wants between screens. Nothing on the reader page is restyled after paint: doing that on this WebKit drops buttons until you zoom.

Type sizes are budgeted for that 732×762 browser viewport, not the full 1264×1680 panel, so a page should fit without scrolling.

- A line that starts with `# ` or `## ` is a heading.
- A line that is only `---` is a break.
- A blank line starts a new paragraph.

Pale gray is not used. Paper, sepia, and night stay high contrast, which is what the Kaleido 3 filter can actually hold.

## On your phone

Open `http://<the-same-address>/sender`. Type the room code from the Libra, paste the chapter, and tap **Cast to Kobo**. The phone can also turn pages and clear the screen. After a successful cast it remembers the code in a cookie.

An image address (`http` or `https` only) is given a page of its own. The Kobo loads the image itself. The server does not fetch it.

## A registered Cast receiver

`/cast` is a [Custom Web Receiver](https://developers.google.com/cast/docs/web_receiver/basic). It loads the Cast Application Framework from Google, listens on `urn:x-cast:com.kobo.libra.reader`, and forwards each message to the same chapter the Kobo is showing.

The Libra Colour will not appear in a phone’s Cast device picker. Google’s picker only lists devices that complete Cast’s device authentication. To also show the chapter on a Chromecast or a Cast-enabled TV:

1. Register a Custom Web Receiver at [cast.google.com/publish](https://cast.google.com/publish). Published receiver URLs have to be `https`.
2. Point the receiver URL at `https://<your-host>/cast`.
3. Start this server with `CAST_APP_ID` set to the id Google gives you.

The phone page then shows a Cast button, which launches this receiver on the Cast device. Casting a chapter still posts it to this server, and both the TV and the Libra refresh from that.

Messages are JSON:

```json
{ "type": "document", "title": "Chapter 1", "author": "Ada Lovelace", "body": "# Chapter 1\n\nOnce upon a time.", "theme": "paper", "size": "md" }
```

`theme` is `paper`, `sepia`, or `night`. `size` is `sm`, `md`, or `lg`. `imageUrl` is optional.

```json
{ "type": "turn", "dir": "next" }
```

```json
{ "type": "clear" }
```

`dir` may be `prev`. The room code has to be included as `code` on `POST /api/cast`. The Cast device’s receiver page adds it before forwarding.

## Tests

```bash
npm test
```
