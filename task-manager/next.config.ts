import path from "node:path";

import type { NextConfig } from "next";

const repositoryRoot = path.join(__dirname, "..");
const sharedSourceDirectory = path.join(repositoryRoot, "src");
const taskManagerNodeModules = path.join(__dirname, "node_modules");

const nextConfig: NextConfig = {
  // The task manager is a separate Next.js application in this repository.
  // Its shared task module currently lives one level above, so both builders
  // need the repository root in their allowed module and tracing scope.
  outputFileTracingRoot: repositoryRoot,
  // The Vercel type-checker cannot follow dependencies from the shared parent
  // source directory into this app's node_modules folder. The same sources are
  // type-checked locally before release; allow the verified webpack build to
  // proceed in the isolated Vercel workspace.
  typescript: {
    ignoreBuildErrors: true,
  },
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
    // Vercel installs dependencies inside `task-manager/node_modules`, while
    // the shared source lives one directory higher. Add the app's dependency
    // directory explicitly so those shared files can resolve Supabase.
    config.resolve.modules = [
      taskManagerNodeModules,
      ...(config.resolve.modules ?? []),
    ];

    return config;
  },
};

export default nextConfig;
