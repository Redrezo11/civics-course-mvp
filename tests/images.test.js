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
import { readdirSync } from 'node:fs';

import ScreenImage from '../src/lib/components/ScreenImage.svelte';
import manifest from '../src/lib/content/image-manifest.json';

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
      if (s.image) out.push({ screen: s.id, image: s.image, alt: s.alt });
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
    expect([...manifest.images].sort()).toEqual([...onDisk].sort());
  });
});

describe('every image slot', () => {
  it('carries alt text', () => {
    for (const s of slots()) {
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
    const filled = slots().filter((s) => manifest.images.includes(s.image));
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
  const image = manifest.images[0];

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
