# MSPBots React Template

This is a full-stack React template for the MSPBots platform.

It includes:
- Frontend: React + TypeScript + Tailwind CSS + `@mspbots/ui`
- Backend: Deno runtime (`service/`) + REST APIs
- Platform integration: routing, layout, auth redirect, micro-frontend bridge

## Organization npm Publishing Standard

This template is preconfigured for the MSPbotsAI organization npm publishing standard:
- Package scope: `@app/*`
- Registry: `https://npm.pkg.github.com`
- Publishing method: **GitHub Actions only**
- Local manual `npm publish` is not allowed

### Required files
- `.npmrc`
- `.github/workflows/publish-npm.yml`
- `package.json` with `publishConfig.registry = https://npm.pkg.github.com`

### Consumer installation config
```ini
@app:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Release flow
```bash
npm version patch
git push origin main --follow-tags
```

GitHub Actions publishes automatically when a `v*.*.*` tag is pushed.

## Golden Rules (for LLMs)

1. Always follow the target package's README before using its API.
2. Do not invent APIs, props, config fields, or file locations.
3. **All UI must be built with `@mspbots/ui` components.** Do not use raw HTML elements (`<button>`, `<input>`, `<select>`, `<table>`, `<dialog>`, etc.) when an equivalent exists in `@mspbots/ui`.
4. **Build complex UI by composing existing components.**
5. Frontend API calls must use `$fetch` / `@mspbots/fetch`.
6. Never log or expose the token string.
7. Route/menu permissions should be implemented with page `meta` first, then with element-level gating.
8. All scrollable areas must use `ScrollArea` from `@mspbots/ui`.
9. Icons must come from `lucide-react`.
10. Use `cn()` from `@mspbots/ui` for conditional class merging.

## Quick Start

Install dependencies:
- `pnpm install`

Development:
- `pnpm dev`
- `pnpm build`

Backend:
- Add API routes in `service/server.ts`
- Add backend dependencies with Deno: `cd service && deno add npm:<package>`

## License

MIT

workflow non-SOP trigger test: 2026-03-23T07:51:06Z
