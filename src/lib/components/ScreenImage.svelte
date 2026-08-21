<script>
  // One image slot: the photograph if it exists, the placeholder if it does not.
  //
  // Slots are authored ahead of the artwork, so most of this course's image
  // slots spent months as striped placeholders naming the file they wanted.
  // That is the honest state and it stays: a slot with no file says what it is
  // waiting for, rather than rendering a broken image or collapsing silently.

  import manifest from '../content/image-manifest.json';

  export let image = '';
  export let alt = '';
  /** Extra classes on the wrapper — callers control spacing and width. */
  export let wrapperClass = 'mb-4';

  const BASE = import.meta.env?.BASE_URL ?? './';
  $: have = image && manifest.images.includes(image);
</script>

{#if have}
  <!--
    Lazy, so a learner pays for the screens they actually reach — the binding
    constraint on this course is prepaid mobile data. Width and height are the
    real pixel dimensions of every file in the batch, which reserves the box
    before the bytes arrive and stops the text jumping as it loads.
  -->
  <img
    src="{BASE}images/{image}"
    {alt}
    width="960"
    height="540"
    loading="lazy"
    decoding="async"
    class="w-full aspect-video object-cover rounded-photo {wrapperClass}"
  />
{:else if image}
  <div
    class="w-full aspect-video {wrapperClass} rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted"
    role="img"
    aria-label={alt || image}
  >
    {image}
  </div>
{/if}
