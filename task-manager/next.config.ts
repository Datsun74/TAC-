import path from "node:path";

import type { NextConfig } from "next";

const repositoryRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // The task manager is a separate Next.js application in this repository.
  // Its shared task module currently lives one level above, so both builders
  // need the repository root in their allowed module and tracing scope.
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
  },
};

export default nextConfig;
