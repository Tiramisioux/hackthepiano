# HackThePiano

Learn to read notes on the fly. Play the note you see, as fast as you can.

**Live:** https://tiramisioux.github.io/hackthepiano/

---

### About this fork

This is the **Tiramisioux fork** of
[wojciechmalota/hackthepiano](https://github.com/wojciechmalota/hackthepiano) by
Wojciech Małota-Wójcik. The app, and all of the music logic that makes it work,
are his — his original README is reproduced in full at the bottom of this file,
unchanged, under [Original README](#original-readme-by-wojciech-małota-wójcik).

This fork adds a module framework with switchable panes, a full on-screen MIDI
keyboard so you can use it without a piano attached, the C/F/G landmark markings
from my piano-roll project, a free-practice mode, and a note/interval/chord readout. The original trainer is
left intact and runs as the first module; the on-screen keyboard reaches it by
presenting itself as an ordinary MIDI input port rather than by changing it.

The fork's additions were built with [Claude Code](https://claude.com/claude-code).

---

## What this fork adds

- **On-screen keyboard.** A piano drawer pinned to the bottom of the screen, in
  real acoustic-piano proportions. Click it, or play with your computer keyboard
  (`A`–`J` white notes, `W`/`E`/`T`/`Y`/`U` black, `Z`/`X` octave). It lights up
  the keys you play on a real MIDI piano too, and collapses out of the way.
  A **Range** control widens it from the C4 octave out to the full 88 keys.
- **Landmark markings**, following my piano-roll project. C, F and G are
  the landmarks you navigate a staff by; parity decides the shape, so a landmark
  on a line gets a dashed rule and one in a space gets a filled band — the two can
  never collide. The same colours tint the piano keys, shaded by register: darker
  below middle C, brighter above it. C, F and G can each be switched off.
- **Musical clef distance.** Optionally space the grand staff by the true pitch
  distance between its clefs rather than the wider gap sheet music engraves, so
  the two staves read as one continuous pitch space.
- **Note / interval / chord readout.** Optionally name what is being asked for —
  a single note by name, two notes by the interval, three or more by the chord —
  and what you actually played.
- **See your mistakes.** The note you played is drawn on the staff over the note
  you were asked for, so a wrong answer shows the interval you missed by.
- **A module framework.** The note trainer is module #1 in a tabbed shell. New
  modules are drop-in files that register themselves and get their own pane, with
  an optional split view to run two at once.
- **A free-practice module**: a grand staff with no exercise attached. It shows
  the notes you are playing, large, with the interval or chord they spell
  underneath. Notes linger briefly after release, so a rolled chord still reads
  as one chord.
- **A MIDI monitor module**, which doubles as the reference implementation for
  writing a new module.
- Interval and chord levels (beta).

No build step, no dependencies, no package.json. It is still a static site you
can open from any web server.

## Run it locally

Web MIDI only works in a secure context, so `http://localhost` works and opening
`index.html` over `file://` does not.

```bash
node scripts/devserver.js
```

Then open http://localhost:8123/ — see Browser support below.

## Browser support

Only one feature depends on the browser: **reading a real MIDI piano**. That
needs the Web MIDI API, which not every browser implements. Everything else —
the on-screen keyboard, the computer-keyboard mapping, every module, the
landmark markings, the readout — is ordinary DOM and works anywhere reasonably
current.

| | Real MIDI piano | Everything else |
|---|---|---|
| Chrome, Edge, Opera | Yes | Yes |
| Firefox | Recent versions, behind a permission prompt | Yes |
| Safari | No Web MIDI | Yes |

Rather than trust that table, **let the app tell you**: the status line on the
right of the keyboard drawer reports what it found — the name of your connected
device, "No MIDI device", or "No Web MIDI in this browser". Browser support
moves, and that line is measured rather than assumed.

Two things to know:

- **Web MIDI needs a secure context.** It works over `https://` and over
  `http://localhost`, and not over `file://`. Opening `index.html` by
  double-clicking it will never see your piano, however good the browser.
- **The app degrades rather than breaks.** If Web MIDI is missing, or you decline
  the permission prompt, or no device is plugged in, it carries on with the
  on-screen keyboard instead of failing. `js/htp-core.js` presents that keyboard
  to the rest of the app as an ordinary MIDI input port, so nothing downstream
  has to care which it is.

Your settings — staff size, landmark options, keyboard range, which drawers are
open — are kept in `localStorage`, so they are per browser and per machine. In a
private window they may not persist; the app falls back to its defaults rather
than erroring.

Beyond that it assumes a browser from roughly the last decade: ES6, CSS custom
properties, flexbox and Pointer Events. There is no build step and no polyfills.

## Writing a new module

Copy `js/modules/midi-monitor.js`, change the id and title, and add a `<script>`
tag for it in `index.html` **before** `js/htp-panes.js`:

```js
window.HTP.register({
    id: 'my-module',
    title: 'My module',
    description: 'Shown as the tab tooltip.',
    init: function (root, api) {
        root.innerHTML = '<p>Hello</p>';
        api.midi.subscribe(function (bytes, source) {
            // bytes[0] status, bytes[1] note, bytes[2] velocity
            // source is 'virtual' (on-screen keys) or 'hardware' (real piano)
        });
    },
    onShow: function (root, api) {},
    onHide: function (root, api) {}
});
```

`js/htp-core.js` documents the full contract. Note that `js/code.js` — the
original trainer — is deliberately left untouched: the on-screen keyboard reaches
it by presenting itself as a normal MIDI input port.

---

## Original README (by Wojciech Małota-Wójcik)

Everything below this line is the original project's README, reproduced
unchanged. It describes the app as it was before this fork, and links to the
original live site.

Hi,

My name is Wojciech. I've always dreamed about being able to play an instrument and last year, at the age of 30, I decided to start to learn playing the piano. I really enjoyed and doing this makes me happy. But there are always problems with basics at the beginning. I found that understanding notes on the fly is really a tricky part. But well... every problem has to find its solution.

Professinally I'm a software developer. So I decided to write small application which help me to learn reading the notes.
After a couple of days application was ready, I started to use it and found that after short time of training I really improved. So I decided to share the app with community hoping that all interested parties find it useful. It's completely free, opensourced piece of software available here: https://wojciechmalota.github.io/hackthepiano/

The challenge is very simple. You have to play note you see as fast as possible. To use it you need digital piano with MIDI interface connected to your computer. Website has to be opened in Chrome browser. By clicking "Your results" button you can see how fast and how accurate you are. There are different levels of difficulty.

I made this software mostly for fun so the only prize I can get is it's popularity. So if you find it useful and think it might help someone I will be very grateful for sharing this with your visitors, viewers, students etc.
I have other ideas for the small software tools that may help beginners to learn playing the piano. If I see that there is some interest in community then I will create them with great pleasure.
