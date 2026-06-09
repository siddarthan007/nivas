### General Ledger
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /t/:slug/accounts | finance:read | Chart of accounts tree |
| POST | /t/:slug/accounts | finance:manage | Create account |
| GET | /t/:slug/journal-entries | finance:read | List GL entries |
| POST | /t/:slug/journal-entries | finance:post | Manual journal entry |
| POST | /t/:slug/journal-entries/:id/reverse | finance:post | Reverse entry |
| GET | /t/:slug/trial-balance | finance:read | Trial balance report |
| GET | /t/:slug/folios/:id | finance:read | Guest folio |
| POST | /t/:slug/folios/:id/charges | finance:post | Add folio charge |
| POST | /t/:slug/payments | finance:post | Record payment (gateway or manual) |

### Procurement
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | /t/:slug/vendors | procurement:* | Vendor CRUD |
| GET/POST | /t/:slug/purchase-orders | procurement:* | PO lifecycle |
| PATCH | /t/:slug/purchase-orders/:id/approve | procurement:approve | Approve PO |
| POST | /t/:slug/grn | procurement:receive | Receive goods → WAC + GL post |

### Maintenance
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | /t/:slug/assets | maintenance:* | Asset CRUD |
| GET/POST | /t/:slug/maintenance | maintenance:* | Ticket CRUD |
| PATCH | /t/:slug/maintenance/:id | maintenance:update | Update status → room status auto |

### HR
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | /t/:slug/shifts | hr:* | Schedule shifts |
| POST | /t/:slug/attendance/clock-in | hr:self | Clock in |
| POST | /t/:slug/attendance/clock-out | hr:self | Clock out |
| GET | /t/:slug/payroll | hr:read | List payroll summaries |
| POST | /t/:slug/payroll/compute | hr:manage | Compute for period |
| POST | /t/:slug/payroll/:id/approve | hr:manage | Approve + post GL |

### Sync (Flutter offline support)
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /t/:slug/sync/pull | sync:pull | Pull changes since checkpoint per table |
| POST | /t/:slug/sync/push | sync:push | Push batched mutations with idempotency |
| GET | /t/:slug/sync/status | authenticated | Current checkpoint per device/table |


GL Posting Rules (Auto-Journal)
```
Event: room_charge (check-in night)
  DR  Accounts Receivable (guest folio)   100.00
  CR  Room Revenue                         91.74
  CR  VAT Payable (13%)                     8.26 (Nepal VAT)

Event: F&B order served
  DR  Accounts Receivable (guest folio)    50.00
  CR  F&B Revenue                          44.25
  CR  VAT Payable (13%)                     5.75 (Nepal VAT... applicable category only)

Event: manual payment recorded (cash)
  DR  Cash                                150.00
  CR  Accounts Receivable                 150.00

Event: GRN received (purchase)
  DR  Inventory Asset (WAC updated)        80.00
  CR  Accounts Payable                     80.00

Event: payroll approved
  DR  Salary Expense                     5000.00
  CR  Salary Payable                     5000.00
```