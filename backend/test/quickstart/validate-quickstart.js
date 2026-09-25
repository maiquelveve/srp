// End-to-end validation of quickstart.md scenarios 0-6 against a running backend (T073).
// Scenario 7 (offline sync) needs the mobile app on a device/emulator and scenario 8 is the
// k6 load test (test/load/shift-change.js); both are reported as MANUAL / separate here.
//
//   npm run build && npm run pretest:integration        # disposable DB with the seed fixtures
//   PORT=3100 POSTGRES_DB=srp_db_test node dist/main &  # default rate limits on purpose
//   node backend/test/quickstart/validate-quickstart.js
//
// Environment variables (optional): BASE_URL (default http://localhost:3100/api/v1),
// PASSWORD (Test@12345), WARDEN_EMAIL, SUPERVISOR_EMAIL, OFFICER_EMAIL, UNIT_ID (1).
// It writes data (users, gallery, cells, inmate...): never aim it at a production database.
// Logs in as 3 users and once as a deactivated one, staying under the 5 logins/minute guard.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100/api/v1';
const PASSWORD = process.env.PASSWORD || 'Test@12345';
const WARDEN_EMAIL = process.env.WARDEN_EMAIL || 'warden@test.srp.rs.gov.br';
const SUPERVISOR_EMAIL = process.env.SUPERVISOR_EMAIL || 'supervisor@test.srp.rs.gov.br';
const OFFICER_EMAIL = process.env.OFFICER_EMAIL || 'officer@test.srp.rs.gov.br';
const UNIT_ID = Number(process.env.UNIT_ID || 1);
const TEMPORARY_TYPE_ID = Number(process.env.TEMPORARY_TYPE_ID || 1);

const results = [];
let serverErrors = 0;

async function call(method, path, token, body) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (response.status >= 500) serverErrors += 1;
  return { status: response.status, body: json, raw: text, ms: Date.now() - started };
}

function check(scenario, description, passed, detail = '') {
  results.push({ scenario, description, passed: Boolean(passed), detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  [${scenario}] ${description}${passed || !detail ? '' : `  -> ${detail}`}`);
}

async function login(email) {
  const response = await call('POST', '/auth/login', null, { email, password: PASSWORD });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`login failed for ${email}: ${response.status} ${response.raw}`);
  }
  return response.body.accessToken;
}

const suffix = Date.now().toString().slice(-7);
const today = new Date().toISOString().slice(0, 10);

async function main() {
  const warden = await login(WARDEN_EMAIL);
  const supervisor = await login(SUPERVISOR_EMAIL);
  const officer = await login(OFFICER_EMAIL);

  // Scenario 0 - user management (FR-030..FR-032)
  const newUserBody = {
    name: `Supervisor Quickstart ${suffix}`,
    email: `qs.${suffix}@srp.rs.gov.br`,
    badgeNumber: `QS-${suffix}`,
    jobTitle: 'Supervisor',
    role: 'SUPERVISOR',
    unitIds: [UNIT_ID],
  };
  const created = await call('POST', '/users', warden, newUserBody);
  check('0', 'WARDEN creates a SUPERVISOR (201)', created.status === 201, `status ${created.status}`);
  check('0', 'response never includes passwordHash or a password', !/passwordHash|"password"/.test(created.raw));
  check('0', 'SUPERVISOR cannot create users (403)', (await call('POST', '/users', supervisor, { ...newUserBody, email: `x.${suffix}@srp.rs.gov.br` })).status === 403);
  check('0', 'PRISON_OFFICER cannot create users (403)', (await call('POST', '/users', officer, { ...newUserBody, email: `y.${suffix}@srp.rs.gov.br` })).status === 403);
  const deactivated = await call('PATCH', `/users/${created.body.id}/deactivate`, warden);
  check('0', 'WARDEN deactivates the user (200)', deactivated.status === 200, `status ${deactivated.status}`);
  const deactivatedLogin = await call('POST', '/auth/login', null, { email: newUserBody.email, password: PASSWORD });
  check('0', 'deactivated user cannot log in (401)', deactivatedLogin.status === 401, `status ${deactivatedLogin.status}`);

  // Scenario 1 - structure (US1)
  const gallery = await call('POST', '/galleries', warden, { unitId: UNIT_ID, code: `QS-${suffix}`, type: 'MALE' });
  const cell = await call('POST', '/cells', warden, { galleryId: gallery.body.id, code: '01', capacity: 4, type: 'SHARED' });
  const inmate = await call('POST', '/inmates', warden, { name: `Preso Quickstart ${suffix}`, currentCellId: cell.body.id });
  check('1', 'gallery, cell and inmate created (201)', [gallery, cell, inmate].every((r) => r.status === 201), `${gallery.status}/${cell.status}/${inmate.status}`);
  const byCell = await call('GET', `/inmates?cellId=${cell.body.id}`, warden);
  check('1', 'GET /inmates?cellId returns the inmate as ACTIVE', byCell.body?.data?.some((i) => i.id === inmate.body.id && i.status === 'ACTIVE'));
  check('1', 'PRISON_OFFICER cannot create inmates (403)', (await call('POST', '/inmates', officer, { name: 'x', currentCellId: cell.body.id })).status === 403);

  // Scenario 2 - temporary movement (US2)
  const exitBody = { inmateId: inmate.body.id, movementTypeId: TEMPORARY_TYPE_ID, originCellId: cell.body.id, destinationLocation: 'Atendimento interno', reason: 'Atendimento médico interno' };
  const exit = await call('POST', '/movements', officer, exitBody);
  check('2', 'officer registers the exit (201)', exit.status === 201, `status ${exit.status}`);
  const outNow = await call('GET', `/inmates/${inmate.body.id}`, officer);
  check('2', 'inmate shows inMovement=true', outNow.body?.inMovement === true);
  check('2', 'second exit without return is rejected (409)', (await call('POST', '/movements', officer, exitBody)).status === 409);
  const back = await call('PATCH', `/movements/${exit.body.id}/return`, officer, {});
  check('2', 'return registered (200)', back.status === 200, `status ${back.status}`);
  check('2', 'inmate shows inMovement=false again', (await call('GET', `/inmates/${inmate.body.id}`, officer)).body?.inMovement === false);
  check('2', 'exit, lookup and return each answer well under 30 s (SC-001, API side)', [exit, outNow, back].every((r) => r.ms < 5000), `${exit.ms}/${outNow.ms}/${back.ms} ms`);

  // Scenario 3 - final situation (US3)
  const release = await call('POST', '/movements/final/release', warden, { inmateId: inmate.body.id, reason: 'Alvará 001/2026' });
  check('3', 'WARDEN registers release (201)', release.status === 201, `status ${release.status}`);
  check('3', 'inmate status becomes RELEASED', (await call('GET', `/inmates/${inmate.body.id}`, warden)).body?.status === 'RELEASED');
  const history = await call('GET', `/inmates/${inmate.body.id}/location-history`, warden);
  check('3', 'location history has the cell entry and the release', (history.body?.data ?? history.body ?? []).length >= 1, JSON.stringify(history.body).slice(0, 160));

  const releaseAudit = await call('GET', `/audit?table=movements&recordId=${release.body.id}`, warden);
  check('3', 'audit has a movements INSERT for the release, with the reason (FR-026)', (releaseAudit.body?.data ?? []).some((a) => a.action === 'INSERT' && a.newData?.reason === 'Alvará 001/2026'), `status ${releaseAudit.status}`);

  // Scenario 3 (cont.) - reversal of a definitive situation registered by mistake (FR-016a)
  const nameFilter = encodeURIComponent(`Preso Quickstart ${suffix}`);
  const listedBefore = await call('GET', `/movements/definitive-situations?name=${nameFilter}`, warden);
  check('3', 'WARDEN sees the release in the definitive situations list (FR-016a)', (listedBefore.body?.data ?? []).some((row) => row.inmateId === inmate.body.id && row.situation === 'Liberdade'), `status ${listedBefore.status}`);
  check('3', 'SUPERVISOR cannot read the definitive situations list (403)', (await call('GET', '/movements/definitive-situations', supervisor)).status === 403);
  const reversalBody = { inmateId: inmate.body.id, destinationCellId: cell.body.id, reason: 'Liberdade lançada por engano' };
  check('3', 'SUPERVISOR cannot reverse a situation (403)', (await call('POST', '/movements/final/reversal', supervisor, reversalBody)).status === 403);
  const reversal = await call('POST', '/movements/final/reversal', warden, reversalBody);
  check('3', 'WARDEN reverts the release (201)', reversal.status === 201, `status ${reversal.status} ${reversal.raw.slice(0, 120)}`);
  check('3', 'inmate is ACTIVE again after the reversal', (await call('GET', `/inmates/${inmate.body.id}`, warden)).body?.status === 'ACTIVE');
  const afterReversal = await call('GET', `/movements?inmateId=${inmate.body.id}`, warden);
  const movementIds = (afterReversal.body?.data ?? []).map((m) => m.id);
  check('3', 'the original release stays in the history next to the reversal', movementIds.includes(release.body.id) && movementIds.includes(reversal.body?.id));
  const listedAfter = await call('GET', `/movements/definitive-situations?name=${nameFilter}`, warden);
  check('3', 'the reverted inmate leaves the definitive situations list', !(listedAfter.body?.data ?? []).some((row) => row.inmateId === inmate.body.id), `status ${listedAfter.status}`);
  check('3', 'reversing an inmate that is already ACTIVE is rejected (409)', (await call('POST', '/movements/final/reversal', warden, reversalBody)).status === 409);

  // Scenario 4 - routines (US4)
  const routine = await call('POST', '/routines', warden, { galleryId: gallery.body.id, name: 'Pátio', type: 'DAILY', schedules: [{ time: '10:00' }] });
  check('4', 'WARDEN creates a routine (201)', routine.status === 201, `status ${routine.status}`);
  const disabled = await call('PATCH', `/routines/${routine.body.id}/activation`, supervisor, { date: today, active: false });
  check('4', 'SUPERVISOR disables it for a date (200)', disabled.status === 200, `status ${disabled.status}`);
  const listedToday = await call('GET', `/routines?galleryId=${gallery.body.id}&date=${today}`, supervisor);
  check('4', 'routine is absent on the disabled date', !(listedToday.body?.data ?? []).some((r) => r.id === routine.body.id));
  const otherDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const listedOther = await call('GET', `/routines?galleryId=${gallery.body.id}&date=${otherDay}`, supervisor);
  check('4', 'routine is listed on other days', (listedOther.body?.data ?? []).some((r) => r.id === routine.body.id));
  check('4', 'SUPERVISOR cannot create routines (403)', (await call('POST', '/routines', supervisor, { galleryId: gallery.body.id, name: 'X', type: 'DAILY', schedules: [{ time: '11:00' }] })).status === 403);

  const overlapBody = { galleryId: gallery.body.id, name: 'Faxina', type: 'DAILY', schedules: [{ time: '10:00' }] };
  const overlapWarning = await call('POST', '/routines', warden, overlapBody);
  check('4', 'a routine at the same time in the same gallery is warned (409 ROUTINE_SCHEDULE_OVERLAP)', overlapWarning.status === 409 && overlapWarning.body?.details?.code === 'ROUTINE_SCHEDULE_OVERLAP', `status ${overlapWarning.status}`);
  const overlapConfirmed = await call('POST', '/routines', warden, { ...overlapBody, confirmOverlap: true });
  check('4', 'confirming the overlap saves the routine anyway (201)', overlapConfirmed.status === 201, `status ${overlapConfirmed.status}`);

  // Scenario 5 - staff (US5)
  const post = await call('POST', '/posts', warden, { unitId: UNIT_ID, name: `Posto QS ${suffix}` });
  check('5', 'WARDEN creates a service post (201)', post.status === 201, `status ${post.status}`);
  check('5', 'SUPERVISOR cannot create posts (403)', (await call('POST', '/posts', supervisor, { unitId: UNIT_ID, name: `Nope ${suffix}` })).status === 403);
  const minimum = await call('PATCH', '/staff/minimum-staffing-config', warden, { postId: post.body.id, shift: 'DAY', minimumHeadcount: 2 });
  check('5', 'WARDEN sets the minimum headcount (200)', minimum.status === 200, `status ${minimum.status}`);
  const roster = await call('GET', `/users?role=PRISON_OFFICER&unitId=${UNIT_ID}`, supervisor);
  const officerUser = (roster.body?.data ?? [])[0];
  check('5', 'roster of officers is available', Boolean(officerUser));
  const scheduleDate = '2031-03-15';
  const schedule = await call('POST', '/schedules', supervisor, { userId: officerUser.id, unitId: UNIT_ID, date: scheduleDate, workloadHours: 12, assignments: [{ shift: 'DAY', postId: post.body.id }] });
  check('5', 'SUPERVISOR schedules the officer (201)', schedule.status === 201, `status ${schedule.status} ${schedule.raw.slice(0, 120)}`);
  const staffing = await call('GET', `/schedules/minimum-staffing?unitId=${UNIT_ID}&date=${scheduleDate}&shift=DAY`, supervisor);
  const row = (staffing.body?.posts ?? []).find((p) => p.postId === post.body.id);
  check('5', 'post shows staffed=1 and belowMinimum=true', row && row.staffed === 1 && row.belowMinimum === true, JSON.stringify(row));
  const scheduleId = schedule.body?.data?.[0]?.id;
  const absent = await call('PATCH', `/schedules/${scheduleId}/attendance`, supervisor, { attendanceStatus: 'ABSENT', absenceReason: 'Quickstart' });
  check('5', 'attendance ABSENT registered (200)', absent.status === 200, `status ${absent.status}`);
  const afterAbsence = await call('GET', `/schedules/minimum-staffing?unitId=${UNIT_ID}&date=${scheduleDate}&shift=DAY`, supervisor);
  const rowAfter = (afterAbsence.body?.posts ?? []).find((p) => p.postId === post.body.id);
  check('5', 'absent officer leaves staffed and enters absent', rowAfter && rowAfter.staffed === 0 && rowAfter.absent === 1, JSON.stringify(rowAfter));

  // Scenario 6 - reports and audit (US6)
  const report = await call('GET', `/reports/movements-by-inmate/${inmate.body.id}?days=30`, supervisor);
  check('6', 'movements-by-inmate lists the scenario 2 movement', (report.body?.data ?? []).some((m) => m.movementId === exit.body.id), `status ${report.status}`);
  const auditInsert = await call('GET', `/audit?table=movements&recordId=${exit.body.id}`, supervisor);
  check('6', 'audit has an INSERT for the movement with the responsible user', (auditInsert.body?.data ?? []).some((a) => a.action === 'INSERT' && a.userName), `status ${auditInsert.status}`);
  const auditUser = await call('GET', `/audit?table=users&recordId=${created.body.id}`, supervisor);
  check('6', 'audit of users has entries and never shows a real hash (redacted)', auditUser.status === 200 && (auditUser.body?.data ?? []).length > 0 && !/\$argon2|"passwordHash":"(?!\[REDACTED\])/.test(auditUser.raw), auditUser.raw.slice(0, 160));
  const inconsistencies = await call('GET', '/reports/inconsistencies?limit=100', supervisor);
  check('6', 'routine disabled for today is listed as not executed (FR-025)', (inconsistencies.body?.routinesNotExecuted ?? []).some((r) => r.routineId === routine.body.id && r.date === today), `status ${inconsistencies.status}`);
  check('6', 'PRISON_OFFICER cannot read the audit (403)', (await call('GET', '/audit', officer)).status === 403);
  check('6', 'PRISON_OFFICER cannot read reports (403)', (await call('GET', '/reports/inconsistencies', officer)).status === 403);

  // Acceptance criteria
  check('acceptance', 'no request answered 5xx (negative attempts return 403/4xx, never 500)', serverErrors === 0, `${serverErrors} responses >= 500`);
  console.log('MANUAL  [7] offline sync of the mobile app needs the emulator on Windows (see quickstart.md scenario 7)');
  console.log('SEPARATE [8] load test: test/load/shift-change.js (k6)');

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
