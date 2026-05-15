#!/usr/bin/env bash
#
# Instala el worker Fluxtic Provisioner en la VM.
# Idempotente — podés correrlo varias veces sin romper nada.
#
# Requiere: Ubuntu/Debian con systemd, docker (con plugin compose v2),
# node >= 20.
#
# Uso: sudo bash scripts/install.sh

set -euo pipefail

DEST=/opt/fluxtic/provisioner
USER_NAME=fluxtic
ENV_FILE=/etc/fluxtic/provisioner.env
ENV_DIR=$(dirname "$ENV_FILE")

if [[ $EUID -ne 0 ]]; then
  echo "Este script debe correrse como root (sudo)."
  exit 1
fi

echo "▶︎ Verificando dependencias…"
command -v node    >/dev/null || { echo "Falta node (>=20)"; exit 1; }
command -v docker  >/dev/null || { echo "Falta docker"; exit 1; }
docker compose version >/dev/null || { echo "Falta el plugin docker compose v2"; exit 1; }

echo "▶︎ Creando usuario $USER_NAME (si no existe)…"
if ! id -u "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --shell /usr/sbin/nologin --home-dir /nonexistent "$USER_NAME"
fi
usermod -aG docker "$USER_NAME"

echo "▶︎ Creando estructura de directorios…"
mkdir -p /opt/fluxtic/clients /opt/fluxtic/backups "$DEST"
chown -R "$USER_NAME":"$USER_NAME" /opt/fluxtic/clients /opt/fluxtic/backups "$DEST"
chmod 700 /opt/fluxtic/clients /opt/fluxtic/backups

echo "▶︎ Sincronizando código del worker a $DEST…"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude scripts/install.sh \
  "$SRC_DIR/" "$DEST/"
chown -R "$USER_NAME":"$USER_NAME" "$DEST"

echo "▶︎ Instalando dependencias y compilando…"
sudo -u "$USER_NAME" -- bash -c "
  cd '$DEST' &&
  npm install --omit=dev --no-audit --no-fund &&
  npm install --save-dev typescript@^5.4.5 &&
  npx tsc
"

echo "▶︎ Plantilla de configuración…"
mkdir -p "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# Credenciales del worker Fluxtic Provisioner.
# Editar antes de habilitar el servicio.
#
# Service account de Firebase (mismo proyecto que el CRM).

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
# Pegá la clave privada toda en una sola línea con \n literales.
FIREBASE_ADMIN_PRIVATE_KEY=""

# Opcional — defaults
# FLUXTIC_ROOT=/opt/fluxtic/clients
# BACKUP_ROOT=/opt/fluxtic/backups
# PROXY_NETWORK=proxy
# WORKER_ID=worker-1
# POLL_INTERVAL_MS=5000
# LEASE_TTL_SECONDS=600
# HEALTHCHECK_TIMEOUT_MS=180000
EOF
  chmod 600 "$ENV_FILE"
  chown root:root "$ENV_FILE"
  echo "  Archivo creado: $ENV_FILE — completá las credenciales."
else
  echo "  $ENV_FILE ya existe — no se modifica."
fi

echo "▶︎ Instalando unit de systemd…"
cp "$DEST/systemd/fluxtic-provisioner.service" /etc/systemd/system/fluxtic-provisioner.service
systemctl daemon-reload

echo ""
echo "✔︎ Instalación completada."
echo ""
echo "Próximos pasos:"
echo "  1. Editá $ENV_FILE con las credenciales de Firebase."
echo "  2. Verificá que la red Docker 'proxy' existe (Traefik global):"
echo "       docker network inspect proxy || docker network create proxy"
echo "  3. Habilitá e iniciá el servicio:"
echo "       systemctl enable --now fluxtic-provisioner"
echo "  4. Mirá los logs:"
echo "       journalctl -u fluxtic-provisioner -f"
echo ""
echo "  El CRM tiene que correr con PROVISIONING_MODE=worker para que use este worker."
