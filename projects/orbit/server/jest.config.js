/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/__tests__/**/*.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "__tests__/setup\.ts", "__tests__/teardown\.ts", "__tests__/setupAfterEnv\.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  // Global setup/teardown for MongoDB memory server
  globalSetup: "<rootDir>/src/__tests__/setup.ts",
  globalTeardown: "<rootDir>/src/__tests__/teardown.ts",
  setupFiles: ["<rootDir>/src/__tests__/setupAfterEnv.ts"],
  // Timeout for API tests (30 seconds)
  testTimeout: 30000,
  // Verbose output
  verbose: true,
  // Collect coverage
  collectCoverage: false,
  // Detect open handles
  detectOpenHandles: true,
  // Force exit after test suite completes
  forceExit: true,
};
