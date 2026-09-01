/**
 * Shared by setup-test-db.ts (which seeds this data) and every *.spec.ts
 * file (which asserts against it). Deliberately has NO side effects at
 * import time — unlike setup-test-db.ts, which must only ever run once,
 * explicitly, via the `pretest:integration` npm script.
 */
export const TEST_FIXTURE = {
  unitAId: 1,
  unitBId: 2,
  password: 'Test@12345',
  wardenEmail: 'warden@test.srp.rs.gov.br',
  supervisorEmail: 'supervisor@test.srp.rs.gov.br',
  officerEmail: 'officer@test.srp.rs.gov.br',
  temporaryMovementTypeId: 1,
  permanentMovementTypeId: 2,
  ankleMonitorMovementTypeId: 3,
  transferMovementTypeId: 4,
  cellChangeMovementTypeId: 5,
  cellSwapMovementTypeId: 6,
  galleryChangeMovementTypeId: 7,
  gallerySwapMovementTypeId: 8,
};
