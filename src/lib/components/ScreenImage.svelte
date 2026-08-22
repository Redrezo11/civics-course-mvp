<script>
  // One image slot: the picture if it exists, the placeholder if it does not.
  //
  // Slots are authored ahead of the artwork, so most of this course's image
  // slots spent months as striped placeholders naming the file they wanted.
  // That state stays: a slot with no file says what it is waiting for, rather
  // than rendering a broken image or collapsing silently.
  //
  // THE SHAPE IS NEVER STATED BY THE CALLER.
  //
  // It used to be a prop defaulting to 16:9, and two call sites forgot to pass
  // it — so a 512×512 portrait rendered in a 16:9 box under object-cover and
  // lost 44% of its height, with the img declaring 960×540 and reserving the
  // wrong space before the file even loaded. The shape is a fact about the
  // file, so it is read from the manifest, which reads it from the file. A
  // caller cannot state the wrong shape if it cannot state one.

  import manifest from '../content/image-manifest.json';

  export let image = '';
  export let alt = '';
  /** Extra classes on the wrapper — callers control spacing and width. */
  export let wrapperClass = 'mb-4';
  /**
   * Decoration carries tone, not information.
   *
   * The companion character is the case: every screen's meaning is in its text,
   * and announcing "an illustrated man looking thoughtful" before each of seven
   * hook screens is noise for someone using a screen reader. Decorative images
   * take an empty alt and their placeholder is hidden outright — which is what
   * an empty alt means in HTML, rather than an oversight.
   */
  export let decorative = false;
  /**
   * `head` crops to the face for small round avatars.
   *
   * The companion art is a head-and-torso portrait: the head is roughly the top
   * 57% of the square, so dropped whole into a 64px circle the face renders
   * about 35px with its shoulders clipped by the circle. The delivery included
   * hand-made 64×64 crops for two poses precisely because the full portraits do
   * not survive avatar size — see assets-source/companion/previews/.
   *
   * Rather than use those for two poses and leave the third broken, the crop is
   * derived here for all of them: show the top ~62% of the image, centred, so
   * head and shoulders fill the frame. One rule, every pose, no new assets.
   */
  export let crop = 'none';

  const BASE = import.meta.env?.BASE_URL ?? './';

  // A slot with no file yet has no dimensions to read, so the placeholder keeps
  // the 16:9 default. Every slot resolves today; this survives one that does not.
  $: dims = manifest.images[image] || null;
  $: have = Boolean(dims);
  $: [w, h] = dims || [960, 540];
  $: box = w === h ? 'aspect-square' : 'aspect-video';

  // An uncropped portrait at full column width is 448px of face above three
  // lines of text. Photographs are 16:9 and full width is what they are for.
  $: cap = w === h && crop === 'none' ? 'max-w-[240px] mx-auto' : '';
</script>

{#if have && crop === 'head'}
  <!--
    Scaled to 160% and anchored to the top, so the visible window is the top
    62.5% of the artwork, horizontally centred. That is the framing of the
    supplied 64px crops, applied to every pose.
  -->
  <div class="relative w-full {box} overflow-hidden {wrapperClass}">
    <img
      src="{BASE}images/{image}"
      alt={decorative ? '' : alt}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      class="absolute top-0 left-[-30%] w-[160%] h-[160%] max-w-none object-cover"
    />
  </div>
{:else if have}
  <!--
    Lazy, so a learner pays for the screens they actually reach — the binding
    constraint on this course is prepaid mobile data. Width and height are the
    file's real dimensions, which reserves the right box before the bytes
    arrive and stops the text jumping as it loads.
  -->
  <img
    src="{BASE}images/{image}"
    alt={decorative ? '' : alt}
    width={w}
    height={h}
    loading="lazy"
    decoding="async"
    class="w-full {box} object-cover rounded-photo {cap} {wrapperClass}"
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
