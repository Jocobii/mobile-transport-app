# @transit/api-client

Typed HTTP client used by the mobile app.

- Depends only on `@transit/contracts`.
- One method per endpoint; method names mirror the use cases (`getArrivals`, `search`...).
- Maps HTTP failures to `ApiError` with the server's stable error `code`.
- No caching policy, UI concerns or business rules here. `fetch` is injectable for tests.
