// router.js — deliberately not a library. Hash routing needs no server-side
// rewrite rules, which matters on GitHub Pages (no server) and inside a
// future cmi5 package (served from an unpredictable path inside an LMS
// iframe). A route is just the string after '#'.

import { writable } from 'svelte/store';

function currentRoute() {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

export const route = writable(currentRoute());

window.addEventListener('hashchange', () => {
  route.set(currentRoute());
});

export function navigate(path) {
  window.location.hash = path;
}

// Parses "/unit/U1/screen/U1-S05" into { unit: 'U1', screen: 'U1-S05' }.
// Kept intentionally simple — this app has a shallow, known route shape,
// not general-purpose nested routing.
export function parseRoute(path) {
  const parts = path.split('/').filter(Boolean);
  const result = {};
  for (let i = 0; i < parts.length; i += 2) {
    result[parts[i]] = parts[i + 1];
  }
  return result;
}
