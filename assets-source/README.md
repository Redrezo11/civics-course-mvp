# Source assets — deliberately NOT in `public/`

Vite copies `public/` verbatim into `dist/`, so anything left there ships.

The companion delivery arrived as **6.8 MB** — seven PNG masters at about a
megabyte each, plus previews and a contact sheet — against a whole-app payload
of 500 KB. On a course whose binding constraint is prepaid mobile data on a
cheap Android phone, that is not a rounding error: it is thirteen times the
entire application, downloaded by people paying by the megabyte.

Only app-ready exports belong in `public/images/`. Masters live here, where the
build cannot reach them.

## What is here

`companion/` — 512×512 PNG masters for the seven poses, the previews, and
`app-webp-as-delivered/`, the exports exactly as they arrived. The copies the
app actually serves are `public/images/companion-*.webp`, 181 KB for all seven.

Keeping the delivery untouched alongside the masters means a re-export can be
compared against what was originally supplied, rather than against whatever the
repository has done to it since.

## The rule, enforced

QA check 19 fails the build if `public/` contains a file large enough to be a
source asset, or one in a format the app does not serve. The boundary is not a
convention anyone has to remember — a megabyte-scale file sitting in `public/`
is invisible until somebody measures a deploy, which is exactly how 6.8 MB came
within one build of shipping.
