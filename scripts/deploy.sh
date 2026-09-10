#!/usr/bin/env bash
#
# Idempotent VPS deploy for spain-address-autocomplete.
#
# Pulls `origin/main`, installs dependencies, syncs the systemd units shipped
# in `scripts/systemd/`, runs a typecheck gate, restarts the HTTP services and
# health-checks them. Safe to run from a timer (`spain-deploy.timer`): it exits
# immediately when the checkout already matches `origin/main`.
#
# Usage:
#   bash scripts/deploy.sh            # deploy if origin/main moved
#   bash scripts/deploy.sh --force    # redeploy even if already current
#   bash scripts/deploy.sh --no-gate  # skip the typecheck gate
#
# Env overrides: REPO_DIR, BRANCH, SERVICES (space-separated), STATE_DIR.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/deploy/spain-address-autocomplete}"
BRANCH="${BRANCH:-main}"
SERVICES="${SERVICES:-spain-cascade spain-proxy spain-mcp}"
STATE_DIR="${STATE_DIR:-$HOME/.spain-deploy}"

FORCE=0
GATE=1
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --no-gate) GATE=0 ;;
    *) echo "[deploy] unknown argument: $arg" >&2; exit 2 ;;
  esac
done

log() { echo "[deploy] $*"; }

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
if ! flock -n 9; then
  log "another deploy is already running; exiting"
  exit 0
fi

cd "$REPO_DIR"

log "fetching origin/$BRANCH"
if ! git fetch --prune origin "$BRANCH" >/dev/null 2>&1; then
  log "git fetch failed (network?)"
  exit 1
fi

TARGET="$(git rev-parse "origin/$BRANCH")"
PREV="$(git rev-parse HEAD)"

if [ "$FORCE" -eq 0 ] && [ "$TARGET" = "$PREV" ]; then
  log "already up to date ($TARGET)"
  exit 0
fi

if [ "$FORCE" -eq 0 ] && [ -f "$STATE_DIR/last_failed" ] && \
   [ "$(cat "$STATE_DIR/last_failed")" = "$TARGET" ]; then
  log "commit $TARGET previously failed; skipping (push a new commit or use --force)"
  exit 0
fi

log "deploying $TARGET (was $PREV)"

# The deploy checkout is disposable: discard local edits (generated snapshot
# metadata, etc.) so the pull is always clean.
git reset --hard "$TARGET"

if ! pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1; then
  log "pnpm install failed; rolling back to $PREV"
  git reset --hard "$PREV"
  echo "$TARGET" > "$STATE_DIR/last_failed"
  exit 1
fi

# Sync the systemd units versioned in scripts/systemd/ (only when they change).
UNITS_CHANGED=0
if [ -d scripts/systemd ]; then
  for unit in scripts/systemd/*.service scripts/systemd/*.timer; do
    [ -e "$unit" ] || continue
    name="$(basename "$unit")"
    if ! sudo cmp -s "$unit" "/etc/systemd/system/$name"; then
      sudo install -m 644 "$unit" "/etc/systemd/system/$name"
      log "updated unit $name"
      UNITS_CHANGED=1
    fi
  done
fi
if [ "$UNITS_CHANGED" -eq 1 ]; then
  sudo systemctl daemon-reload
fi

if [ "$GATE" -eq 1 ]; then
  log "typecheck gate"
  if ! pnpm typecheck >/dev/null 2>&1; then
    log "typecheck failed; rolling back to $PREV"
    git reset --hard "$PREV"
    pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1 || true
    echo "$TARGET" > "$STATE_DIR/last_failed"
    exit 1
  fi
fi

rm -f "$STATE_DIR/last_failed"

# Enable + (re)start the services whose unit is installed.
PRESENT=()
for svc in $SERVICES; do
  [ -f "/etc/systemd/system/$svc.service" ] && PRESENT+=("$svc")
done
if [ "${#PRESENT[@]}" -gt 0 ]; then
  sudo systemctl enable "${PRESENT[@]}" >/dev/null 2>&1 || true
  sudo systemctl restart "${PRESENT[@]}"
  log "restarted: ${PRESENT[*]}"
fi

# Health checks (best-effort; a failure marks the deploy failed so it retries).
sleep 2
FAILED=0
check() {
  if ! curl -fsS --max-time 5 "$1" >/dev/null 2>&1; then
    log "health check failed: $1"
    FAILED=1
  fi
}
check "http://127.0.0.1:5978/api/geo/provincias"
check "http://127.0.0.1:8787/health"
check "http://127.0.0.1:8789/health"

echo "$TARGET" > "$STATE_DIR/last_deployed"
if [ "$FAILED" -eq 1 ]; then
  echo "$TARGET" > "$STATE_DIR/last_failed"
  log "deployed $TARGET with failing health checks"
  exit 1
fi

log "deployed $TARGET OK"
