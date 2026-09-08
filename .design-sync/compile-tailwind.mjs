import { readFileSync, writeFileSync } from "node:fs"
import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"

const css = readFileSync("app/globals.css", "utf8")

const result = await postcss([tailwindcss({ base: process.cwd() })]).process(css, {
  from: "app/globals.css",
  to: ".ds-sync/compiled-tailwind.css",
})

writeFileSync(".ds-sync/compiled-tailwind.css", result.css)
console.log(`wrote .ds-sync/compiled-tailwind.css (${(result.css.length / 1024).toFixed(1)} KB)`)
