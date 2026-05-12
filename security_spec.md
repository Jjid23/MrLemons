# Security Specification - Mr Lemon POS

## Data Invariants
1. A user document must match the authenticated user's UID.
2. Only the bootstrap admin email (`jobertyeah23@gmail.com`) can self-assign the 'admin' role. All others must be 'staff'.
3. Inventory can only be modified by admins, except for staff who can deduct stock when placing an order.
4. Orders must have at least one item and a non-negative total.
5. Every order must accurately record the cashier's UID matching the authenticated user.
6. Identity roles (Admin, Staff) are verified against the `users` collection, except for the initial bootstrap admin check.

## The Dirty Dozen (Potential Attack Payloads)
1. **Identity Spoofing**: Attempt to create a user document with a UID that doesn't match `request.auth.uid`.
2. **Privilege Escalation**: A non-admin user attempting to create/update their role to 'admin'.
3. **Ghost Users**: Attempt to create a user document without being signed in.
4. **Shadow Inventory**: Attempt to create an inventory item with negative quantity or excessive name size.
5. **Unauthorized Inventory Update**: A staff member attempting to increase stock or change unit names.
6. **Stock Fabrication**: A staff member attempting to decrease stock without an associated order (relational write).
7. **Phantom Orders**: Creating an order with a `cashierId` that isn't the current user's UID.
8. **Price Manipulation**: Creating an order with a total that doesn't match the sum of items (Relational check, though rules have limits here).
9. **History Deletion**: Attempting to delete an order document as a non-admin.
10. **Inventory Wipe**: Attempting to delete the entire inventory collection.
11. **PII Leak**: An authenticated user attempting to list all user documents (including emails).
12. **ID Poisoning**: Attempting to use a 1MB string as a document ID for an order.

## Test Runner (firestore.rules.test.ts)
A test suite should be implemented using `@firebase/rules-unit-testing` to verify these protections.
