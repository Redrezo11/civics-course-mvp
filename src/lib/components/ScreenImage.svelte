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
  /** 'video' for photographs (960×540), 'square' for the companion (512×512). */
  export let shape = 'video';
  /**
   * Decoration carries tone, not information.
   *
   * The companion character is the case: every screen's meaning is in its text,
   * and announcing "an illustrated man looking thoughtful" before each of seven
   * hook screens is noise for someone using a screen reader. Decorative images
   * take an empty alt and their placeholder is hidden outright — which is what
   * empty alt means in HTML, rather than an oversight.
   */
  export let decorative = false;

  const BASE = import.meta.env?.BASE_URL ?? './';
  const DIMS = { video: [960, 540], square: [512, 512] };

  $: have = image && manifest.images.includes(image);
  $: [w, h] = DIMS[shape] || DIMS.video;
  $: box = shape === 'square' ? 'aspect-square' : 'aspect-video';
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
    alt={decorative ? '' : alt}
    width={w}
    height={h}
    loading="lazy"
    decoding="async"
    class="w-full {box} object-cover {shape === 'square' ? '' : 'rounded-photo'} {wrapperClass}"
  />
{:else if image}
  <div
    class="w-full {box} {wrapperClass} rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-center text-xs text-ink-muted p-2"
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative ? 'true' : undefined}
    aria-label={decorative ? undefined : alt || image}
  >
    {image}
  </div>
{/if}
