# SpendSpeak visual acceptance reference

This compact wireframe specification translates the design direction in `codex.md` into representative screen layouts. It is intentionally code-native; final screens use the shared tokens and components rather than image-based mockups.

## Shared frame

```text
┌─────────────────────────────────┐
│ Safe area                       │
│ Screen title             Action │
│ Supporting sentence             │
│                                 │
│ Primary content                 │
│                                 │
│ Home  Ledger  ＋  Budget  Setup │
└─────────────────────────────────┘
```

- Warm off-white/light and charcoal/dark backgrounds.
- 24-point page margin; spacing follows the 8-point family with 4/12-point optical exceptions.
- Cards use 16-20 point radii, tonal separation, and hairline borders.
- All actions are at least 44 x 44 points and remain reachable with one hand.

## Home

```text
Good morning
Here is your money at a glance.

╭───────────────────────────────╮
│ SPENT THIS MONTH              │
│ PKR 24,350.00                 │
│ Income            Budget left│
│ PKR 120,000       PKR 15,650 │
╰───────────────────────────────╯

            (  MIC  )
          Add with voice
        [ Manual expense ]

Spending by category
╭───────────────────────────────╮
│ Food       ━━━━━━━━━  8,200   │
│ Fuel       ━━━━━      4,100   │
╰───────────────────────────────╯

Recent transactions       See all
╭───────────────────────────────╮
│ ◯ Metro     Groceries  −1,250 │
│ ◯ Salary    Income   +120,000 │
╰───────────────────────────────╯
```

The emerald summary is the single dominant visual. Category bars are the only chart and have readable text equivalents.

## Transactions

```text
Transactions              Export
[ Search merchant, note, category ]
[All] [Expense] [Month] [Account]

TODAY
╭───────────────────────────────╮
│ ◯ Metro    Groceries  −1,250  │
│ ◯ Coffee   Food         −150  │
╰───────────────────────────────╯

YESTERDAY
╭───────────────────────────────╮
│ ◯ Fuel     Fuel         −600  │
╰───────────────────────────────╯
```

Rows prioritize title and amount. Source, category, and date remain secondary. Edit/delete actions appear after opening a row.

## Manual entry

```text
Add entry
[ Expense | Income ]
Amount                    PKR
Currency                  PKR ▾
Account                  Cash ▾
Category            Groceries ▾
Merchant or title       Metro
Date                 30 Aug 26
Time                    3:15 PM
Note                    Optional

[          Save entry          ]
```

Labels remain visible. Category/account/currency choices use bottom sheets. Validation stays adjacent and never clears valid input.

## Voice listening

```text
            ● Listening
╭───────────────────────────────╮
│ LIVE TRANSCRIPT               │
│ Paid 600 for fuel yesterday   │
│ from cash…                    │
╰───────────────────────────────╯

             (( MIC ))
             Listening…

       [ Cancel ]   [ Stop ]

Audio is never saved by SpendSpeak.
```

Only active listening loops/pulses. State is announced to screen readers and never relies on color alone.

## Voice review

```text
Review voice entry
Nothing is saved until you confirm.

╭───────────────────────────────╮
│ Please check account          │
│ This field had low confidence.│
╰───────────────────────────────╯

Expense / Income
Amount                    600
Currency                  PKR
Account                  Cash
Category                 Fuel
Merchant                    —
Date/time            Yesterday
Note                         —

Original transcript
“Paid 600 for fuel yesterday…”

[         Confirm entry        ]
```

Missing fields use an amber surface plus text/icon explanation. Confirmation is the only dominant action.

## Responsive and accessibility checks

- Small phone: no horizontal scrolling; long currency values shrink only inside summary numbers.
- Large phone: content width remains readable and spacing grows through available vertical room.
- Dynamic text: forms scroll; titles wrap; transaction titles truncate to one line while accessibility labels expose full meaning.
- Long merchant names: title truncates, amount retains alignment and tabular numerals.
- Dark mode: surfaces use tonal contrast; emerald, coral, amber, and blue meet WCAG AA where applicable.
- Empty/error/offline states use an icon, title, explanation, and real recovery action.
- Reduced motion: no required information depends on animation; the only looping state is active listening.
