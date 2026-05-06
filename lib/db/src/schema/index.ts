// Schema barrel.
//
// SQLite is the default surface (local-first IronLog runtime). Postgres
// schemas are exposed via the `postgres` namespace from the package root
// (`@workspace/db`) when callers explicitly opt-in.
export * from "./sqlite";
