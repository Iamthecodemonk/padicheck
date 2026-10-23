import React from 'react';
import { Link } from 'react-router-dom';
import { PlanPicker } from '../../components/billing/PlanPicker';

export function BusinessBilling() {
  return (
    <div className="pb-10">
      <PlanPicker audience="business" signedIn />
      <p className="mt-6 text-sm text-muted">
        Invoices, receipts and cancellation are in{' '}
        <Link to="/account/billing" className="font-semibold text-brand-dark">
          Subscription & billing
        </Link>
        . Business invoices include your registration number for tax purposes.
      </p>
    </div>);

}