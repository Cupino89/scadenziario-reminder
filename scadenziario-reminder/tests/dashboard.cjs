const assert = require('node:assert/strict');
const { romeToday, dayDifference, matchesDeadline, upcoming, recent, isPaymentProof } = require(process.argv[2]);
assert.equal(romeToday(new Date('2026-09-29T22:30:00Z')), '2026-09-30');
assert.equal(dayDifference('2026-10-26', '2026-10-24'), 2); // DST boundary
assert.equal(upcoming('2025-01-01', '2026-09-30', '7'), true);
assert.equal(upcoming('2026-10-08', '2026-09-30', '7'), false);
assert.equal(recent('2026-09-01', '2026-09-30', '30'), true);
assert.equal(recent('2026-08-31', '2026-09-30', '30'), false);
assert.equal(recent('2026-10-01', '2026-09-30', 'all'), false);
assert.equal(recent('2025-12-31', '2026-01-01', '7'), true);
const d = {title:'IMU',category:'Casa',entity_id:'home',entities:{name:'Firenze'}};
assert.equal(matchesDeadline(d,' firenze ','Casa','home'), true);
assert.equal(matchesDeadline(d,'','Casa','other'), false);
assert.equal(matchesDeadline(d,'','','unassigned'), false);
assert.equal(matchesDeadline({...d,entity_id:null},'','','unassigned'), true);
assert.equal(isPaymentProof('invoice'), false);
for (const type of ['receipt','discharge','f24']) assert.equal(isPaymentProof(type),true);
console.log('PASS: Rome date, DST, periods, overdue inclusion, search/entity filters, receipt types');
