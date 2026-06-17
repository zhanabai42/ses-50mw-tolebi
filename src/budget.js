'use strict';

const VALID_TYPES = new Set(['income', 'expense']);
let _currentBudget = null;
let _version = 0;

/**
 * Parse CSV text into raw row objects.
 * Expected header: budget_line_id, name, type, planned_amount
 * @param {string} csv
 * @returns {Array<{budget_line_id:string,name:string,type:string,planned_amount:string}>}
 */
function parseCSV(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });
}

/**
 * Load budget from CSV string or pre-parsed array of row objects.
 * Validates, freezes, and stores as the active version.
 *
 * @param {string|Array<object>} source
 * @returns {import('./types').Budget}
 */
function loadBudget(source) {
  const rows = typeof source === 'string' ? parseCSV(source) : source;

  const lines = {};
  const errors = [];

  rows.forEach((row, i) => {
    const { budget_line_id, name, type, planned_amount } = row;
    if (!budget_line_id) { errors.push(`Row ${i + 1}: missing budget_line_id`); return; }
    if (!name)            { errors.push(`Row ${i + 1}: missing name`); return; }
    if (!VALID_TYPES.has(type)) { errors.push(`Row ${i + 1}: invalid type "${type}"`); return; }
    const amount = Number(planned_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`Row ${i + 1}: planned_amount must be a non-negative number`);
      return;
    }
    if (lines[budget_line_id]) {
      errors.push(`Duplicate budget_line_id "${budget_line_id}"`);
      return;
    }
    lines[budget_line_id] = Object.freeze({ budget_line_id, name, type, planned_amount: amount });
  });

  if (errors.length) throw new Error('Budget validation failed:\n' + errors.join('\n'));

  const allLines = Object.values(lines);
  const total_income = allLines
    .filter(l => l.type === 'income')
    .reduce((sum, l) => sum + l.planned_amount, 0);
  const total_expense_planned = allLines
    .filter(l => l.type === 'expense')
    .reduce((sum, l) => sum + l.planned_amount, 0);

  const budget = Object.freeze({
    version: ++_version,
    loaded_at: new Date().toISOString(),
    lines: Object.freeze(lines),
    total_income,
    total_expense_planned,
  });

  _currentBudget = budget;
  return budget;
}

/**
 * Returns the currently active budget, or null if none loaded.
 * @returns {import('./types').Budget|null}
 */
function getActiveBudget() {
  return _currentBudget;
}

/**
 * Find an expense line by id. Returns null if not found or not an expense line.
 * @param {import('./types').Budget} budget
 * @param {string} id
 * @returns {import('./types').BudgetLine|null}
 */
function findExpenseLine(budget, id) {
  const line = budget.lines[id];
  return line && line.type === 'expense' ? line : null;
}

module.exports = { loadBudget, getActiveBudget, findExpenseLine };
