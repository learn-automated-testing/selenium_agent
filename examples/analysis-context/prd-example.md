# Product Requirements: Acme Logistics Portal

## Overview
Web application for managing international package shipments. Handles the full
lifecycle from customer intake through shipping manifest generation and invoicing.

## User Roles
- **Counter Staff** — registers packages at the desk (primary user)
- **Warehouse Staff** — groups packages onto pallets
- **Manager** — creates manifests, manages invoices

## Core Processes

### 1. Package Intake (Critical)
Counter staff registers a walk-in customer's package.

**Steps:**
1. Select destination country
2. Enter sender details (name, address, city, country, phone, email)
3. Enter receiver details (same fields)
4. Enter package details (weight, dimensions, declared value, contents description)
5. Print receipt for customer

**Acceptance Criteria:**
- All destination countries selectable
- Required fields enforced: name, address, city, phone
- Package gets unique tracking number on creation
- Status set to "pending" after submission

### 2. Palletization (Critical)
Warehouse groups packages by destination onto pallets.

**Steps:**
1. Create pallet for a specific destination
2. Scan/assign packages to the pallet
3. Close pallet when full

**Acceptance Criteria:**
- Only packages with matching destination can be assigned
- Pallet shows total weight and package count
- Package status changes to "processed" when assigned

### 3. Manifest Generation (Critical)
Manager creates shipping manifest for the carrier.

**Steps:**
1. Create manifest with carrier name and departure date
2. Assign pallets to manifest
3. Review manifest details
4. Export as PDF for carrier
5. Finalize manifest

**Acceptance Criteria:**
- PDF contains all package details, sender/receiver per package
- PDF includes carrier name, departure date, total counts
- Manifest number auto-generated
- Package status changes to "shipped" when manifest finalized

### 4. Invoicing (High)
Manager generates and sends invoices to customers.

**Steps:**
1. Invoice auto-generated per package after manifest creation
2. Review invoice details and amount
3. Send invoice to customer (email)
4. Record payment when received

**Acceptance Criteria:**
- Invoice PDF includes company branding, customer details, itemized costs
- Financial dashboard shows totals: total, paid, outstanding
- Status flow: draft → sent → paid

### 5. Customer Management (High)
Maintain customer database for repeat senders.

**Acceptance Criteria:**
- Customers searchable by name, alias, city, phone
- Customer data auto-populates intake forms for returning customers
- Aliases supported (e.g., "J. de Vries" matches "Jan de Vries")

## Non-Functional Requirements
- No authentication required (internal network only)
- Must work on tablets (counter staff uses tablets)
- All data persists across sessions
