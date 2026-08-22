<script>
  // U4-S05: federal and state, drawn rather than photographed.
  //
  // The slot was named `federal-state-two-levels` and asked for "two levels
  // drawn as a diagram" — it was never a photograph. Nothing was ever going to
  // arrive for it, because what the screen teaches is a *structure*: one
  // national government above fifty state governments, each with its own work.
  //
  // Inline SVG rather than an image file: nothing to download, sharp at any
  // size, and it takes its colours from the theme tokens, so it works in dark
  // mode. A flat image would be a fixed picture of one theme.
  //
  // `currentColor` and the token classes do the theming; the SVG carries no
  // hardcoded colours at all.
</script>

<!--
  One figure, one label. role="img" with a description that says what the
  diagram SHOWS, because here the picture carries information the prose then
  builds on — unlike the companion, which is decoration.
-->
<figure
  class="w-full mb-4"
  role="img"
  aria-label="A diagram of two levels of government: one federal government above, responsible for country-sized jobs, and fifty state governments below, responsible for close-to-home jobs."
>
  <svg viewBox="0 0 320 180" class="w-full h-auto" aria-hidden="true" focusable="false">
    <!-- Federal: one box, spanning the width -->
    <rect
      x="40" y="12" width="240" height="46" rx="8"
      class="fill-raised dark:fill-dark-raised stroke-ink dark:stroke-dark-ink"
      stroke-width="2"
    />
    <text
      x="160" y="34" text-anchor="middle"
      class="fill-ink dark:fill-dark-ink"
      font-size="14" font-weight="700"
    >Federal</text>
    <text
      x="160" y="50" text-anchor="middle"
      class="fill-ink-secondary dark:fill-dark-ink-secondary"
      font-size="10"
    >one national government</text>

    <!-- The line between the levels -->
    <line
      x1="160" y1="58" x2="160" y2="86"
      class="stroke-border-interactive dark:stroke-dark-border-interactive"
      stroke-width="2"
    />

    <!-- State: three boxes standing for fifty, the third trailing off -->
    {#each [0, 1, 2] as i}
      <rect
        x={22 + i * 100} y="86" width="86" height="46" rx="8"
        class="fill-raised dark:fill-dark-raised stroke-border-interactive dark:stroke-dark-border-interactive"
        stroke-width="2"
      />
    {/each}
    <text x="65" y="108" text-anchor="middle" class="fill-ink dark:fill-dark-ink" font-size="12" font-weight="700">State</text>
    <text x="165" y="108" text-anchor="middle" class="fill-ink dark:fill-dark-ink" font-size="12" font-weight="700">State</text>
    <text x="265" y="108" text-anchor="middle" class="fill-ink dark:fill-dark-ink" font-size="12" font-weight="700">State</text>
    <text x="65" y="122" text-anchor="middle" class="fill-ink-secondary dark:fill-dark-ink-secondary" font-size="9">schools</text>
    <text x="165" y="122" text-anchor="middle" class="fill-ink-secondary dark:fill-dark-ink-secondary" font-size="9">police</text>
    <text x="265" y="122" text-anchor="middle" class="fill-ink-secondary dark:fill-dark-ink-secondary" font-size="9">licences</text>

    <text
      x="160" y="154" text-anchor="middle"
      class="fill-ink-secondary dark:fill-dark-ink-secondary"
      font-size="11"
    >… fifty of them</text>
  </svg>
</figure>
