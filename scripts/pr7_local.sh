#!/usr/bin/env bash
# Local PR7 staging helper: never runs a production server or connects to Emergent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="$ROOT/compose.pr7.yml"
ACTION="$(printf '%s' "$*" | awk '{print $1}')"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERRORE: manca $1. Installa prima il requisito e riprova." >&2
    exit 2
  fi
}

preflight() {
  for program in git node yarn docker python3 curl; do require_tool "$program"; done
  if [ "$(uname -s)" != "Darwin" ] && [ "$(printenv PR7_ALLOW_CI 2>/dev/null || true)" != "1" ]; then
    echo "ERRORE: questo script interattivo e' previsto per Mac. I runner CI usano PR7_ALLOW_CI=1." >&2
    exit 2
  fi
  local branch arch node_major yarn_version
  branch="$(git -C "$ROOT" branch --show-current)"
  if [ "$branch" != "feature/risk-priority-numbering" ]; then
    echo "ERRORE: ramo attuale '$branch'; richiesto feature/risk-priority-numbering." >&2
    exit 2
  fi
  if [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]; then
    echo "ERRORE: modifiche locali non salvate. Conservale prima di avviare lo staging." >&2
    exit 2
  fi
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$node_major" != "22" ]; then
    echo "ERRORE: serve Node.js 22 (trovato major $node_major)." >&2
    exit 2
  fi
  yarn_version="$(yarn --version)"
  case "$yarn_version" in
    1.*) ;;
    *) echo "ERRORE: serve Yarn classic 1.x (trovato $yarn_version)." >&2; exit 2 ;;
  esac
  if [ "$(printenv APP_ENV 2>/dev/null || true)" = "production" ]; then
    echo "ERRORE: APP_ENV=production nella shell. Non avviare lo staging da una sessione LIVE." >&2
    exit 2
  fi
  # Never read local secret file contents or let a frontend .env override the
  # localhost API endpoint at build time.
  for env_file in "$ROOT/frontend/.env" "$ROOT/frontend/.env.local" \
                  "$ROOT/frontend/.env.production" "$ROOT/frontend/.env.production.local"; do
    if [ -e "$env_file" ]; then
      echo "ERRORE: trovato file di configurazione frontend locale. Usare una copia pulita del repository; non caricare Secrets nello staging." >&2
      exit 2
    fi
  done
  if ! docker info >/dev/null 2>&1; then
    echo "ERRORE: Docker Desktop non e' in esecuzione o non e' accessibile." >&2
    exit 2
  fi
  docker compose version >/dev/null
  docker compose -f "$COMPOSE" config --format json | python3 -c '
import json, sys
c=json.load(sys.stdin)
services=c["services"]
app,db,gw=(services[x] for x in ("staging","mongo","gateway"))
ports=gw["ports"]
assert len(ports)==1 and ports[0]["host_ip"]=="127.0.0.1"
assert int(ports[0]["published"])==8765
assert not app.get("ports") and not db.get("ports")
private=next(iter(app["networks"]))
assert len(app["networks"])==1 and c["networks"][private]["internal"] is True
assert private in db["networks"] and private in gw["networks"]
assert app["environment"]["APP_ENV"]=="test"
assert app["environment"]["PR7_LOCAL_STAGING"]=="1"
assert not gw.get("environment")
print("PR7 PREFLIGHT: rete Docker privata, gateway localhost, nessuna credenziale")
'
  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERRORE: la porta 8765 e' gia' occupata. Ferma il servizio esistente prima di avviare." >&2
    exit 2
  fi
  arch="$(uname -m)"
  echo "PR7 PREFLIGHT OK: architettura $arch. Nessuna chiamata AI o al database LIVE."
}

case "$ACTION" in
  check)
    preflight
    ;;
  start)
    preflight
    echo "Compilo il frontend solo per staging sintetico..."
    (cd "$ROOT/frontend" && yarn install --non-interactive --ignore-scripts --network-timeout 120000 && CI=false REACT_APP_BACKEND_URL='' yarn build)
    docker compose -f "$COMPOSE" up -d --build --wait
    python3 "$ROOT/backend/scripts/pr7_docker_smoke.py"
    echo "Staging pronto: http://127.0.0.1:8765/area"
    echo "Account A: studio-a@demo.invalid  Password: synthetic-local-only"
    ;;
  status)
    require_tool docker
    docker compose -f "$COMPOSE" ps
    if command -v curl >/dev/null 2>&1; then
      curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8765/api/pr7-staging/status || true
      printf '\n'
    fi
    ;;
  stop)
    require_tool docker
    docker compose -f "$COMPOSE" down --remove-orphans
    echo "Staging fermato. Il volume contiene solo dati sintetici."
    ;;
  clean)
    require_tool docker
    printf "Cancellare anche il volume MongoDB sintetico PR7? Digitare CANCELLA per confermare: "
    read -r answer
    if [ "$answer" != "CANCELLA" ]; then
      echo "Operazione annullata."
      exit 1
    fi
    docker compose -f "$COMPOSE" down -v --remove-orphans
    echo "Container e dati sintetici PR7 eliminati."
    ;;
  *)
    echo "Uso: bash scripts/pr7_local.sh check|start|status|stop|clean" >&2
    exit 2
    ;;
esac
