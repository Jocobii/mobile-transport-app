# @transit/contracts

Public API contract (`/api/v1`) shared by server and mobile app.

- Types and constants only. No logic, no runtime dependencies, no imports from `@transit/core`.
- Shapes are designed for what each screen needs, not mirrors of the domain model.
- v1 allows additive, optional changes only. Removing or renaming a field requires `/api/v2`.
- Every endpoint has a request type (params) and a response type, named `<Resource><Action>Response`.
