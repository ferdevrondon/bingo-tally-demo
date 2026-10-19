// Set in next.config.ts at build time.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local"
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? ""
