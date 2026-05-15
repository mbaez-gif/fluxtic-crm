#!/usr/bin/env bash
#
# Validación pre-flight del entorno del worker fluxtic-provisioner.
# Idempotente, no modifica nada — sólo verifica.
#
# Uso: sudo bash scripts/smoke-test.sh
#
# Salida: 0 si todo OK, 1 si algún chequeo crítico falla.

set -uo pipefail

ENV_FILE=${ENV_FILE:-/etc/fluxtic/provisioner.env}
SERVICE=${SERVICE:-fluxtic-provisioner}
ROOT=${FLUXTIC_ROOT:-/opt/fluxtic/clients}
BACKUP=${BACKUP_ROOT:-/opt/fluxtic/backups}
PROVISIONER_DIR=${PROVISIONER_DIR:-/opt/fluxtic/provisioner}
PROXY_NET=${PROXY_NETWORK:-proxy}

FAIL=0
WARN=0

ok()    { echo -e "  \033[32m✔\033[0m $1"; }
fail()  { echo -e "  \033[31m✗\033[0m $1"; FAIL=$((FAIL+1)); }
warn()  { echo -e "  \033[33m!\033[0m $1"; WARN=$((WARN+1)); }
section() { echo -e "\n\033[1m▶ $1\033[0m"; }

if [[ $EUID -ne 0 ]]; then
  echo "Debe correrse como root (sudo)."
  exit 1
fi

# ── 1. Binarios necesarios ────────────────────────────────
section "Binarios"
for bin in node docker; do
  if command -v "$bin" >/dev/null; then
    ok "$bin instalado: $(command -v "$bin")"
  else
    fail "$bin no encontrado en PATH"
  fi
done
if docker compose version >/dev/null 2>&1; then
  ok "docker compose v2 plugin disponible"
else
  fail "Falta el plugin docker compose v2 (docker-compose v1 NO sirve)"
fi
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
if [[ -n "$NODE_MAJOR" && "$NODE_MAJOR" -ge 20 ]]; then
  ok "node $(node -v)"
else
  fail "Se requiere node >= 20 (actual: $(node -v 2>/dev/null || echo 'n/a'))"
fi

# ── 2. Usuario y grupos ───────────────────────────────────
section "Usuario fluxtic"
if id -u fluxtic >/dev/null 2>&1; then
  ok "usuario fluxtic existe"
  if id -nG fluxtic | tr ' ' '\n' | grep -qx docker; then
    ok "fluxtic está en el grupo docker"
  else
    fail "fluxtic NO está en el grupo docker — ejecutar 'usermod -aG docker fluxtic'"
  fi
else
  fail "usuario fluxtic no existe — correr install.sh"
fi

# ── 3. Directorios ────────────────────────────────────────
section "Directorios"
for d in "$ROOT" "$BACKUP" "$PROVISIONER_DIR"; do
  if [[ -d "$d" ]]; then
    OWNER=$(stat -c '%U:%G' "$d")
    PERMS=$(stat -c '%a' "$d")
    ok "$d existe (owner=$OWNER, perms=$PERMS)"
  else
    fail "$d no existe"
  fi
done

# ── 4. Variables de entorno ───────────────────────────────
section "Configuración"
if [[ -f "$ENV_FILE" ]]; then
  PERMS=$(stat -c '%a' "$ENV_FILE")
  if [[ "$PERMS" != "600" ]]; then
    warn "$ENV_FILE tiene permisos $PERMS — debería ser 600"
  else
    ok "$ENV_FILE existe con permisos 600"
  fi
  # Verificar variables requeridas
  for var in FIREBASE_ADMIN_PROJECT_ID FIREBASE_ADMIN_CLIENT_EMAIL FIREBASE_ADMIN_PRIVATE_KEY; do
    if grep -q "^${var}=" "$ENV_FILE" && [[ -n "$(grep "^${var}=" "$ENV_FILE" | sed "s/^${var}=//")" ]]; then
      ok "$var tiene valor"
    else
      fail "$var falta o está vacío en $ENV_FILE"
    fi
  done
else
  fail "$ENV_FILE no existe"
fi

# ── 5. Red Docker proxy ───────────────────────────────────
section "Red Docker '$PROXY_NET'"
if docker network inspect "$PROXY_NET" >/dev/null 2>&1; then
  ok "red $PROXY_NET existe"
else
  warn "red $PROXY_NET no existe — el worker la va a crear automáticamente en el primer job"
fi

# ── 6. Acceso a docker desde el usuario fluxtic ───────────
section "Acceso de fluxtic a Docker"
if sudo -u fluxtic -- docker ps >/dev/null 2>&1; then
  ok "fluxtic puede ejecutar 'docker ps'"
else
  fail "fluxtic NO puede ejecutar docker — re-loguear o reiniciar el servicio después de usermod -aG"
fi

# ── 7. systemd ────────────────────────────────────────────
section "Servicio systemd"
if systemctl list-unit-files "$SERVICE.service" --no-legend 2>/dev/null | grep -q "$SERVICE"; then
  ok "$SERVICE.service registrado"
  STATE=$(systemctl is-active "$SERVICE" 2>/dev/null || true)
  case "$STATE" in
    active)    ok "$SERVICE.service está activo (running)" ;;
    inactive)  warn "$SERVICE.service inactivo — habilitar con 'systemctl enable --now $SERVICE'" ;;
    failed)    fail "$SERVICE.service en estado failed — revisar 'journalctl -u $SERVICE -n 50'" ;;
    *)         warn "$SERVICE.service en estado: $STATE" ;;
  esac
else
  fail "$SERVICE.service no registrado en systemd"
fi

# ── 8. Conectividad Firestore ─────────────────────────────
section "Conectividad Firestore"
if [[ -d "$PROVISIONER_DIR/dist" && -d "$PROVISIONER_DIR/node_modules" && -f "$ENV_FILE" ]]; then
  TEST_OUT=$(sudo -u fluxtic bash -c "
    cd '$PROVISIONER_DIR' &&
    set -a && source '$ENV_FILE' && set +a &&
    node --input-type=module -e \"
      import { initializeApp, cert } from 'firebase-admin/app';
      import { getFirestore } from 'firebase-admin/firestore';
      const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\\\n/g, String.fromCharCode(10));
      initializeApp({ credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  pk,
      }), projectId: process.env.FIREBASE_ADMIN_PROJECT_ID });
      const snap = await getFirestore().collection('provisioning_jobs').limit(1).get();
      console.log('FIRESTORE_OK docs=' + snap.size);
    \" 2>&1
  " 2>&1)
  if echo "$TEST_OUT" | grep -q FIRESTORE_OK; then
    ok "Conectividad Firestore OK — $TEST_OUT"
  else
    fail "Firestore no responde con las credenciales del worker:"
    echo "$TEST_OUT" | sed 's/^/      /'
  fi
else
  warn "Saltando test de Firestore — provisioner aún no instalado (correr install.sh primero)"
fi

# ── Resumen ──────────────────────────────────────────────
section "Resumen"
if [[ $FAIL -eq 0 && $WARN -eq 0 ]]; then
  echo -e "  \033[1;32mTodo OK.\033[0m"
  exit 0
elif [[ $FAIL -eq 0 ]]; then
  echo -e "  \033[1;33m$WARN advertencias, 0 errores.\033[0m"
  exit 0
else
  echo -e "  \033[1;31m$FAIL errores, $WARN advertencias.\033[0m"
  exit 1
fi
