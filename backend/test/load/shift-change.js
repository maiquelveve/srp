// k6 load test for SC-004 (research.md #14): 200 concurrent users during shift change,
// p95 < 500 ms and no 5xx. Flow per virtual user: login once, then repeat
// inmate lookup by gallery/id and a temporary exit + return.
//
//   k6 run backend/test/load/shift-change.js
//   docker run --rm -i --network host -v "$PWD/backend/test/load:/scripts" grafana/k6 run /scripts/shift-change.js
//
// Point it at a backend running against a disposable database (default: the integration-test
// fixtures, `npm run pretest:integration`, backend with POSTGRES_DB=srp_db_test) and start that
// backend with THROTTLE_LIMIT and THROTTLE_LOGIN_LIMIT raised (k6 sends everything from one IP,
// so the defaults, 100 requests/minute and 5 logins/minute, would answer 429). Do NOT aim it at a production database: setup() creates
// a gallery, cells and inmates, and every iteration writes movements.
//
// Environment variables (all optional):
//   BASE_URL            default http://localhost:3000/api/v1
//   WARDEN_EMAIL        default warden@test.srp.rs.gov.br   (creates the setup data)
//   OFFICER_EMAIL       default officer@test.srp.rs.gov.br  (what each virtual user logs in as)
//   PASSWORD            default Test@12345
//   UNIT_ID             default 1
//   MOVEMENT_TYPE_ID    default 1  (a TEMPORARY movement type)
//   VUS                 default 200
//   HOLD_SECONDS        default 90
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const WARDEN_EMAIL = __ENV.WARDEN_EMAIL || 'warden@test.srp.rs.gov.br';
const OFFICER_EMAIL = __ENV.OFFICER_EMAIL || 'officer@test.srp.rs.gov.br';
const PASSWORD = __ENV.PASSWORD || 'Test@12345';
const UNIT_ID = Number(__ENV.UNIT_ID || 1);
const MOVEMENT_TYPE_ID = Number(__ENV.MOVEMENT_TYPE_ID || 1);
const VUS = Number(__ENV.VUS || 200);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 90);
const CELL_CAPACITY = 4;

const serverErrors = new Counter('server_errors');

export const options = {
  scenarios: {
    shiftChange: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: `${HOLD_SECONDS}s`, target: VUS },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // SC-004: p95 < 500 ms across the whole flow, and nothing answers 5xx.
    'http_req_duration{phase:run}': ['p(95)<500'],
    'http_req_failed{phase:run}': ['rate<0.01'],
    server_errors: ['count==0'],
    // Per flow, so a miss shows which step is slow.
    'http_req_duration{kind:login}': ['p(95)<500'],
    'http_req_duration{kind:lookup}': ['p(95)<500'],
    'http_req_duration{kind:movement}': ['p(95)<500'],
  },
};

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function tryLogin(email, phase, kind) {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: jsonHeaders(), tags: { phase, kind } },
  );
  if (response.status >= 500) serverErrors.add(1);
  return response.status === 201 || response.status === 200 ? response.json('accessToken') : null;
}

function login(email, phase, kind) {
  const accessToken = tryLogin(email, phase, kind);
  if (accessToken === null) {
    throw new Error(`login failed for ${email}`);
  }
  return accessToken;
}

function setupPost(token, path, body) {
  const response = http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: jsonHeaders(token),
    tags: { phase: 'setup', kind: 'setup' },
  });
  if (response.status !== 201) {
    throw new Error(`setup POST ${path} failed: ${response.status} ${response.body}`);
  }
  return response.json();
}

// One inmate per virtual user, so no exit ever collides with another user's open movement (409).
export function setup() {
  const wardenToken = login(WARDEN_EMAIL, 'setup', 'setup');
  const suffix = `${Date.now()}`.slice(-8);
  const gallery = setupPost(wardenToken, '/galleries', {
    unitId: UNIT_ID,
    code: `LOAD-${suffix}`,
    type: 'MALE',
  });

  const inmates = [];
  const cellCount = Math.ceil(VUS / CELL_CAPACITY);
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const cell = setupPost(wardenToken, '/cells', {
      galleryId: gallery.id,
      code: String(cellIndex + 1).padStart(3, '0'),
      capacity: CELL_CAPACITY,
      type: 'SHARED',
    });
    for (let slot = 0; slot < CELL_CAPACITY && inmates.length < VUS; slot += 1) {
      const inmate = setupPost(wardenToken, '/inmates', {
        name: `Load ${suffix} ${inmates.length + 1}`,
        currentCellId: cell.id,
      });
      inmates.push({ id: inmate.id, cellId: cell.id });
    }
  }
  return { galleryId: gallery.id, inmates };
}

let token = null;

export default function (data) {
  const inmate = data.inmates[(__VU - 1) % data.inmates.length];

  if (token === null) {
    token = tryLogin(OFFICER_EMAIL, 'run', 'login');
    if (token === null) {
      // Rejected login (e.g. 429): count it via http_req_failed, wait and retry instead of spinning.
      sleep(1);
      return;
    }
  }
  const headers = jsonHeaders(token);

  const track = (response, expectedStatuses, name) => {
    if (response.status >= 500) serverErrors.add(1);
    check(response, { [name]: (r) => expectedStatuses.includes(r.status) });
  };

  // Lookup: inmates of the gallery, then one inmate.
  const list = http.get(`${BASE_URL}/inmates?galleryId=${data.galleryId}`, {
    headers,
    tags: { phase: 'run', kind: 'lookup' },
  });
  track(list, [200], 'inmate list 200');
  const detail = http.get(`${BASE_URL}/inmates/${inmate.id}`, {
    headers,
    tags: { phase: 'run', kind: 'lookup' },
  });
  track(detail, [200], 'inmate detail 200');
  sleep(1 + Math.random());

  // Temporary exit and return.
  const exit = http.post(
    `${BASE_URL}/movements`,
    JSON.stringify({
      inmateId: inmate.id,
      movementTypeId: MOVEMENT_TYPE_ID,
      originCellId: inmate.cellId,
      destinationLocation: 'Load test',
      reason: 'Teste de carga',
    }),
    { headers, tags: { phase: 'run', kind: 'movement' } },
  );
  track(exit, [201, 200], 'movement exit created');
  if (exit.status === 201 || exit.status === 200) {
    sleep(1 + Math.random());
    const back = http.patch(`${BASE_URL}/movements/${exit.json('id')}/return`, JSON.stringify({}), {
      headers,
      tags: { phase: 'run', kind: 'movement' },
    });
    track(back, [200], 'movement return 200');
  }
  sleep(1 + Math.random());
}
