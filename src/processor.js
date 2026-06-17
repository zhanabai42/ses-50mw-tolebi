'use strict';

const { findExpenseLine } = require('./budget');

const STATUS = Object.freeze({
  SUBMITTED:          'submitted',
  REJECTED_NO_LINE:   'rejected_no_line',
  DEFERRED_NO_INCOME: 'deferred_no_income',
  UNDER_REVIEW:       'under_review',
  RANKED:             'ranked',
});

const REJECTION = Object.freeze({
  NO_LINE:    { code: 'NO_LINE',    reason: 'Строка расхода отсутствует в утверждённом бюджете' },
  NO_INCOME:  { code: 'NO_INCOME',  reason: 'Доступного дохода недостаточно для финансирования расхода' },
});

let _idCounter = 0;

/**
 * Create a new application in `submitted` status.
 *
 * @param {{
 *   applicant: string,
 *   budget_line_id: string,
 *   purpose: string,
 *   expense_amount: number,
 *   expected_income: number,
 *   comment?: string
 * }} fields
 * @returns {import('./types').Application}
 */
function createApplication(fields) {
  const { applicant, budget_line_id, purpose, expense_amount, expected_income, comment } = fields;

  if (!applicant)       throw new Error('applicant is required');
  if (!budget_line_id)  throw new Error('budget_line_id is required');
  if (!purpose)         throw new Error('purpose is required');
  if (!Number.isFinite(expense_amount) || expense_amount <= 0)
    throw new Error('expense_amount must be a positive number');
  if (!Number.isFinite(expected_income) || expected_income < 0)
    throw new Error('expected_income must be a non-negative number');

  const now = new Date().toISOString();
  const app = {
    id: `APP-${String(++_idCounter).padStart(5, '0')}`,
    applicant,
    budget_line_id,
    purpose,
    expense_amount,
    expected_income,
    comment: comment || '',
    submitted_at: now,
    status: STATUS.SUBMITTED,
    margin: undefined,
    status_history: [{ status: STATUS.SUBMITTED, at: now }],
  };
  return app;
}

/**
 * Process a single application through the budget workflow (steps 2–5).
 * Mutates `app` in place and updates `ledger` on reservation.
 *
 * @param {import('./types').Application} app
 * @param {import('./types').Budget} budget
 * @param {import('./ledger').Ledger} ledger
 * @returns {import('./types').Application}
 */
function processApplication(app, budget, ledger) {
  const now = new Date().toISOString();

  function transition(status, extra = {}) {
    app.status = status;
    app.status_history.push({ status, at: now, ...extra });
  }

  // Step 2 — budget line existence check
  const line = findExpenseLine(budget, app.budget_line_id);
  if (!line) {
    app.rejection_code   = REJECTION.NO_LINE.code;
    app.rejection_reason = REJECTION.NO_LINE.reason;
    transition(STATUS.REJECTED_NO_LINE, { reason: REJECTION.NO_LINE.reason });
    return app;
  }

  // Steps 3–4 — available income check
  const available = ledger.availableIncome();
  if (available < app.expense_amount) {
    app.rejection_code   = REJECTION.NO_INCOME.code;
    app.rejection_reason = REJECTION.NO_INCOME.reason;
    transition(STATUS.DEFERRED_NO_INCOME, { reason: REJECTION.NO_INCOME.reason });
    return app;
  }

  // Soft reserve + move to under_review
  ledger.reserve(app.expense_amount);
  transition(STATUS.UNDER_REVIEW);

  // Step 5 — margin calculation
  if (app.expected_income === 0) {
    app.margin = null; // non-revenue expense
  } else {
    app.margin = ((app.expected_income - app.expense_amount) / app.expected_income) * 100;
  }

  return app;
}

/**
 * Rank all `under_review` applications by gross margin descending.
 * Revenue applications (margin !== null) come before non-revenue (margin === null).
 * Tie-break: earlier submitted_at wins.
 *
 * Assigns `status = 'ranked'` and `rank` (1-based) to each.
 *
 * @param {import('./types').Application[]} applications
 * @returns {import('./types').Application[]}
 */
function rank(applications) {
  const review = applications.filter(a => a.status === STATUS.UNDER_REVIEW);
  const now = new Date().toISOString();

  review.sort((a, b) => {
    const aHasMargin = a.margin !== null && a.margin !== undefined;
    const bHasMargin = b.margin !== null && b.margin !== undefined;

    if (aHasMargin !== bHasMargin) return aHasMargin ? -1 : 1; // revenue first
    if (aHasMargin && bHasMargin && a.margin !== b.margin) return b.margin - a.margin; // higher margin first
    return a.submitted_at < b.submitted_at ? -1 : 1; // earlier submission first
  });

  review.forEach((app, i) => {
    app.rank = i + 1;
    app.status = STATUS.RANKED;
    app.status_history.push({ status: STATUS.RANKED, at: now, reason: `Rank ${i + 1}` });
  });

  return review;
}

module.exports = { createApplication, processApplication, rank, STATUS, REJECTION };
