# Architectural Decisions & Technical Notes

## ADR 001: WebAssembly Rollup for Windows Portability
- **Date**: Phase 1 Foundation
- **Context**: In environments with Windows Application Control / AppLocker policies, loading `.node` native binary libraries from non-system directories (specifically `@rollup/rollup-win32-x64-msvc`) fails with `ERR_DLOPEN_FAILED`.
- **Decision**: Added `"overrides": { "rollup": "npm:@rollup/wasm-node" }` to `package.json`. The official `@rollup/wasm-node` is a 100% feature-compatible WebAssembly build maintained by the Rollup core team that executes in standard V8 without native C++ binary execution blocks.

## ADR 002: Next.js WebAssembly SWC Fallback
- **Date**: Phase 1 Foundation
- **Context**: On Windows environments enforcing Application Control / AppLocker, loading `@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` fails with `ERR_DLOPEN_FAILED`.
- **Decision**: Installed official `@next/swc-wasm-nodejs` (v14.2.20) as documented in Next.js official documentation for environments where native binaries are restricted. This allows Next.js compilation via WebAssembly.
