/**
 * @typedef {'income'|'expense'} BudgetLineType
 *
 * @typedef {{ budget_line_id: string, name: string, type: BudgetLineType, planned_amount: number }} BudgetLine
 *
 * @typedef {{
 *   version: number,
 *   loaded_at: string,
 *   lines: Readonly<Record<string, BudgetLine>>,
 *   total_income: number,
 *   total_expense_planned: number
 * }} Budget
 *
 * @typedef {'submitted'|'rejected_no_line'|'deferred_no_income'|'under_review'|'ranked'} AppStatus
 *
 * @typedef {{
 *   id: string,
 *   applicant: string,
 *   budget_line_id: string,
 *   purpose: string,
 *   expense_amount: number,
 *   expected_income: number,
 *   comment?: string,
 *   submitted_at: string,
 *   status: AppStatus,
 *   margin: number|null|undefined,
 *   rank?: number,
 *   rejection_code?: string,
 *   rejection_reason?: string,
 *   status_history: Array<{ status: AppStatus, at: string, reason?: string }>
 * }} Application
 */

module.exports = {};
