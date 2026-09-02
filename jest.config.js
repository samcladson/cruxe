/** @type {import('ts-jest').JestConfigWithTSJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // Integration suites each sign users in against a shared Supabase project,
  // and parallel workers multiply that into an auth rate limit. Serialising
  // costs a few seconds and removes a whole class of false failure.
  maxWorkers: 1,
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
