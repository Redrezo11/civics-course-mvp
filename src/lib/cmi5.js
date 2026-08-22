// cmi5.js — the LMS session. The ONE module in this project that may touch the
// network, and only ever the endpoint the LMS itself named at launch.
//
// Rule G-11/G-12 was never "no network". It was no server of ours and no third
// party, so that a learner's practice is not observable by anyone who was not
// already part of the arrangement. An LRS supplied by the organisation the
// learner enrolled with is neither. QA check 8 enforces that this file is the
// only one, and that it contains no hardcoded host — every URL below is built
// from a launch parameter.
//
// NO LAUNCH PARAMETERS MEANS NO LMS.
//
// Opened from GitHub Pages, or a local preview, or anywhere that is not an LMS,
// `init()` finds no `endpoint`, marks itself inactive, and every function here
// becomes a no-op. The course then behaves exactly as it always has. That path
// is not a fallback bolted on afterwards; it is the common case, and there is a
// test asserting nothing is sent on it.
//
// This is the prototype runtime from the conversion brief, with six changes.
// They are listed here rather than in a commit message because the next person
// to read the brief will otherwise "fix" this file back:
//
//   1. launchMode is read and honoured. Browse and Review send Initialized and
//      Terminated ONLY — the spec forbids other cmi5-defined statements there,
//      and without it a learner revisiting a finished course re-satisfies it on
//      every visit.
//   2. result.duration on Completed, Passed and Terminated. The spec states the
//      requirement separately for each; the prototype sent none of them.
//   3. `progressed` omits the cmi5 category. Category marks a cmi5-DEFINED
//      statement; progressed is a cmi5-ALLOWED one and must carry the context
//      template without it.
//   4. The fetch URL is used once. It is single-use by specification and a
//      second request errors with code 1 — which a double init(), an HMR reload
//      or a refresh mid-boot would otherwise cause.
//   5. pagehide, not beforeunload. beforeunload does not fire reliably on
//      mobile, and this course exists for people on cheap Android phones.
//   6. The actor is not double-decoded. URLSearchParams.get() has already
//        decoded it; decoding again corrupts any name containing % or +.
//
// Fetching LMS.LaunchData is what makes (1) possible, and the same document
// carries contextTemplate, which every statement must merge.

const VERBS = {
  initialized: 'http://adlnet.gov/expapi/verbs/initialized',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  passed: 'http://adlnet.gov/expapi/verbs/passed',
  terminated: 'http://adlnet.gov/expapi/verbs/terminated',
  progressed: 'http://adlnet.gov/expapi/verbs/progressed',
};

const CATEGORY_ACTIVITY = {
  id: 'https://w3id.org/xapi/cmi5/context/categories/cmi5',
  objectType: 'Activity',
};
const SESSION_ID_EXT = 'https://w3id.org/xapi/cmi5/context/extensions/sessionid';
const PROGRESS_EXT = 'https://w3id.org/xapi/cmi5/result/extensions/progress';

const state = {
  active: false,
  endpoint: null,
  authHeader: null,
  actor: null,
  registration: null,
  activityId: null,
  sessionId: null,
  launchMode: 'Normal',
  contextTemplate: null,
  startedAt: null,
  completedSent: false,
  terminated: false,
};

/** Set the moment init() begins, so a second call cannot burn the fetch URL. */
let initCalled = false;

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * ISO 8601 duration, which the spec requires on Completed, Passed and
 * Terminated. Seconds with two decimals is the granularity cmi5 asks for.
 */
function durationSince(startMs) {
  return `PT${Math.max(0, (Date.now() - startMs) / 1000).toFixed(2)}S`;
}

const param = (name) => new URLSearchParams(window.location.search).get(name);

/**
 * Context for a cmi5 DEFINED statement.
 *
 * contextTemplate comes from the LMS and must be merged rather than replaced —
 * it can carry contextActivities of its own (a parent course activity, most
 * often), which is how an LMS ties the AU to the course it sits in. Merging
 * shallowly and then re-adding the category keeps both.
 */
function contextFor({ category }) {
  const template = state.contextTemplate || {};
  const templateActivities = template.contextActivities || {};
  const contextActivities = { ...templateActivities };
  if (category) {
    contextActivities.category = [...(templateActivities.category || []), CATEGORY_ACTIVITY];
  }
  return {
    ...template,
    registration: state.registration,
    contextActivities,
    extensions: { ...(template.extensions || {}), [SESSION_ID_EXT]: state.sessionId },
  };
}

async function send(verbId, { result, category = true, keepalive = false } = {}) {
  if (!state.active) return false;
  const statement = {
    id: uuid(),
    actor: state.actor,
    verb: { id: verbId, display: { 'en-US': verbId.split('/').pop() } },
    object: { id: state.activityId, objectType: 'Activity' },
    context: contextFor({ category }),
    timestamp: new Date().toISOString(),
  };
  if (result) statement.result = result;

  try {
    const res = await fetch(`${state.endpoint}statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: state.authHeader,
        'X-Experience-API-Version': '1.0.3',
      },
      body: JSON.stringify(statement),
      keepalive,
    });
    return res.ok;
  } catch (e) {
    // A dropped statement must never take the lesson down with it. The learner
    // is mid-sentence in a civics course; a failed report is our problem.
    console.error('cmi5: could not send', verbId, e);
    return false;
  }
}

/** The launch-time state document: launchMode, contextTemplate, returnURL. */
async function readLaunchData() {
  const query = new URLSearchParams({
    stateId: 'LMS.LaunchData',
    activityId: state.activityId,
    agent: JSON.stringify(state.actor),
    registration: state.registration,
  });
  try {
    const res = await fetch(`${state.endpoint}activities/state?${query}`, {
      headers: {
        Authorization: state.authHeader,
        'X-Experience-API-Version': '1.0.3',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('cmi5: could not read LMS.LaunchData', e);
    return null;
  }
}

/** Learner preferences, if the LMS keeps any. Absent is normal, not an error. */
async function readPreferences() {
  const query = new URLSearchParams({
    profileId: 'cmi5LearnerPreferences',
    agent: JSON.stringify(state.actor),
  });
  try {
    const res = await fetch(`${state.endpoint}agents/profile?${query}`, {
      headers: {
        Authorization: state.authHeader,
        'X-Experience-API-Version': '1.0.3',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Start the session, if an LMS launched us.
 *
 * Returns `{ active, languagePreference, audioPreference }`. Callers use the
 * preferences to skip questions the LMS has already answered on the learner's
 * behalf — the language screen, most usefully.
 */
export async function init() {
  // The fetch URL is single-use. Two calls means the second gets error code 1
  // and the session dies for a reason nobody would guess from the symptom.
  if (initCalled) return { active: state.active };
  initCalled = true;

  const endpoint = param('endpoint');
  const fetchUrl = param('fetch');
  const actorRaw = param('actor');
  const activityId = param('activityId');

  if (!endpoint || !fetchUrl || !actorRaw || !activityId) {
    return { active: false };
  }

  try {
    // Already decoded by URLSearchParams — decoding twice breaks any actor
    // whose name contains a % or a +.
    state.actor = JSON.parse(actorRaw);
  } catch (e) {
    console.error('cmi5: unreadable actor parameter', e);
    return { active: false };
  }

  state.endpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
  state.registration = param('registration');
  state.activityId = activityId;
  state.sessionId = uuid();
  state.startedAt = Date.now();

  try {
    const res = await fetch(fetchUrl, { method: 'POST' });
    const body = await res.json();
    if (body['error-text']) throw new Error(`${body['error-code']}: ${body['error-text']}`);
    if (!body['auth-token']) throw new Error('no auth-token in fetch response');
    state.authHeader = `Basic ${body['auth-token']}`;
  } catch (e) {
    console.error('cmi5: authentication failed', e);
    return { active: false };
  }

  state.active = true;

  const launchData = await readLaunchData();
  if (launchData) {
    state.launchMode = launchData.launchMode || 'Normal';
    state.contextTemplate = launchData.contextTemplate || null;
  }

  await send(VERBS.initialized);

  // pagehide, not beforeunload: beforeunload is unreliable on mobile browsers,
  // and this course is built for cheap Android phones. keepalive lets the
  // request outlive the page.
  window.addEventListener('pagehide', () => {
    if (state.active && !state.terminated) {
      state.terminated = true;
      send(VERBS.terminated, {
        result: { duration: durationSince(state.startedAt) },
        keepalive: true,
      });
    }
  });

  const prefs = await readPreferences();
  return {
    active: true,
    languagePreference: prefs?.languagePreference || null,
    audioPreference: prefs?.audioPreference || null,
  };
}

/**
 * The learner finished the course.
 *
 * Completed AND Passed, per the conversion brief: TalentLMS marks a unit done
 * more consistently when both arrive, and with a single unscored AU there is no
 * mastery score for Passed to contradict.
 *
 * Failed is never sent, by anything, ever. There is no scored assessment here —
 * the rehearsal is self-marked, and rule G-1 forbids counting anything against
 * the learner. An LMS that maps statements coarsely onto its enclosing course
 * would otherwise turn a practice run of 11 into a failed course. QA check 22
 * asserts no code path can.
 */
export async function complete() {
  if (!state.active || state.completedSent) return;
  // Browse and Review must send Initialized and Terminated and nothing else.
  // Without this a learner revisiting finished material re-satisfies it.
  if (state.launchMode !== 'Normal') return;

  state.completedSent = true;
  const duration = durationSince(state.startedAt);
  await send(VERBS.completed, { result: { completion: true, duration } });
  await send(VERBS.passed, { result: { success: true, completion: true, duration } });
}

/**
 * Course progress, 0–100.
 *
 * A cmi5 ALLOWED statement, not a defined one, so it carries the context
 * template WITHOUT the cmi5 category — that category is what marks a statement
 * as cmi5-defined, and applying it here is a conformance error.
 */
export async function progress(percent) {
  if (!state.active || state.launchMode !== 'Normal') return;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  await send(VERBS.progressed, {
    category: false,
    result: { extensions: { [PROGRESS_EXT]: clamped } },
  });
}

export async function terminate() {
  if (!state.active || state.terminated) return;
  state.terminated = true;
  await send(VERBS.terminated, { result: { duration: durationSince(state.startedAt) } });
}

export const isActive = () => state.active;
export const launchMode = () => state.launchMode;

/** Test seam. Never called by the app. */
export function __reset() {
  initCalled = false;
  Object.assign(state, {
    active: false, endpoint: null, authHeader: null, actor: null, registration: null,
    activityId: null, sessionId: null, launchMode: 'Normal', contextTemplate: null,
    startedAt: null, completedSent: false, terminated: false,
  });
}
