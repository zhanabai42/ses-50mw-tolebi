'use strict';

/**
 * Ledger tracks soft-reserved income across applications.
 * Reservation happens when a request moves to `under_review`.
 */
class Ledger {
  /**
   * @param {number} totalIncome
   */
  constructor(totalIncome) {
    if (!Number.isFinite(totalIncome) || totalIncome < 0) {
      throw new Error('totalIncome must be a non-negative finite number');
    }
    this._totalIncome = totalIncome;
    this._reserved = 0;
  }

  /** @returns {number} */
  availableIncome() {
    return this._totalIncome - this._reserved;
  }

  /**
   * Soft-reserve an amount (called when request moves to under_review).
   * @param {number} amount
   */
  reserve(amount) {
    if (amount <= 0) throw new Error('reserve amount must be positive');
    if (amount > this.availableIncome()) throw new Error('Insufficient available income to reserve');
    this._reserved += amount;
  }

  /**
   * Release a previously reserved amount (e.g. if request is cancelled).
   * @param {number} amount
   */
  release(amount) {
    if (amount <= 0) throw new Error('release amount must be positive');
    this._reserved = Math.max(0, this._reserved - amount);
  }

  /** @returns {number} */
  get totalIncome() { return this._totalIncome; }

  /** @returns {number} */
  get reserved() { return this._reserved; }
}

module.exports = { Ledger };
