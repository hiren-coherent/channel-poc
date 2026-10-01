# channel-poc

A small copy of platform-ui's **deployment channels**, running on GitHub Pages so you
can try the whole flow without AWS:

- deploy a branch to a channel from the **Channel Management** workflow: it updates the
  branch's channel if it has one, and creates one otherwise
- leave the channel name blank and let the workflow work it out from the branch
- the branch's channel is deleted automatically when the branch is deleted
- `channel.json` records `channel_name` → `branch_name`
- a sample React app with the sidebar channel switcher

## How it maps to platform-ui

| platform-ui | here |
|---|---|
| S3 bucket | the `gh-pages` branch |
| `s3://<bucket>/<channel>/` | `/<channel>/` folder on `gh-pages` |
| CloudFront Function `channel_router.js` | [pages-root/index.html](pages-root/index.html): reads the `channel` cookie and redirects |
| `/api/cookie?action=set` | `switchChannel()` in [src/channel.ts](src/channel.ts) sets the cookie |
| `development/channel.json` | `/channel.json` at the site root |
| `deploy-dev.yml` (`dev` → `development`) | [deploy-development.yml](.github/workflows/deploy-development.yml) (`main` → `development`) |
| `channel-build.yml` | [channel-build.yml](.github/workflows/channel-build.yml): no action input; create or update is decided from `channel.json` |
| `channel-registry-s3.sh` (S3 If-Match write, retried) | [scripts/pages.sh](scripts/pages.sh) (git push, redone if another run pushed first) |
| `scripts/channel-registry.js` | the same file |
| `deployment-channel.tsx` | [src/ChannelSwitcher.tsx](src/ChannelSwitcher.tsx) |
| hand-placed `config.json` | `development/config.json`, seeded once from [config/development.json](config/development.json) |

## One-time setup

1. **Push to `main`.** The *Deploy development* workflow builds `main` into the
   `development` channel and creates the `gh-pages` branch.
2. **Turn on Pages** once `gh-pages` exists: *Settings → Pages → Build and deployment →
   Source: Deploy from a branch → `gh-pages` / `(root)`*. Or:
   ```sh
   gh api -X POST repos/hiren-coherent/channel-poc/pages -f "source[branch]=gh-pages" -f "source[path]=/"
   ```
3. Open <https://hiren-coherent.github.io/channel-poc/>. The first Pages build takes about a minute.

## Try it

Run the workflow from *Actions → Channel Management → Run workflow*. The branch picked
in **Use workflow from** is the branch that gets built. GitHub's form can't prefill the
channel name from that branch, so leave it blank for the automatic name; the run summary
shows which channel it used.

1. **Create.** `git switch -c feature/SP-101-hello`, change `HEADLINE` in
   [src/App.tsx](src/App.tsx), push. Run the workflow from `feature/SP-101-hello` with
   the channel name blank. You get channel `SP-101` (the Jira key; a branch without one
   uses its last path segment). Open the site and pick `SP-101` in the switcher.
2. **Update.** Push another change and run again with the name blank. The branch already
   has `SP-101`, so that channel is updated.
3. **Ownership guard.** From `feature/SP-101-other`, run with the name blank: it fails,
   because `SP-101` belongs to `feature/SP-101-hello`. Set another channel name instead.
4. **Custom name and config.** Run with channel name `demo`. A new channel gets a copy of
   `development/config.json` (see the *Runtime config* card). Edit `demo/config.json` on
   `gh-pages` and deploy again: an update keeps the channel's own config.
5. **Delete.** `git push origin --delete feature/SP-101-hello`, or delete the branch on
   GitHub. Channel Management runs by itself and removes the branch's channels and their
   registry entries. Deleting the branch is the only way to delete a channel.
6. **Stale cookie.** Switch to a channel, delete its branch, then open the site root. The
   *Channel not found* page takes you back to the default channel.

Each publish shows up after GitHub's Pages build, about a minute. Switching channels
always loads the latest build. If you open a channel URL directly right after a deploy,
hard-refresh (Ctrl+Shift+R): Pages lets browsers cache pages for 10 minutes.

## Run locally

```sh
pnpm install
pnpm dev   # http://localhost:5173: the channel shows as "local", and channel.json isn't served
```

## Differences from platform-ui

- The channel shows in the URL (`/channel-poc/SP-101/`). CloudFront rewrites the request,
  so platform-ui's URLs never change.
- The page sets the cookie itself; platform-ui sets it at the edge.
- A deploy and its registry entry go out as one commit, so they always land together.
- The `delete` trigger only runs from the default branch (`main` here, `dev` in platform-ui).
  Branches deleted by a workflow using `GITHUB_TOKEN` don't trigger it.
- The 404 page assumes a project site (`<user>.github.io/<repo>/`).

## Layout

```
.github/workflows/
  deploy-development.yml   main → development channel, plus the router pages
  channel-build.yml        deploy a branch to its channel, and the branch-delete trigger
scripts/
  channel-registry.js      channel.json format and edits (shared with platform-ui)
  pages.sh                 publishes to gh-pages with retry
pages-root/                router index.html, 404.html, .nojekyll (site root)
config/development.json    seed for development/config.json
src/                       the sample React app and the channel switcher
```
