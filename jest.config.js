module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    verbose: true,
    testTimeout: 30000,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true
};
