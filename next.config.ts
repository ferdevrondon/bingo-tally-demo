import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

import type { NextConfig } from "next"

// What is running: the package version, the commit and when it was built. On
// Vercel the commit comes from its system variable; locally from git. They are
// inlined at build time and shown in the sidebar (components/app-version.tsx).
function commitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel.slice(0, 7)
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return "local"
  }
}

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

export default nextConfig
