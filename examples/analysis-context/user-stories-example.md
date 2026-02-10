# User Stories: Acme Logistics Portal

## Package Intake

### US-001: Register package with destination
**As a** counter staff member
**I want to** select a destination country for a new package
**So that** the package is routed to the correct shipping lane

**Acceptance Criteria:**
- [ ] All supported destinations shown as selectable options
- [ ] Selected destination is highlighted
- [ ] Cannot proceed without selecting a destination

### US-002: Enter sender details
**As a** counter staff member
**I want to** enter the sender's contact information
**So that** we can contact them about their shipment

**Test Data:**
| Field | Required | Example |
|-------|----------|---------|
| First name | Yes | Jan |
| Last name | Yes | de Vries |
| Address | Yes | Teststraat 1 |
| City | Yes | Rotterdam |
| Country | No (default) | Nederland |
| Phone | Yes | 0612345678 |
| Email | No | jan@test.nl |

### US-003: Scan paper form
**As a** counter staff member
**I want to** scan a filled-in paper form instead of typing
**So that** I can process packages faster during rush hours

**Acceptance Criteria:**
- [ ] Upload accepts JPG, PNG, PDF
- [ ] Extracted data pre-fills the form
- [ ] Staff can correct extraction errors before submitting

## Shipment Tracking

### US-010: Filter shipments by destination
**As a** warehouse staff member
**I want to** filter the shipments list by destination
**So that** I can see which packages need to go on which pallet

### US-011: Filter shipments by status
**As a** manager
**I want to** filter shipments by status
**So that** I can see what needs attention

**Statuses:** pending, processed, shipped, delivered

## Invoicing

### US-020: Generate invoice PDF
**As a** manager
**I want to** download an invoice as PDF
**So that** I can send it to the customer or print it

**Acceptance Criteria:**
- [ ] PDF includes company logo and details
- [ ] PDF includes customer name and address
- [ ] PDF includes package reference and destination
- [ ] PDF includes itemized costs and total
- [ ] PDF includes payment instructions
