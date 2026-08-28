# Boba Bear HQ — Design System

The fourth spec, alongside `FEATURES.md`, `UI_UX.md` and `ARCHITECTURE.md`.
Those three say what the app does, how it behaves and how it is built. This one
says what it looks like, so that a simple app does not turn into random colours,
spacing, card styles and buttons everywhere.

---

## 1. Visual direction

> **Apple Notes × warm Boba Bear branding × extremely lightweight business notebook**

Not the public Boba Bear website. Not a SaaS admin panel.

The app should feel:

- warm
- calm
- private
- clean
- slightly premium
- very readable
- almost invisible while you are working

Boba Bear branding appears **subtly**, mainly through colour and the small logo.

Avoid:

- bear illustrations on every screen
- bubble-tea graphics everywhere
- gradients
- dashboard cards everywhere

The reduced form of the whole system:

> **warm ivory background + dark text + thin borders + caramel accent + lots of
> whitespace + beautiful typography.**

The **content** — properties, suppliers, menu, expenses, photos, documents and
checklists — provides most of the visual interest.

---

## 2. The rule that decides arguments

Whenever a screen is being designed, ask:

> **Can we remove one button, one border, one card, or one label without making
> the screen harder to understand?**

If yes, remove it.

---

## 3. Colour

### Core

| Token            | Value     | Usage                   |
| ---------------- | --------- | ----------------------- |
| `background`     | `#FAF8F4` | Main app background     |
| `surface`        | `#FFFDFC` | Sheets, popovers, inputs |
| `surface-muted`  | `#F5F1EB` | Hover / secondary areas |
| `text-primary`   | `#2B2521` | Main text               |
| `text-secondary` | `#746B64` | Metadata                |
| `text-muted`     | `#9A918A` | Timestamps, placeholders |
| `border`         | `#E7E0D9` | Dividers and borders    |

### Boba Bear accent

| Token          | Value     | Usage                              |
| -------------- | --------- | ---------------------------------- |
| `brand`        | `#B8794D` | Add button, links, icons, ticks    |
| `brand-hover`  | `#A86A41` | Pressed / hovered brand surfaces   |
| `brand-soft`   | `#F1E3D7` | Active chips and badges            |
| `brand-subtle` | `#F8F0E9` | Selected row, hovered ghost button |

Caramel / milk-tea brown, without making the app brown everywhere.

### Status

Used sparingly, and never as the only carrier of meaning.

| Token     | Value     | Background |
| --------- | --------- | ---------- |
| `success` | `#657B65` | `#EDF2ED`  |
| `warning` | `#A98049` | `#F6F0E6`  |
| `danger`  | `#A45D56` | `#F6ECEA`  |
| `info`    | `#667988` | `#EDF0F2`  |

A status is a small pill or a word in a metadata line — never a large coloured
card.

### Dark mode

**Not in V1.** Two internal users do not justify a second set of tokens to keep
correct. Everything above is defined as a CSS custom property, so adding a dark
theme later is a matter of redefining the tokens, not rewriting components.

---

## 4. Typography

**Geist Sans** throughout: clean, modern, excellent on mobile, and it does not
make an internal tool feel over-branded. The customer-facing brand can have
personality; HQ prioritises readability.

```
Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif
```

### Scale

| Role           | Size / line height | Weight |
| -------------- | ------------------ | ------ |
| Screen title   | 28 / 32            | 600    |
| Note title     | 26–32 / 32–38      | 600    |
| Section title  | 12 / 16, uppercase, `.08em` tracking | 500 |
| Body           | 16 / 24–26         | 400    |
| List title     | 15–16 / 21–22      | 500    |
| Metadata       | 13 / 18            | 400    |
| Tiny label     | 12 / 16            | 400–500 |

Mobile body never drops below **15–16px**. Anything a person types into runs at
16px, because iOS zooms the page below that.

### Weights

`400` regular · `500` medium · `600` semibold. **Never `700`** — no huge bold
dashboard headings.

---

## 5. Spacing

A 4px system:

```
4  8  12  16  20  24  32  40  48  64
```

Common values:

| Where                     | Value      |
| ------------------------- | ---------- |
| Screen horizontal padding | 20px       |
| Note vertical gap         | 16px       |
| Section gap               | 28–32px    |
| Row padding               | 14–16px    |
| Button gap                | 8px        |

Whitespace does most of the visual organisation.

---

## 6. Radius

```
--radius-sm    8px
--radius-md    12px
--radius-lg    16px
--radius-xl    20px
--radius-pill  999px
```

| Element             | Radius             |
| ------------------- | ------------------ |
| Input               | 10–12px            |
| Button              | 12px               |
| Small status pill   | 999px              |
| Bottom sheet        | 20px, top corners  |
| Image thumbnail     | 10px               |
| Checkbox            | 6px                |

---

## 7. Borders

`1px solid var(--border)`, and **separators are preferred to boxes**.

The Inbox looks like this:

```
Shop near Ibaco
Location · ₹22,000
Updated 20 min ago
────────────────────────

Tea Planet
Supplier · Testing
Updated yesterday
────────────────────────
```

Not like this:

```
╭──────────────────╮
│ Shop near Ibaco  │
╰──────────────────╯
```

Too many cards makes it look like a dashboard.

---

## 8. Shadows

Almost none.

```
--shadow-sm      0 1px 2px rgba(43, 37, 33, .05)
--shadow-float   0 4px 14px rgba(43, 37, 33, .14)
--shadow-panel   0 12px 34px rgba(43, 37, 33, .12)
```

Only things that genuinely float get one: the `+` button, sheets, dialogs and
popovers. Inbox rows and note bodies never float.

---

## 9. Icons

**Lucide**, never emoji. Emoji are fine inside what a person wrote into a note;
they are not the UI.

```
Stroke width   1.75
List / inline  18px
Actions        20px
Large action   24px
```

| Record type | Icon        |
| ----------- | ----------- |
| Supplier    | `truck`     |
| Expense / quote | `wallet` |
| Location    | `map-pin`   |
| Marketing   | `megaphone` |
| Document    | `file`      |
| Equipment   | `wrench`    |
| Drink       | `cup-soda`  |
| Sample      | `flask-conical` |
| Checklist   | `list-checks` |

---

## 10. Buttons

There should not be many.

**Primary** — caramel fill, white text, 44px tall, 12px radius. Used for `Save`
and for opening an external link. Because most editing autosaves or is confirmed
by one Save, primary buttons stay rare.

**Secondary** — `surface-muted` background, primary text.

**Ghost** — no background until hover or press. **Most actions are ghost
buttons**: search, attach, details, more, filter, back.

**Danger** — text in `danger`, never a filled red button.

---

## 11. The Add button

The most visible action in the app.

```
52 × 52px, circle
background: brand
right: 20px
bottom: 24px (plus the safe-area inset)
shadow-float
```

Nothing else competes with it. It steps aside while the editor is open. On
desktop it sits at the foot of the list pane rather than floating over the note
being read.

It never asks what you are adding: inside a pinned view it adds that view's kind
of record, and everywhere else it adds a plain note. Giving a note a shape is
something that happens later, from the note itself.

---

## 12. Inputs

No boxed-form aesthetic. A label, a rule, and the value written on the rule:

```
Rent
₹22,000

Size
320 sqft

Status
Considering
```

rather than

```
[ Rent: ₹22,000        ]
[ Size: 320 sqft       ]
```

Note titles and bodies have no border at all — text is written directly onto the
page. Structured fields use a single 1px bottom rule that turns caramel on
focus.

---

## 13. Checkboxes

```
20 × 20px
2px border
6px radius
44px hit target (extended past the box)
```

Completed: filled with `brand`, white tick, text muted with a strike-through.
Not a large colourful task card.

Rows that cannot be "finished" — a supplier, a drink — carry no checkbox, but
they keep the slot, so a list stays aligned down its left edge.

---

## 14. Bottom sheets

Mobile answers a question with a sheet rising from the thumb, not with a page to
navigate back out of. Used for:

- the `Everything ▾` filter
- the `•••` more-actions menu
- delete confirmation

```
radius: 20px on the top corners
grip: 36 × 4px, border colour
options: 48px tall, 16px text, a tick marks the current answer
scrim: rgba(43, 37, 33, .22)
```

Above 768px the same markup settles into a small centred panel (400px, 16px
radius, no grip).

---

## 15. Layout

| Breakpoint | Width      | Layout                     |
| ---------- | ---------- | -------------------------- |
| Mobile     | 0–767px    | one pane, 20px padding     |
| Tablet     | 768–1023px | one pane, centred measure  |
| Desktop    | 1024px+    | two panes                  |

Desktop is a Notes/Mail-style two-pane view, not a different product:

```
┌────────────────────┬─────────────────────────────────┐
│ 🐻 Boba Bear       │                                 │
│ Search             │ Shop near Ibaco                 │
│                    │                                 │
│ Inbox              │ Location · Considering          │
│ Everything ▾       │                                 │
│                    │ Owner asking ₹22,000...         │
│ PINNED             │                                 │
│ Launch Checklist   │ DETAILS                         │
│ Menu               │                                 │
│ Suppliers          │ Rent                            │
│ Money              │ ₹22,000                         │
│                    │                                 │
│ RECENT             │ ...                             │
│ Shop near Ibaco    │                                 │
│ Tea Planet         │                                 │
│ Packaging          │                                 │
│              +     │                                 │
└────────────────────┴─────────────────────────────────┘
```

- list pane: `348px` (the 320–380 band)
- note content: capped at `720px` (the 680–760 band) — text is not stretched
  across a whole monitor
- a **view** — the Launch Checklist, Equipment, Money, Locations — opens in the
  wide pane, capped at `960px`. A view is scannable rows rather than prose, so
  it takes more width than a paragraph should, but not a whole monitor.

### The two regions

The window is made of two regions that mean different things, and they are named
so that a screen reader can tell navigation apart from the work:

| Region       | Landmark                          | Holds |
| ------------ | --------------------------------- | ----- |
| **Inbox**    | `<aside aria-label="Inbox">`      | brand, search, filter, pins, recent |
| **Workspace**| `<main aria-label="Workspace">`   | whatever is open: a view, a record, the editor |

The Inbox is always there and is how you get anywhere. The Workspace holds one
thing at a time. On a phone only one region is on screen, and whichever it is
becomes the `<main>` — so there is always exactly one.

A saved view is **content, not navigation**: it belongs in the Workspace. Putting
a 37-row checklist in the 348px Inbox column while the Workspace sat empty was
the mistake this rule exists to prevent.

Because a record is legitimately listed in both regions at once — once in Recent,
once in the open view — anything scoping to "the record" has to say which region
it means.

---

## 16. Motion

Very restrained.

```
--fast    140ms   hover, focus, colour changes
--normal  200ms   progress bars, layout settling
--sheet   250ms   a sheet rising
```

Animation is used only for: opening a sheet, opening a note, completing a
checkbox, changing the filter, the saving state, and a new note appearing. No
decorative motion. Everything is disabled under `prefers-reduced-motion`.

---

## 17. Accessibility

- 44px minimum touch target on every control
- visible focus ring: 2px `brand`, 2px offset
- status is never carried by colour alone — the word is always present
- icons that stand alone carry an `aria-label`
- sheets are `role="dialog"`, move focus in, and close on `Escape`
- large text must not break layouts

---

## 18. Token reference

Everything above lives at the top of `src/styles.css` as custom properties.
Components use the tokens; nothing hard-codes a colour, a radius, or a step of
the spacing scale.

```css
:root {
  --background: #FAF8F4;
  --surface: #FFFDFC;
  --surface-muted: #F5F1EB;

  --text-primary: #2B2521;
  --text-secondary: #746B64;
  --text-muted: #9A918A;

  --border: #E7E0D9;

  --brand: #B8794D;
  --brand-hover: #A86A41;
  --brand-soft: #F1E3D7;
  --brand-subtle: #F8F0E9;

  --success: #657B65;
  --warning: #A98049;
  --danger: #A45D56;
  --info: #667988;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 2px rgba(43, 37, 33, .05);
  --shadow-float: 0 4px 14px rgba(43, 37, 33, .14);
  --shadow-panel: 0 12px 34px rgba(43, 37, 33, .12);

  --fast: 140ms;
  --normal: 200ms;
  --sheet: 250ms;

  --pane-width: 348px;
  --measure: 720px;
  --gutter: 20px;
}
```
