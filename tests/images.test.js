/**
 * Image slots.
 *
 * Slots are authored long before the artwork, so most of this course's images
 * spent months as striped placeholders naming the file they wanted. That state
 * is deliberate and has to keep working: a slot with no file says what it is
 * waiting for, rather than rendering a broken image or collapsing silently.
 *
 * The other half is alt text. It was written for pictures that did not exist,
 * and some of it described things the delivered photographs do not show — the
 * same failure as narration reading text that is not on the screen.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readdirSync, readFileSync } from 'node:fs';

import ScreenImage from '../src/lib/components/ScreenImage.svelte';
import manifest from '../src/lib/content/image-manifest.json';

/** The manifest is now name → [w, h], read from the files themselves. */
const NAMES = Object.keys(manifest.images);
import Lesson from '../src/lib/screens/Lesson.svelte';
import LevelsDiagram from '../src/lib/components/LevelsDiagram.svelte';
import { progress } from '../src/lib/stores/progress.js';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

const UNITS = [unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7];

/** Every image reference in the course: single, row and column. */
function slots() {
  const out = [];
  for (const unit of UNITS) {
    for (const s of unit.screens) {
      if (s.image) out.push({ screen: s.id, image: s.image, alt: s.alt, decorative: s.decorative });
      for (const pic of s.imageRow || []) out.push({ screen: s.id, image: pic.image, alt: pic.alt, row: true });
      for (const col of s.twoColumn || []) {
        if (col.image) out.push({ screen: s.id, image: col.image, alt: col.alt, column: true });
      }
    }
  }
  return out;
}

describe('the image manifest', () => {
  it('lists exactly what is on disk', () => {
    // The manifest is what the renderer trusts to tell a filled slot from an
    // empty one. If it drifts from the folder, a slot either shows a broken
    // image or hides one that is right there.
    const onDisk = readdirSync('public/images').filter((n) => !n.startsWith('.'));
    expect([...NAMES].sort()).toEqual([...onDisk].sort());
  });
});

describe('every image slot', () => {
  it('carries alt text, or declares itself decorative', () => {
    // An empty alt is correct for decoration and identical to a forgotten one.
    // The screen has to say which it means.
    for (const s of slots()) {
      if (s.decorative) {
        expect(s.alt, `${s.screen} is decorative and should carry no alt`).toBeFalsy();
        continue;
      }
      expect(s.alt, `${s.screen} → ${s.image} has no alt`).toBeTruthy();
      expect(s.alt.length, `${s.screen} alt is too short to describe anything`).toBeGreaterThan(20);
    }
  });

  it('references a file that exists, or one nothing else nearly matches', () => {
    // A genuinely absent file is a slot waiting for artwork. A file that is
    // present under a different case is a 404 in production and nowhere else —
    // GitHub Pages is case-sensitive, Windows is not.
    const onDisk = readdirSync('public/images');
    for (const s of slots()) {
      if (onDisk.includes(s.image)) continue;
      const nearly = onDisk.find((f) => f.toLowerCase() === s.image.toLowerCase());
      expect(nearly, `${s.screen} references "${s.image}" but the file is "${nearly}"`).toBeUndefined();
    }
  });

  it('does not claim the alt describes something the batch cannot show', () => {
    // Three alts described imagined pictures. U3-S05 promised the Capitol
    // "with its two wings marked as the Senate chamber and the House chamber";
    // nothing in the photograph is marked. U0-S02 had people with "their right
    // hands raised"; they are waving flags.
    const filled = slots().filter((s) => NAMES.includes(s.image));
    for (const s of filled) {
      expect(s.alt, `${s.screen} alt still describes a marked-up diagram`).not.toMatch(/marked as/i);
      expect(s.alt, `${s.screen} alt still claims a raised-hand oath`).not.toMatch(/hands raised/i);
    }
  });
});

describe('a slot with no file', () => {
  it('renders the placeholder, naming what it is waiting for', () => {
    const { container } = render(ScreenImage, {
      props: { image: 'not-delivered-yet.webp', alt: 'A picture that has not been made.' },
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('not-delivered-yet.webp');
    expect(container.querySelector('[role="img"]').getAttribute('aria-label')).toBe(
      'A picture that has not been made.'
    );
  });

  it('renders nothing at all when there is no slot', () => {
    const { container } = render(ScreenImage, { props: { image: '', alt: '' } });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});

describe('a slot with a file', () => {
  const image = NAMES.find((n) => !n.startsWith('companion-'));

  it('renders a real image, lazily and without shifting the page', () => {
    const { container } = render(ScreenImage, { props: { image, alt: 'A photograph of something.' } });
    const img = container.querySelector('img');

    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain(`images/${image}`);
    expect(img.getAttribute('alt')).toBe('A photograph of something.');
    // Prepaid mobile data is the binding constraint: a learner pays only for
    // the screens they reach.
    expect(img.getAttribute('loading')).toBe('lazy');
    // Reserves the box before the bytes arrive, so text does not jump.
    expect(img.getAttribute('width')).toBe('960');
    expect(img.getAttribute('height')).toBe('540');
  });

  it('is never given an empty alt', () => {
    const { container } = render(ScreenImage, { props: { image, alt: '' } });
    expect(container.querySelector('img').getAttribute('alt')).toBe('');
    // An empty alt is valid HTML for decoration, but no image in this course is
    // decorative — QA check 6 fails the build before this could ship.
  });
});

// ---------------------------------------------------------------------------
// The companion character
// ---------------------------------------------------------------------------

describe('the companion character', () => {
  it('has artwork for every pose the content asks for', () => {
    // companionPose was authored on 14 screens and read by nothing, so half of
    // them drew an anonymous circle and half drew nothing at all. The artwork
    // could not arrive because the image map never asked for it.
    const poses = new Set();
    for (const unit of UNITS) {
      for (const s of unit.screens) if (s.companionPose) poses.add(s.companionPose);
    }
    expect(poses.size).toBeGreaterThan(0);
    for (const pose of poses) {
      expect(NAMES, `no artwork for companionPose "${pose}"`).toContain(`companion-${pose}.webp`);
    }
  });

  it('renders on a hook screen', () => {
    const idx = unit1.screens.findIndex((s) => s.type === 'hook');
    progress.saveScreenPosition('U1', unit1.screens[idx].id);
    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    const img = [...container.querySelectorAll('img')].find((i) => /companion-/.test(i.getAttribute('src')));
    expect(img, 'no companion on the hook screen').toBeTruthy();
  });

  it('renders on a lock-it-in screen, which it never has', () => {
    const idx = unit1.screens.findIndex((s) => s.type === 'lockItIn');
    expect(idx).toBeGreaterThan(-1);
    progress.saveScreenPosition('U1', unit1.screens[idx].id);
    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    const img = [...container.querySelectorAll('img')].find((i) => /companion-pleased/.test(i.getAttribute('src')));
    expect(img, 'lock-it-in screens specified a pose and drew nothing').toBeTruthy();
  });

  it('is decorative — empty alt, and nothing announced', () => {
    const { container } = render(ScreenImage, {
      props: { image: 'companion-thinking.webp', alt: 'ignored', decorative: true, shape: 'square' },
    });
    const img = container.querySelector('img');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('width')).toBe('512');
    expect(img.getAttribute('height')).toBe('512');
  });

  it('hides its placeholder from assistive technology too', () => {
    const { container } = render(ScreenImage, {
      props: { image: 'companion-nonexistent.webp', alt: '', decorative: true, shape: 'square' },
    });
    const box = container.querySelector('div');
    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect(box.getAttribute('role')).toBeNull();
  });
});

describe('no screen is left showing a placeholder', () => {
  it('every image reference in the course resolves to a real file', () => {
    // The point of this pass: after it, nothing anywhere renders a striped
    // rectangle naming a file that will never arrive.
    const onDisk = readdirSync('public/images');
    const unresolved = [];
    for (const unit of UNITS) {
      for (const s of unit.screens) {
        const refs = [
          s.image,
          s.companionPose && `companion-${s.companionPose}.webp`,
          ...(s.imageRow || []).map((p) => p.image),
          ...(s.twoColumn || []).map((c) => c.image),
        ].filter(Boolean);
        for (const r of refs) if (!onDisk.includes(r)) unresolved.push(`${s.id} → ${r}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('no bare unlabelled striped div survives in a screen component', () => {
    // The hook circle was one of these: a div with no text, alt, role or label.
    // A blob to a sighted learner and nothing at all to a screen reader.
    const files = readdirSync('src/lib/screens').filter((f) => f.endsWith('.svelte'));
    for (const f of files) {
      const text = readFileSync(`src/lib/screens/${f}`, 'utf8');
      const bare = text.match(/<div class="[^"]*repeating-linear-gradient[^"]*"><\/div>/g);
      expect(bare, `${f} still has an unlabelled placeholder div`).toBeNull();
    }
  });
});

describe('the drawn diagram', () => {
  it('U4-S05 asks for a diagram, not a file', () => {
    const s = unit4.screens.find((x) => x.id === 'U4-S05');
    expect(s.diagram).toBe('federal-state-two-levels');
    expect(s.image, 'a drawn diagram must not also want a file').toBeUndefined();
  });

  it('describes itself for assistive technology', () => {
    const { container } = render(LevelsDiagram, {});
    const fig = container.querySelector('[role="img"]');
    expect(fig).toBeTruthy();
    expect(fig.getAttribute('aria-label')).toMatch(/federal/i);
    expect(fig.getAttribute('aria-label')).toMatch(/state/i);
    // The SVG itself is hidden: the label above already says what it shows.
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// The guard that was missing
// ---------------------------------------------------------------------------

describe('an image is sized from the image', () => {
  it('declares the file\'s real dimensions, and a box that matches them', () => {
    // This is what silent cropping IS: a box whose aspect differs from the
    // file's. Nothing in the suite could see it — the image rendered, the alt
    // was right, every test passed — while 44% of a portrait was cut away.
    for (const name of NAMES) {
      const [w, h] = manifest.images[name];
      const { container } = render(ScreenImage, { props: { image: name, alt: 'x' } });
      const img = container.querySelector('img');

      expect(img, `${name} did not render`).toBeTruthy();
      expect(Number(img.getAttribute('width')), `${name} declares the wrong width`).toBe(w);
      expect(Number(img.getAttribute('height')), `${name} declares the wrong height`).toBe(h);

      const square = w === h;
      expect(
        img.className.includes(square ? 'aspect-square' : 'aspect-video'),
        `${name} is ${w}×${h} but its box is ${square ? 'not square' : 'not 16:9'}`
      ).toBe(true);
    }
  });

  it('takes no shape from the caller at all', () => {
    // The prop is gone on purpose. Two call sites forgot to pass it and got a
    // 44% crop; the fix is that there is nothing to forget.
    const files = readdirSync('src/lib/screens').concat(readdirSync('src/lib/components'));
    const sources = [
      ...readdirSync('src/lib/screens').map((f) => `src/lib/screens/${f}`),
      ...readdirSync('src/lib/components').map((f) => `src/lib/components/${f}`),
    ].filter((f) => f.endsWith('.svelte'));
    for (const f of sources) {
      expect(readFileSync(f, 'utf8'), `${f} still states an image shape`).not.toMatch(/shape="(square|video)"/);
    }
  });
});

describe('small round avatars are cropped to the head', () => {
  it('every companion in a box under 96px asks for the head crop', () => {
    // A head-and-torso portrait dropped whole into a 64px circle renders the
    // face at about 35px with its shoulders clipped away. The delivery shipped
    // hand-made 64px crops for two poses because of exactly this.
    const sources = ['Lesson', 'Rehearsal', 'Welcome'].map((n) => [
      n,
      readFileSync(`src/lib/screens/${n}.svelte`, 'utf8'),
    ]);
    for (const [name, text] of sources) {
      // Any wrapper sized below 96px (w-16 = 64px, w-20 = 80px) holding a
      // companion must pass crop="head".
      const smallBoxes = text.match(/<div class="w-(1[0-9]|2[0-3]) [^"]*"[\s\S]{0,240}?<\/div>/g) || [];
      for (const block of smallBoxes) {
        if (!block.includes('companion-')) continue;
        expect(block, `${name}: a small companion avatar is missing crop="head"`).toMatch(/crop="head"/);
      }
    }
  });

  it('shows the top of the artwork, where the head is', () => {
    const { container } = render(ScreenImage, {
      props: { image: 'companion-thinking.webp', decorative: true, crop: 'head', wrapperClass: '' },
    });
    const img = container.querySelector('img');
    // Anchored to the top and scaled past the box, so the visible window is the
    // upper part of the portrait rather than the whole figure shrunk down.
    expect(img.className).toMatch(/top-0/);
    expect(img.className).toMatch(/w-\[160%\]/);
    expect(container.querySelector('div').className).toMatch(/overflow-hidden/);
  });

  it('leaves Welcome uncropped — it is a portrait, not an avatar', () => {
    const text = readFileSync('src/lib/screens/Welcome.svelte', 'utf8');
    expect(text).toMatch(/companion-welcome\.webp/);
    expect(text, 'Welcome shows the whole figure at 200px').not.toMatch(
      /companion-welcome\.webp"[^>]*crop="head"/
    );
  });
});
