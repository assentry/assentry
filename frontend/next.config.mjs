import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app now lives in its own directory with its own lockfile, separate
  // from the backend's — pin the trace root so Next.js doesn't guess wrong
  // when multiple lockfiles exist in parent directories.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
