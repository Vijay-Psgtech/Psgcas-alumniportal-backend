# PSG CAS Alumni Portal – Backend

This repository contains the **Express/MongoDB backend** for the PSG CAS Alumni Portal application.  
It exposes RESTful APIs for authentication, alumni data, donations and admin dashboards.

## 📁 Project Structure

\`\`\`
config/
controllers/
middleware/
models/
routes/
Server.js
setupAdmin.js
package.json
\`\`\`


## 🚀 Getting Started

### Prerequisites

- Node.js v16+  
- MongoDB (local or Atlas)  
- npm (comes with Node)

## 🛠 Core Features

- **Admin authentication & management**  
- **Alumni CRUD operations**  
- **Donation tracking**  
- **Protected routes with JWT**
- **Paid alumni membership registration** with Easebuzz confirmation, receipt numbers, and email receipts
- **Admin alumni CSV export/import** and managed homepage/leadership profiles

## Membership payments and receipts

Configure these values in the backend environment (never commit credentials):

- `ALUMNI_MEMBERSHIP_FEE=600` — amount in INR; the server controls the charged amount.
- `EASEBUZZ_KEY` and `EASEBUZZ_SALT` — Easebuzz merchant credentials.
- `EASEBUZZ_ENV=test` or `prod` — selects the gateway environment.
- `API_PUBLIC_URL` — public HTTPS URL of this backend for Easebuzz callbacks.
- `FRONTEND_URL` — public URL of the frontend for the payment return.
- `JWT_SECRET` — required to encrypt staged registration data before payment confirmation.
- `EMAIL_USER` and `EMAIL_PASS` — receipt sender credentials.
- `ADMIN_EMAIL` — required administrator receipt destination.

The registration route stages the profile encrypted for up to two hours. An Easebuzz
callback must have a valid signature and the expected amount/email before a member
profile is saved. Failed/cancelled checkouts are removed, and expired staged uploads
are cleaned up periodically. Only paid profiles can be approved or returned in public
alumni listings. Receipt delivery failures are logged and can be retried from admin
alumni management. In production, set `EASEBUZZ_ENV=prod`; the backend rejects test
gateway payments as completed memberships. Checkout is disabled until both receipt
email recipients and sender credentials are configured.

## Alumni data management

The admin alumni management page exports paid members as UTF-8 CSV and accepts
imports using that same column order:

`Transaction ID/Reference`, `Receipt Number`, `Transaction Date and Time`,
`Alumni Name`, `Batch Details`, `Department/Subject`, `Email Address`,
`Contact Number`, `Complete Postal Address`, `Current Designation`,
`Organization/Institution/Company`, `Professional Location`.

Import rows require a name, batch, department, email, contact number, and postal
address. Historical payment references, receipts, and dates may be blank. CSV
imports are restricted to super-admins. Imported legacy payments are marked
`imported-admin-attested` (not gateway-verified) and remain subject to admin
approval; re-imports do not overwrite Easebuzz-verified payment records.

Legacy alumni exports are also supported: `Year of Joining` with `Year of
Graduation`, `Course/Degree`, `E-mail`, `Phone`, and either `Permanent Residence`
or `Current Residence` are recognized. `Current City` and `Current Country` are
imported as address details.

## Admin self-service

The admin dashboard includes paid-member editing, approvals, duplicate review,
CSV import/export, receipt resend, homepage notable-alumni and leadership profile
management, and current-password changes. Admins can also reset a forgotten
password with a one-time email code. Codes are stored hashed, expire after ten
minutes, and are limited to five verification attempts. Configure `EMAIL_USER` and
`EMAIL_PASS` for reset-code delivery.

## 📦 Models

- **Admin** – admin users  
- **Alumni** – alumni records  
- **Donation** – donation entries

## Validation

Run `npm test` to execute the backend utility regression tests.

Department-admin alumni access is restricted to the department on the admin's
signed-in account; admins should sign in again after this authorization change so
their session token includes that department. Payment lookup, payout, and refund
operations require an authenticated super-admin account.