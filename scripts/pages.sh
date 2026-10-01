#!/usr/bin/env bash
# Publishes to the gh-pages branch, which plays the S3 bucket from platform-ui:
#   /index.html, /404.html   channel router (stand-in for the CloudFront function)
#   /channel.json            channel registry, see scripts/channel-registry.js
#   /development/            the default channel, deployed from main
#   /<channel>/              one folder per channel
#
#   pages.sh read <channel-registry.js args>         find/owner on the published registry
#   pages.sh deploy-default <dist>                   main → the default channel, plus the router
#   pages.sh deploy <create|update> <channel> <branch> <dist> <copy_config: true|false>
#   pages.sh delete <channel>...
#
# Each change is one commit pushed to gh-pages. If the push is rejected because another
# run published first, the change is redone on the new tip (the git version of the S3
# If-Match write in platform-ui), so overlapping runs never drop each other's edits.
set -euo pipefail

DEFAULT_CHANNEL=development
CHANNEL_REGEX='^[A-Za-z0-9_-]{1,20}$'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY_JS="$ROOT/scripts/channel-registry.js"
WORK="$(mktemp -d)"
PAGES="$WORK/gh-pages"

cleanup() {
  git -C "$ROOT" worktree remove --force "$PAGES" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

valid_channel() {
  if [[ ! "$1" =~ $CHANNEL_REGEX || "$1" == "$DEFAULT_CHANNEL" ]]; then
    echo "::error::Invalid or protected channel '$1'" >&2
    exit 1
  fi
}

# A fresh worktree of the published gh-pages tip, or an empty one if the branch doesn't
# exist yet. Any other failure to reach origin stops the run.
checkout_pages() {
  git -C "$ROOT" worktree remove --force "$PAGES" 2>/dev/null || true
  local found=0
  git -C "$ROOT" ls-remote --exit-code --heads origin gh-pages >/dev/null || found=$?
  if [[ $found -eq 0 ]]; then
    git -C "$ROOT" fetch -q --depth=1 origin gh-pages
    git -C "$ROOT" worktree add -q --detach "$PAGES" FETCH_HEAD
  elif [[ $found -eq 2 ]]; then
    git -C "$ROOT" branch -D gh-pages-new >/dev/null 2>&1 || true
    git -C "$ROOT" worktree add -q --detach "$PAGES"
    git -C "$PAGES" switch -q --orphan gh-pages-new
  else
    echo "::error::Could not read gh-pages from origin" >&2
    exit 1
  fi
}

# publish <message> <function> [args...]: apply the function to a fresh gh-pages tree,
# then commit and push, starting over if the push loses a race.
publish() {
  local message="$1"
  shift
  for attempt in 1 2 3 4 5; do
    checkout_pages
    (
      cd "$PAGES"
      "$@"
    )
    if [[ -z "$(git -C "$PAGES" status --porcelain)" ]]; then
      echo "gh-pages is already up to date"
      return 0
    fi
    git -C "$PAGES" add -A
    git -C "$PAGES" -c user.name='github-actions[bot]' \
      -c user.email='41898099+github-actions[bot]@users.noreply.github.com' commit -qm "$message"
    if git -C "$PAGES" push -q origin HEAD:refs/heads/gh-pages; then
      echo "Published: $message"
      return 0
    fi
    echo "gh-pages moved while publishing; retrying (attempt $attempt)" >&2
    sleep $((attempt * 2))
  done
  echo "::error::Gave up publishing after 5 attempts" >&2
  exit 1
}

# Replace a channel folder with a build, keeping the folder's own config.json (the S3
# deploy in platform-ui skips *.json for the same reason).
replace_folder() { # <folder> <dist>
  local kept=""
  if [[ -f "$1/config.json" ]]; then
    kept="$WORK/config.json"
    cp "$1/config.json" "$kept"
  fi
  rm -rf "./$1"
  cp -r "$2" "./$1"
  if [[ -n "$kept" ]]; then cp "$kept" "$1/config.json"; fi
}

deploy_default() { # <dist>
  replace_folder "$DEFAULT_CHANNEL" "$1"
  # Stands in for platform-ui's hand-placed config.json: seeded once, then edit it on gh-pages.
  if [[ ! -f "$DEFAULT_CHANNEL/config.json" ]]; then
    cp "$ROOT/config/development.json" "$DEFAULT_CHANNEL/config.json"
  fi
  cp -r "$ROOT/pages-root/." .
}

# The ownership check runs on every attempt, against the tip being pushed onto, so two
# runs can't both claim one channel.
deploy_channel() { # <create|update> <channel> <branch> <dist> <copy_config>
  local mode="$1" channel="$2" branch="$3" dist="$4" copy_config="$5" owner
  owner=$(node "$REGISTRY_JS" --file=channel.json --op=owner --name="$channel")
  if [[ -n "$owner" && "$owner" != "$branch" ]]; then
    if [[ "$mode" == create ]]; then
      echo "::error::Channel '$channel' is deployed from branch '$owner'. Set another channel_name, or run update to take it over." >&2
      exit 1
    fi
    echo "::warning::Channel '$channel' moves from branch '$owner' to '$branch'." >&2
  fi
  replace_folder "$channel" "$dist"
  if [[ "$copy_config" == true && -f "$DEFAULT_CHANNEL/config.json" ]]; then
    cp "$DEFAULT_CHANNEL/config.json" "$channel/config.json"
  fi
  node "$REGISTRY_JS" --file=channel.json --op=add --name="$channel" --branch="$branch"
}

delete_channels() { # <channel>...
  for channel in "$@"; do
    rm -rf "./$channel"
    node "$REGISTRY_JS" --file=channel.json --op=remove --name="$channel"
  done
}

command="${1:-}"
shift || true
case "$command" in
  read)
    checkout_pages
    node "$REGISTRY_JS" --file="$PAGES/channel.json" "$@"
    ;;
  deploy-default)
    publish "Deploy $DEFAULT_CHANNEL from ${GITHUB_SHA:-local}" deploy_default "$(cd "$1" && pwd)"
    ;;
  deploy)
    if [[ "${1:-}" != create && "${1:-}" != update ]]; then
      echo "deploy mode must be create or update" >&2
      exit 2
    fi
    valid_channel "$2"
    publish "$1 channel $2 from $3" deploy_channel "$1" "$2" "$3" "$(cd "$4" && pwd)" "$5"
    ;;
  delete)
    for channel in "$@"; do valid_channel "$channel"; done
    publish "Delete channel(s) $*" delete_channels "$@"
    ;;
  *)
    sed -n '2,12p' "$0" >&2
    exit 2
    ;;
esac
