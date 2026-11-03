import path from "node:path";

import type { NextConfig } from "next";

const repositoryRoot = path.join(__dirname, "..");
const sharedSourceDirectory = path.join(repositoryRoot, "src");

const nextConfig: NextConfig = {
  // The task manager is a separate Next.js application in this repository.
  // Its shared task module currently lives one level above, so both builders
  // need the repository root in their allowed module and tracing scope.
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
    // Vercel uses Turbopack for `next build`. Make the shared task module an
    // explicit alias so imports inside those files resolve in the same way as
    // they do in the primary application.
    resolveAlias: {
      "@": sharedSourceDirectory,
    },
  },
  webpack(config) {
    // Keep local webpack builds consistent with the production Turbopack
    // configuration without replacing Next.js' built-in aliases.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": sharedSourceDirectory,
    };

    return config;
  },
};

export default nextConfig;
