# VIGIL

A one-page site for a fictional energy drink. It starts as an ordinary product page and gets
stranger the further down you scroll. Below the footer it stops being a product page at all.

It is a horror piece: there is a loud jump scare with synthesized sound at the very bottom.

## Run it

Plain HTML, CSS and JavaScript. No build step and no dependencies.

```
python -m http.server 5173 --bind 127.0.0.1
```

Then open http://localhost:5173. Opening `index.html` directly also works.

## Files

- `index.html` — the page content, the can artwork and the hallway scene (inline SVG).
- `styles.css` — the look. The palette is a set of custom properties that change with
  `html[data-stage="0..6"]`.
- `script.js` — sets the stage from the scroll position, swaps text when it is off screen,
  synthesizes all sound with the Web Audio API, and runs the dark wall, the hallway and the ending.

## Notes

- Sound starts on the first click or key press (browsers block it before that). The speaker
  button in the header mutes it.
- With "reduce motion" turned on in the operating system, the blackouts, screen shake and
  flicker are switched off. The ending still appears.
- The only outside request is to Google Fonts. Without it the page falls back to system fonts.
- The page reads the visitor's local clock and how long the page has been open. Nothing is
  stored or sent anywhere.
