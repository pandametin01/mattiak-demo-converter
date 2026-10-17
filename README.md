# Mattiak — Match to Practice

CS2 demo link → choose a player → download a personal-training package.

**Website:** deploys to Cloudflare Workers with Static Assets, without a separate Python server.
Cloudflare streams an allowlisted Valve replay download. A browser Web Worker decompresses
and analyzes it, then creates the ZIP locally. A local `.dem` / `.dem.bz2` file is also supported
and is never uploaded. No Steam sign-in, account, database, or end-user application installation.

**Game integration is experimental.** The exported CFG requires the generic `personal_loader`
in the separate `mattiak_personal` addon. The current published Workshop map does **not** support
these files yet. Deploying this website does not complete the Workshop integration.

## Connect GitHub to Cloudflare

Use **Workers & Pages → Create application → Import a repository** and select this repository.
The default configuration now supports the **Worker** setup screen and its standard
`npx wrangler deploy` command. An existing Worker project can use the settings below.

| Setting | Value |
|---|---|
| Repository | `pandametin01/mattiak-demo-converter` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Worker name | `mattiak-demo-converter` |
| Root directory | repository root / leave empty |
| Environment variable | `NODE_VERSION=22` |

The repository must be visible to your Cloudflare GitHub integration. No application secrets
are required. `wrangler.toml` serves `dist/` as static assets and sends `/api/*` to
`server/index.mjs`. The browser parser and its WASM are static downloads, not server-side code.
The API uses the same streaming download handler as the original Pages adapter.

Wrangler is pinned in the development dependencies so `npx wrangler deploy` does not need
to install an unpinned version during deployment. To validate packaging without deploying:
`npx wrangler deploy --dry-run`.

The previous **Pages** adapter remains available for existing Pages users via the explicit
configuration `wrangler.pages.toml`: after building, run
`npx wrangler pages deploy dist --config wrangler.pages.toml` with an authenticated CLI.
For a Git-connected Pages project, set `wrangler.pages.toml` as the root `wrangler.toml`
on that project's deployment branch and use build command `npm run build`, output `dist`.

## Development

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:8788/`. The local development server binds to loopback only.
For Cloudflare Workers emulation, use `npx wrangler dev --local` after the build.

To run a real demo through the same analysis core in Node (no demo is included in this repo):

```sh
node scripts/check-demo.mjs /path/to/match.dem YOUR_STEAM_ID_64
```

Outputs are written to ignored `output/`. Never commit personal demos, generated training
files, tokens, private player data or large game binaries.

## What is exported

- `mattiak_training.cfg`: bounded, checksummed data import commands.
- `training.json`: scenarios, source hash, exclusions and limitations.
- `READ_ME.txt`: current experimental loading instructions.

The CFG contains only fixed `personal_import_*` commands with numeric/hexadecimal data.
The native runtime validates size, order, checksum, schema, map, positions and timing before
replacing the active plan. Importing a malformed or incomplete file keeps the previous plan.
These files do not contain arbitrary JavaScript and do not change existing aim ratings.

## Analysis scope

Conservative duels from player deaths: recorded starting positions plus sampled opponent
movement from 0.75 seconds before the final damage burst. Smoke, wallbangs, flash, crouch,
airborne, large height changes and missing states are excluded. Runtime geometry and visibility
checks can reject positions from historical map versions.

The practice deadline is authored from observed damage-to-death plus a buffer. It is **not**
the opponent's measured human reaction time. Standard weapon/health, no shooting opponent AI,
and no claim to reproduce the complete round or diagnose every death as a mechanical weakness.

Limits: direct `replayNNN.valve.net/730/*.dem[.bz2]` links only, 512 MB download/unpacked demo,
64 drills per player, 256 KiB data payload, 10-minute browser timeout. A desktop browser is
recommended. Expired links, unsupported demo versions or low-memory devices can fail cleanly.
Match-page URLs and CSGO share codes require a separate resolver and are not supported.

## Runtime source

`experimental/` contains the CS2 runtime and import protocol source. It is not a packaged
Workshop addon. Compile/install it only in the isolated personal-training addon, never in
production automatically. This website does not publish anything to Steam Workshop.

`npm run build:loader` assembles `output/loader/personal_loader.js` and its CFG.
Place the JS in `content/csgo_addons/mattiak_personal/maps/scripts/`, compile it with
the CS2 resource compiler, and place the loader CFG in `game/csgo/cfg/`. This is a
developer setup, not an installation step for future Workshop users.

## Verified locally

- Browser conversion of a real Mirage demo, both `.dem` and `.dem.bz2`.
- Player selection and ZIP download: two eligible practice duels from six deaths.
- CFG import accepted by CS2 Tools on stock Mirage in the isolated addon; first duel positioned.
- 17 automated tests cover import integrity, malformed data, motion validation, the download relay and Worker routing.
- Wrangler 4.151.1 deployment dry-run passes. Local Workers runtime serves HTML, JS, CSS and
  WASM with the expected headers; API validation and unknown routes return JSON status codes.

The live Valve download and deployed Cloudflare environment still need a fresh replay link
and a deployment check. Relay tests currently use simulated upstream responses. The experiment
does not yet verify every supported map or every extracted path in the game.

## Dependencies

- [cs2parser](https://github.com/osztenkurden/cs2parser), MPL-2.0, unmodified npm dependency.
- [wasm-bz2](https://github.com/foxglove/wasm-bz2), MIT.
- [fflate](https://github.com/101arrowz/fflate), MIT.

Dependency license notices are served under `/licenses/`. No third-party analytics or fonts.
