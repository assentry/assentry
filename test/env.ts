// Runs before every test file, before the app is imported. Values already in
// the environment win, so CI can point at its own database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://assentry:assentry@localhost:55432/assentry_test";
process.env.JWT_SECRET ??= "test-secret-for-automated-tests-only-0123456789";
process.env.PUBLIC_BASE_URL = "http://assentry.test";
delete process.env.FILE_STORAGE_DIR;
delete process.env.S3_BUCKET;
