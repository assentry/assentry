import { execSync } from "child_process";

// Builds a clean test database from the migrations once per run.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://assentry:assentry@localhost:55432/assentry_test";
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
