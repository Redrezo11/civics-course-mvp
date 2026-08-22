/**
 * The LMS session, against a fake LRS.
 *
 * This is the substitute for a real one, and it is not the same thing. It pins
 * what the AU sends, in what order, and under what conditions — which is where
 * the prototype runtime this was built from went wrong, four times over. It
 * proves nothing about a real server's authentication or an LMS's reporting.
 *
 * Every test below that names a defect corresponds to a line in the cmi5
 * specification, quoted in docs/CMI5-PACKAGE.md.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import * as cmi5 from '../src/lib/cmi5.js';

const ENDPOINT = 'https://lrs.example.test/xapi/';
const FETCH_URL = 'https://lms.example.test/token/abc123';
const ACTIVITY = 'https://example.org/civics-course/au/main';
const REGISTRATION = '6f2c7e5a-0000-4000-8000-000000000001';

const CATEGORY = 'https://w3id.org/xapi/cmi5/context/categories/cmi5';
const SESSION_EXT = 'https://w3id.org/xapi/cmi5/context/extensions/sessionid';

const VERB = (name) => `http://adlnet.gov/expapi/verbs/${name}`;

/** Statements the fake LRS has been sent, in order. */
let sent;
/** Every URL fetched, so single-use can be asserted by counting. */
let fetched;

function launchWith({ actor = { mbox: 'mailto:learner@example.test' }, extra = {} } = {}) {
  const q = new URLSearchParams({
    endpoint: ENDPOINT,
    fetch: FETCH_URL,
    actor: JSON.stringify(actor),
    activityId: ACTIVITY,
    registration: REGISTRATION,
    ...extra,
  });
  window.history.replaceState({}, '', `/?${q}`);
}

function fakeLrs({ launchMode = 'Normal', contextTemplate = undefined, tokenUses = 0 } = {}) {
  let uses = tokenUses;
  return vi.fn(async (url, options = {}) => {
    fetched.push(url);

    if (url === FETCH_URL) {
      uses += 1;
      // Single-use by specification: a second request errors with code 1.
      if (uses > 1) {
        return { ok: true, json: async () => ({ 'error-code': '1', 'error-text': 'Token has been used before' }) };
      }
      return { ok: true, json: async () => ({ 'auth-token': 'dG9rZW4=' }) };
    }

    if (url.includes('activities/state')) {
      return { ok: true, json: async () => ({ launchMode, ...(contextTemplate ? { contextTemplate } : {}) }) };
    }

    if (url.includes('agents/profile')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }

    if (url.endsWith('statements')) {
      sent.push({ statement: JSON.parse(options.body), keepalive: Boolean(options.keepalive) });
      return { ok: true, json: async () => [] };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });
}

const verbsSent = () => sent.map((s) => s.statement.verb.id);
const statementFor = (name) => sent.find((s) => s.statement.verb.id === VERB(name))?.statement;

beforeEach(() => {
  sent = [];
  fetched = [];
  cmi5.__reset();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('no LMS, no traffic', () => {
  it('sends nothing at all when there are no launch parameters', async () => {
    const fetchSpy = fakeLrs();
    vi.stubGlobal('fetch', fetchSpy);

    const session = await cmi5.init();

    expect(session.active).toBe(false);
    expect(fetchSpy, 'the web build must never call out').not.toHaveBeenCalled();
  });

  it('keeps every other call inert too', async () => {
    const fetchSpy = fakeLrs();
    vi.stubGlobal('fetch', fetchSpy);
    await cmi5.init();

    await cmi5.complete();
    await cmi5.progress(50);
    await cmi5.terminate();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('degrades when the parameters are there but the token fetch fails', async () => {
    launchWith();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    // A learner on a broken connection gets the course, not a blank screen.
    const session = await cmi5.init();
    expect(session.active).toBe(false);
    await expect(cmi5.complete()).resolves.toBeUndefined();
  });
});

describe('the session opens', () => {
  it('fetches the auth token exactly once, even if init is called twice', async () => {
    // DEFECT 4. The fetch URL is single-use; a second request errors with code
    // 1 and the session dies for a reason nobody would guess from the symptom.
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());

    await cmi5.init();
    await cmi5.init();

    expect(fetched.filter((u) => u === FETCH_URL)).toHaveLength(1);
  });

  it('sends Initialized first', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();

    expect(verbsSent()[0]).toBe(VERB('initialized'));
  });

  it('carries the category, session id and registration on a defined statement', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();

    const { context } = statementFor('initialized');
    expect(context.contextActivities.category.map((c) => c.id)).toContain(CATEGORY);
    expect(context.extensions[SESSION_EXT]).toBeTruthy();
    expect(context.registration).toBe(REGISTRATION);
  });

  it('merges the LMS context template rather than replacing it', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs({
      contextTemplate: {
        contextActivities: { parent: [{ id: 'https://lms.example.test/course/42' }] },
        extensions: { 'https://lms.example.test/ext/tenant': 'acme' },
      },
    }));
    await cmi5.init();

    const { context } = statementFor('initialized');
    // The parent activity is how an LMS ties the AU to the course around it.
    expect(context.contextActivities.parent[0].id).toBe('https://lms.example.test/course/42');
    expect(context.extensions['https://lms.example.test/ext/tenant']).toBe('acme');
    expect(context.contextActivities.category.map((c) => c.id)).toContain(CATEGORY);
  });

  it('reads an actor whose name contains a percent sign', async () => {
    // DEFECT 6. URLSearchParams.get() has already decoded; decoding a second
    // time corrupts or throws on any name containing % or +.
    const actor = { name: '100% Complete', mbox: 'mailto:a+b@example.test' };
    launchWith({ actor });
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();

    expect(statementFor('initialized').actor).toEqual(actor);
  });
});

describe('finishing the course', () => {
  const start = async (opts) => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs(opts));
    await cmi5.init();
    sent.length = 0;
  };

  it('sends Completed and Passed together', async () => {
    // Both, per the conversion brief: TalentLMS marks a unit done more
    // consistently when both arrive, and there is no mastery score to conflict.
    await start();
    await cmi5.complete();

    expect(verbsSent()).toEqual([VERB('completed'), VERB('passed')]);
  });

  it('puts a duration on both', async () => {
    // DEFECT 2. The spec states the requirement separately for Completed,
    // Passed and Terminated. The prototype sent none of them.
    await start();
    await cmi5.complete();

    for (const s of sent) {
      expect(s.statement.result.duration, s.statement.verb.id).toMatch(/^PT\d+(\.\d+)?S$/);
    }
  });

  it('never sends Completed twice', async () => {
    await start();
    await cmi5.complete();
    await cmi5.complete();

    expect(verbsSent().filter((v) => v === VERB('completed'))).toHaveLength(1);
  });

  it('sends nothing in Review mode', async () => {
    // DEFECT 1, and the one most likely to be noticed in a real LMS: without
    // it, a learner revisiting finished material re-satisfies it every time.
    await start({ launchMode: 'Review' });
    await cmi5.complete();
    await cmi5.progress(100);

    expect(sent).toHaveLength(0);
  });

  it('sends nothing in Browse mode', async () => {
    await start({ launchMode: 'Browse' });
    await cmi5.complete();

    expect(sent).toHaveLength(0);
  });
});

describe('progress', () => {
  it('omits the cmi5 category, because progressed is an allowed statement', async () => {
    // DEFECT 3. The category marks a cmi5-DEFINED statement. Applying it to an
    // allowed one is a conformance error.
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();
    sent.length = 0;

    await cmi5.progress(44.5);

    const { context, result } = sent[0].statement;
    expect((context.contextActivities.category || []).map((c) => c.id)).not.toContain(CATEGORY);
    expect(context.extensions[SESSION_EXT], 'the template still applies').toBeTruthy();
    expect(result.extensions['https://w3id.org/xapi/cmi5/result/extensions/progress']).toBe(45);
  });

  it('clamps to 0–100', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();
    sent.length = 0;

    await cmi5.progress(-10);
    await cmi5.progress(140);

    const values = sent.map(
      (s) => s.statement.result.extensions['https://w3id.org/xapi/cmi5/result/extensions/progress']
    );
    expect(values).toEqual([0, 100]);
  });
});

describe('leaving', () => {
  it('sends Terminated with a duration on pagehide, and only once', async () => {
    // DEFECT 5. beforeunload does not fire reliably on mobile, and this course
    // exists for people on cheap Android phones.
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();
    sent.length = 0;

    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0].statement.verb.id).toBe(VERB('terminated'));
    expect(sent[0].statement.result.duration).toMatch(/^PT/);
    expect(sent[0].keepalive, 'must outlive the page').toBe(true);

    await cmi5.terminate();
    expect(sent).toHaveLength(1);
  });
});

describe('nothing is ever counted against the learner', () => {
  it('has no code path that sends Failed', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();

    await cmi5.complete();
    await cmi5.progress(100);
    await cmi5.terminate();

    // Rule G-1. The rehearsal is self-marked and unscored; an LMS mapping a
    // Failed statement onto its enclosing course would turn a practice run of
    // 11 out of 20 into a failed course. QA check 22 asserts the same thing
    // against the source, so this cannot be satisfied by never calling the path.
    expect(verbsSent()).not.toContain(VERB('failed'));
  });

  it('sends no official question wording anywhere', async () => {
    launchWith();
    vi.stubGlobal('fetch', fakeLrs());
    await cmi5.init();
    await cmi5.complete();

    const body = JSON.stringify(sent.map((s) => s.statement));
    expect(body).not.toMatch(/supreme law of the land/i);
    expect(body).not.toMatch(/\bQ\d+\b/);
  });
});

describe('what counts as finishing the course', () => {
  // The conversion brief said to fire Completed "at the exact point Unit 7
  // finishes". That is wrong for this repo twice over: U0 is orientation and
  // teaches none of the 128, and units are not locked — a learner may do U7
  // third. Both are settled by `courseComplete`, which Home.svelte renders from
  // too, so the screen and the LMS cannot disagree.
  it('is every lesson unit, and not Unit 7 on its own', async () => {
    const { courseComplete, LESSON_UNITS } = await import('../src/lib/stores/progress.js');
    const { progress } = await import('../src/lib/stores/progress.js');
    const { get } = await import('svelte/store');

    progress.resetAll();
    expect(get(courseComplete)).toBe(false);

    progress.markUnitComplete('U7');
    expect(get(courseComplete), 'U7 alone must not finish the course').toBe(false);

    progress.markUnitComplete('U0');
    for (const id of LESSON_UNITS) progress.markUnitComplete(id);
    expect(get(courseComplete)).toBe(true);

    progress.resetAll();
    for (const id of LESSON_UNITS) progress.markUnitComplete(id);
    expect(get(courseComplete), 'U0 is orientation and must not be required').toBe(true);
  });
});
