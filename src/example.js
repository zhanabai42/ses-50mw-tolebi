'use strict';

const { loadBudget, Ledger, createApplication, processApplication, rank } = require('./index');

// 1. Load budget
const budget = loadBudget(`budget_line_id,name,type,planned_amount
INC-001,Выручка от продаж,income,5000000
INC-002,Прочие поступления,income,500000
EXP-010,Маркетинг,expense,1200000
EXP-011,ИТ-инфраструктура,expense,800000`);

console.log('Budget loaded:', {
  version: budget.version,
  total_income: budget.total_income,
  total_expense_planned: budget.total_expense_planned,
});

// 2. Create a shared ledger for this budget cycle
const ledger = new Ledger(budget.total_income);

// 3. Submit and process applications
const apps = [];

// Will be under_review — margin 40%
const app1 = createApplication({
  applicant: 'Отдел маркетинга',
  budget_line_id: 'EXP-010',
  purpose: 'Реклама в Q3',
  expense_amount: 600000,
  expected_income: 1000000,
});
processApplication(app1, budget, ledger);
apps.push(app1);

// Will be under_review — margin -100% (не окупается)
const app2 = createApplication({
  applicant: 'ИТ-отдел',
  budget_line_id: 'EXP-011',
  purpose: 'Новые серверы',
  expense_amount: 800000,
  expected_income: 400000,
});
processApplication(app2, budget, ledger);
apps.push(app2);

// Will be under_review — non-revenue (margin=null)
const app3 = createApplication({
  applicant: 'АХО',
  budget_line_id: 'EXP-010',
  purpose: 'Канцелярия',
  expense_amount: 50000,
  expected_income: 0,
});
processApplication(app3, budget, ledger);
apps.push(app3);

// Will be rejected — line doesn't exist
const app4 = createApplication({
  applicant: 'Иванов И.И.',
  budget_line_id: 'EXP-999',
  purpose: 'Консультации',
  expense_amount: 100000,
  expected_income: 200000,
});
processApplication(app4, budget, ledger);
apps.push(app4);

// 4. Rank
const ranked = rank(apps);

console.log('\n--- Application statuses ---');
apps.forEach(a => {
  console.log(`${a.id} [${a.status}] margin=${a.margin ?? 'n/a'} rank=${a.rank ?? '-'} | ${a.applicant}`);
  if (a.rejection_reason) console.log(`  Reason: ${a.rejection_reason}`);
});

console.log('\n--- Ranked queue ---');
ranked.forEach(a => {
  console.log(`  #${a.rank} ${a.applicant} — margin ${a.margin !== null ? a.margin.toFixed(1) + '%' : 'non-revenue'}`);
});

console.log('\n--- Ledger ---');
console.log(`  Total income:     ${ledger.totalIncome.toLocaleString()}`);
console.log(`  Reserved:         ${ledger.reserved.toLocaleString()}`);
console.log(`  Available:        ${ledger.availableIncome().toLocaleString()}`);
