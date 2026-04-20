<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## TypeScript type checking

`node_modules` is an empty locked directory (Docker Linux artifact). The macOS packages are in `node_modules_darwin_backup`. Use this command for type checks — do NOT use `npx tsc` (hangs):

```bash
node_modules_darwin_backup/.bin/tsc --noEmit
```

The `graphql` package produces one pre-existing `.d.ts` error unrelated to app code — filter it out with `| grep -v "node_modules_darwin_backup/graphql"`.

