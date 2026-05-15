# Checklist post-instalación — Fluxtic Provisioner

Lista de validación para correr después de `bash scripts/install.sh`
y antes de mover el CRM a `PROVISIONING_MODE=worker` en producción.

Si todo lo de abajo está en verde, el worker está listo.

---

## 1. Pre-requisitos del sistema

- [ ] `docker --version` ≥ 24
- [ ] `docker compose version` ≥ 2 (plugin v2, NO docker-compose v1)
- [ ] `node -v` ≥ 20
- [ ] El usuario `fluxtic` existe (`id -u fluxtic`)
- [ ] `fluxtic` pertenece al grupo `docker` (`id -nG fluxtic | grep docker`)
- [ ] Como `fluxtic`, podés correr `docker ps` (`sudo -u fluxtic docker ps`)
- [ ] La red Traefik global existe (`docker network inspect proxy`) o el
      worker la va a crear en el primer job

## 2. Directorios

- [ ] `/opt/fluxtic/clients`  → owner `fluxtic:fluxtic`, perms `700`
- [ ] `/opt/fluxtic/backups`  → owner `fluxtic:fluxtic`, perms `700`
- [ ] `/opt/fluxtic/provisioner` → contenido sincronizado desde el repo
- [ ] `/opt/fluxtic/provisioner/dist/index.js` existe (compilado)
- [ ] `/opt/fluxtic/templates/<producto>/workflows/` (opcional, para
      importar workflows n8n automáticamente). Si no existe el paso
      `N8N_IMPORT_WORKFLOWS` se loguea como `skipped`.

## 3. Configuración

- [ ] `/etc/fluxtic/provisioner.env` existe con perms `600`, owner `root:root`
- [ ] Tiene `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` y
      `FIREBASE_ADMIN_PRIVATE_KEY` con valores reales
- [ ] La service account de Firebase tiene rol `Firestore Service Agent`
      (o equivalente con permiso de read/write sobre Firestore)

## 4. systemd

- [ ] `/etc/systemd/system/fluxtic-provisioner.service` instalado
- [ ] `systemctl daemon-reload` corrido
- [ ] `systemctl enable fluxtic-provisioner` (habilita auto-start en boot)
- [ ] `systemctl start fluxtic-provisioner`
- [ ] `systemctl status fluxtic-provisioner` muestra `Active: active (running)`
- [ ] `journalctl -u fluxtic-provisioner -n 30` muestra el log de arranque
      sin errores:
      ```
      Fluxtic Provisioner iniciado (workerId=...)
      Root: /opt/fluxtic/clients · Backup: /opt/fluxtic/backups · Network: proxy
      ```

## 5. Conectividad Firestore

- [ ] El smoke test imprime `FIRESTORE_OK docs=N`:
      ```
      sudo bash /opt/fluxtic/provisioner/scripts/smoke-test.sh
      ```

## 6. CRM en modo worker

- [ ] En el `.env.local` del CRM (o donde sea que corra Next.js):
      ```
      PROVISIONING_MODE=worker
      ```
- [ ] El CRM fue redesplegado para tomar la nueva env var
- [ ] La service account `FIREBASE_ADMIN_*` del CRM y la del worker
      apuntan al **mismo proyecto Firebase**

## 7. Primer cliente de prueba (end-to-end)

1. Desde el CRM, ir a Plataforma → Nuevo cliente
2. Crear un cliente con slug de prueba (por ejemplo `test-001`),
   producto `salud`, modo `demo`, dominios automáticos
3. En el resumen, click "Crear cliente"
4. En la pantalla del job:
   - [ ] El status pasa por: `EN_PROCESO` → `QUEUED` → `EN_PROCESO` → `COMPLETADO`
   - [ ] La barra llega a 100%
   - [ ] Los logs muestran cada paso del worker:
         `PREPARING_FOLDER` → `WRITING_FILES` → `ENSURING_NETWORK`
         → `PULLING_IMAGES` → `STARTING_STACK` → `WAITING_HEALTH`
         → `RUNNING_MIGRATIONS` → `N8N_IMPORT_WORKFLOWS`
         → `VERIFYING_ENDPOINT` → `FINALIZADO`
5. En la VM:
   - [ ] `/opt/fluxtic/clients/test-001/` existe con `.env` (chmod 600),
         `docker-compose.yml` y `metadata.json`
   - [ ] `docker compose -f /opt/fluxtic/clients/test-001/docker-compose.yml ps`
         muestra todos los servicios `running` y `healthy`
   - [ ] La carpeta `/opt/fluxtic/backups/test-001/` existe

## 8. Limpiar el cliente de prueba

```bash
SLUG=test-001
docker compose -f /opt/fluxtic/clients/$SLUG/docker-compose.yml \
  --project-name fluxtic-$SLUG down -v
sudo rm -rf /opt/fluxtic/clients/$SLUG /opt/fluxtic/backups/$SLUG
```
Y en el CRM borrar el documento de Firestore desde el detalle (cuando exista) o
manualmente.

## 9. Pruebas de error y reintento

Para validar que el reintento funciona, podés simular un error temporal:

1. Detené el daemon docker brevemente: `sudo systemctl stop docker`
   (el `docker compose up -d` va a fallar)
2. Creá un cliente desde el CRM
3. El job termina en `ERROR` con cleanup automático (carpeta borrada)
4. Volvé a iniciar docker: `sudo systemctl start docker`
5. En el detalle del job, click "Reintentar"
6. - [ ] El job vuelve a `QUEUED`, lo toma el worker y termina `COMPLETADO`

## 10. Logs en vivo

Comandos útiles para debug:

```bash
# Logs del worker en tiempo real
sudo journalctl -u fluxtic-provisioner -f

# Logs persistentes en Firestore: pantalla del job en el CRM

# Estado de todos los stacks
ls /opt/fluxtic/clients
for d in /opt/fluxtic/clients/*/; do
  echo "── $d ──"
  docker compose -f "$d/docker-compose.yml" ps
done
```
