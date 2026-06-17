'use strict';

// Minimal test runner — no dependencies required.
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  try { fn(); throw new Error('NO_THROW'); }
  catch (e) { if (e.message === 'NO_THROW') throw new Error(message || 'Expected function to throw'); }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message}`);
    failed++;
    failures.push({ name, error: e.message });
  }
}

function describe(suite, fn) {
  console.log(`\n${suite}`);
  fn();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const { loadBudget, findExpenseLine } = require('./budget');
const { Ledger } = require('./ledger');
const { createApplication, processApplication, rank, STATUS } = require('./processor');

const SAMPLE_CSV = `budget_line_id,name,type,planned_amount
INC-001,Выручка от продаж,income,5000000
INC-002,Прочие поступления,income,500000
EXP-010,Маркетинг,expense,1200000
EXP-011,ИТ-инфраструктура,expense,800000`;

function makeBudget(csv) { return loadBudget(csv || SAMPLE_CSV); }
function makeLedger(budget) { return new Ledger(budget.total_income); }

function makeApp(overrides) {
  return createApplication({
    applicant: 'Test User',
    budget_line_id: 'EXP-010',
    purpose: 'Test purpose',
    expense_amount: 100000,
    expected_income: 200000,
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('loadBudget', () => {
  test('parses CSV correctly', () => {
    const b = makeBudget();
    assertEqual(b.total_income, 5500000, 'total_income');
    assertEqual(b.total_expense_planned, 2000000, 'total_expense_planned');
    assert(b.lines['EXP-010'], 'EXP-010 exists');
    assertEqual(b.lines['EXP-010'].type, 'expense', 'type');
  });

  test('increments version on each load', () => {
    const b1 = makeBudget();
    const b2 = makeBudget();
    assert(b2.version > b1.version, 'version increments');
  });

  test('throws on duplicate budget_line_id', () => {
    const dupeCSV = SAMPLE_CSV + '\nEXP-010,Duplicate,expense,500000';
    assertThrows(() => loadBudget(dupeCSV), 'should throw on duplicate');
  });

  test('throws on invalid type', () => {
    const badCSV = `budget_line_id,name,type,planned_amount\nX-001,Bad,assets,1000`;
    assertThrows(() => loadBudget(badCSV), 'should throw on invalid type');
  });

  test('throws on negative planned_amount', () => {
    const badCSV = `budget_line_id,name,type,planned_amount\nX-001,Bad,expense,-100`;
    assertThrows(() => loadBudget(badCSV), 'should throw on negative amount');
  });

  // §8 test case 8 — budget immutability
  test('TC8: frozen budget rejects mutation', () => {
    const b = makeBudget();
    assert(Object.isFrozen(b), 'budget is frozen');
    assert(Object.isFrozen(b.lines), 'lines are frozen');
    let threw = false;
    try { b.total_income = 999; } catch { threw = true; }
    // In strict mode throws; in non-strict silently fails. Either way value must not change.
    assertEqual(b.total_income, 5500000, 'total_income unchanged after mutation attempt');
  });
});

describe('findExpenseLine', () => {
  test('returns null for unknown id', () => {
    const b = makeBudget();
    assertEqual(findExpenseLine(b, 'UNKNOWN'), null, 'unknown line');
  });

  test('returns null for income line', () => {
    const b = makeBudget();
    assertEqual(findExpenseLine(b, 'INC-001'), null, 'income line not returned');
  });

  test('returns expense line', () => {
    const b = makeBudget();
    const line = findExpenseLine(b, 'EXP-010');
    assert(line !== null, 'line found');
    assertEqual(line.type, 'expense', 'type is expense');
  });
});

describe('processApplication — step 2', () => {
  // §8 TC1
  test('TC1: rejected_no_line when budget_line_id not in BDR', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ budget_line_id: 'EXP-999' });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.REJECTED_NO_LINE, 'status');
    assert(app.rejection_code === 'NO_LINE', 'rejection_code');
    assert(app.rejection_reason.length > 0, 'rejection_reason set');
  });

  test('TC1b: income line also triggers rejected_no_line', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ budget_line_id: 'INC-001' });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.REJECTED_NO_LINE, 'income line rejected');
  });
});

describe('processApplication — steps 3–4', () => {
  // §8 TC2
  test('TC2: deferred_no_income when available income = 0', () => {
    const b = makeBudget();
    const l = new Ledger(0); // zero income
    const app = makeApp({ expense_amount: 100000 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.DEFERRED_NO_INCOME, 'status');
    assert(app.rejection_code === 'NO_INCOME', 'rejection_code');
  });

  // §8 TC3
  test('TC3: deferred_no_income when available income < expense_amount', () => {
    const b = makeBudget();
    const l = new Ledger(50000); // less than 100000
    const app = makeApp({ expense_amount: 100000 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.DEFERRED_NO_INCOME, 'status');
  });

  test('soft reserve reduces available income', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const before = l.availableIncome();
    const app = makeApp({ expense_amount: 300000 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.UNDER_REVIEW, 'status');
    assertEqual(l.availableIncome(), before - 300000, 'reserve deducted');
  });

  test('second app deferred when first exhausted income', () => {
    const b = makeBudget();
    const l = new Ledger(100000);
    const app1 = makeApp({ expense_amount: 100000 });
    const app2 = makeApp({ expense_amount: 1 });
    processApplication(app1, b, l);
    processApplication(app2, b, l);
    assertEqual(app1.status, STATUS.UNDER_REVIEW, 'first under_review');
    assertEqual(app2.status, STATUS.DEFERRED_NO_INCOME, 'second deferred');
  });
});

describe('processApplication — step 5 (margin)', () => {
  // §8 TC4
  test('TC4: under_review with positive margin when expected_income > expense', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ expense_amount: 100000, expected_income: 200000 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.UNDER_REVIEW, 'status');
    assertEqual(app.margin, 50, 'margin 50%');
  });

  // §8 TC5
  test('TC5: under_review with negative margin when expected_income < expense', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ expense_amount: 200000, expected_income: 100000 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.UNDER_REVIEW, 'status');
    assert(app.margin < 0, `margin should be negative, got ${app.margin}`);
    assertEqual(app.margin, -100, 'margin -100%');
  });

  // §8 TC6
  test('TC6: under_review with undefined margin when expected_income = 0', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ expense_amount: 100000, expected_income: 0 });
    processApplication(app, b, l);
    assertEqual(app.status, STATUS.UNDER_REVIEW, 'status');
    assertEqual(app.margin, null, 'margin is null for non-revenue');
  });
});

describe('rank', () => {
  function makeReviewApp(margin_params, submitted_offset_ms = 0) {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp(margin_params);
    // override submitted_at for deterministic tie-break
    app.submitted_at = new Date(Date.now() + submitted_offset_ms).toISOString();
    processApplication(app, b, l);
    return app;
  }

  // §8 TC7
  test('TC7: ranks 40% → 20% → -5% descending', () => {
    const b = makeBudget();
    const l = makeLedger(b);

    // margin 40%: expense=600, income=1000
    const a1 = createApplication({ applicant:'A', budget_line_id:'EXP-010', purpose:'p', expense_amount:600000, expected_income:1000000 });
    a1.submitted_at = new Date(1000).toISOString();
    processApplication(a1, b, l);

    // margin 20%: expense=800, income=1000
    const a2 = createApplication({ applicant:'B', budget_line_id:'EXP-011', purpose:'p', expense_amount:800000, expected_income:1000000 });
    a2.submitted_at = new Date(2000).toISOString();
    processApplication(a2, b, l);

    // need fresh budget+ledger for a3 since income may be exhausted
    const b2 = makeBudget();
    const l2 = makeLedger(b2);
    // margin -5%: expense=1050, income=1000
    const a3 = createApplication({ applicant:'C', budget_line_id:'EXP-010', purpose:'p', expense_amount:1050000, expected_income:1000000 });
    a3.submitted_at = new Date(3000).toISOString();
    processApplication(a3, b2, l2);

    const ranked = rank([a1, a2, a3]);
    assertEqual(ranked[0].applicant, 'A', 'rank 1 should be A (40%)');
    assertEqual(ranked[1].applicant, 'B', 'rank 2 should be B (20%)');
    assertEqual(ranked[2].applicant, 'C', 'rank 3 should be C (-5%)');
    assertEqual(ranked[0].rank, 1, 'rank number');
    assertEqual(ranked[1].rank, 2, 'rank number');
    assertEqual(ranked[2].rank, 3, 'rank number');
  });

  test('non-revenue (margin=null) ranked after revenue apps', () => {
    const b = makeBudget();
    const l = makeLedger(b);

    const revenue = createApplication({ applicant:'Rev', budget_line_id:'EXP-010', purpose:'p', expense_amount:100000, expected_income:200000 });
    processApplication(revenue, b, l);

    const nonRevenue = createApplication({ applicant:'NoRev', budget_line_id:'EXP-011', purpose:'p', expense_amount:100000, expected_income:0 });
    processApplication(nonRevenue, b, l);

    const ranked = rank([nonRevenue, revenue]); // intentionally reversed input order
    assertEqual(ranked[0].applicant, 'Rev', 'revenue first');
    assertEqual(ranked[1].applicant, 'NoRev', 'non-revenue last');
  });

  test('tie-break by submission time (earlier wins)', () => {
    const b = makeBudget();
    const l = makeLedger(b);

    const early = createApplication({ applicant:'Early', budget_line_id:'EXP-010', purpose:'p', expense_amount:100000, expected_income:200000 });
    early.submitted_at = new Date(1000).toISOString();
    processApplication(early, b, l);

    const late = createApplication({ applicant:'Late', budget_line_id:'EXP-011', purpose:'p', expense_amount:100000, expected_income:200000 });
    late.submitted_at = new Date(9000).toISOString();
    processApplication(late, b, l);

    const ranked = rank([late, early]);
    assertEqual(ranked[0].applicant, 'Early', 'earlier submission wins tie');
  });

  test('only under_review apps are ranked', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const rejected = makeApp({ budget_line_id: 'EXP-999' });
    processApplication(rejected, b, l);
    const ok = makeApp({ expense_amount: 100000, expected_income: 200000 });
    processApplication(ok, b, l);
    const ranked = rank([rejected, ok]);
    assertEqual(ranked.length, 1, 'only 1 ranked');
    assertEqual(ranked[0].applicant, 'Test User', 'correct app ranked');
  });
});

describe('status_history journal', () => {
  test('records all status transitions', () => {
    const b = makeBudget();
    const l = makeLedger(b);
    const app = makeApp({ expense_amount: 100000, expected_income: 200000 });
    processApplication(app, b, l);
    rank([app]);
    const statuses = app.status_history.map(h => h.status);
    assert(statuses.includes('submitted'), 'submitted logged');
    assert(statuses.includes('under_review'), 'under_review logged');
    assert(statuses.includes('ranked'), 'ranked logged');
  });
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  • ${f.name}: ${f.error}`));
  process.exitCode = 1;
}
