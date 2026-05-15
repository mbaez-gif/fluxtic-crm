# Checklist de seguridad — Módulo de Provisionamiento

Este checklist se aplica a TODO cambio del módulo Plataforma → Clientes
Fluxtic. Cada PR debe responder "OK" a cada ítem o documentar mitigación.

## Frontend

- [ ] Ninguna pantalla envía comandos shell ni paths arbitrarios al backend.
- [ ] El cliente sólo envía DTOs declarados en `src/types/provisioning.ts`.
- [ ] El gating `useRequireSuperAdmin` está presente en cada `page.tsx` del
      módulo (`/plataforma/**`).
- [ ] La entrada del Sidebar a Plataforma se oculta para usuarios que no
      son `super_admin`.

## API routes

- [ ] Cada route handler llama a `requireSuperAdmin(req)` como primera
      operación.
- [ ] El JWT se verifica con `firebase-admin` (no con la librería cliente).
- [ ] Errores devuelven `401`/`403` antes de cualquier acceso a Firestore.
- [ ] No existe un endpoint genérico de ejecución de comandos. Cada endpoint
      mapea a una acción discreta de la lista cerrada documentada en
      `docs/provisioning.md`.

## Validación de input

- [ ] `slug` matchea `^[a-z0-9-]{3,40}$` y no figura en la lista negra
      (`postgres`, `redis`, `traefik`, `n8n`, `api`, `app`, `crm`, `admin`,
      `proxy`, `root`, `www`, `mail`, `ftp`).
- [ ] `dominio` matchea el regex de hostname (RFC 1123 simplificado).
- [ ] No se acepta ningún campo de tipo `string` con caracteres de control,
      `..`, `/`, `;`, `&&`, `|`, backticks, `$(` ni newlines.
- [ ] `productType` está dentro del enum cerrado.
- [ ] `email` matchea regex y se normaliza a lowercase.

## Path safety

- [ ] Las rutas físicas se arman SIEMPRE como
      `path.posix.join(FLUXTIC_ROOT, sanitizeSlug(slug))`.
- [ ] `FLUXTIC_ROOT` es una constante (`/opt/fluxtic/clients`), no viene
      del input.
- [ ] El sanitizador rechaza `..`, `/`, `\` y devuelve el slug intacto si
      ya pasó el regex.
- [ ] Antes de cualquier escritura, se comprueba que el `resolve()` del
      path final empiece por `FLUXTIC_ROOT`.

## Secretos

- [ ] Las contraseñas generadas usan `crypto.randomBytes(24)` o equivalente.
- [ ] El `.env` generado se sirve UNA SOLA VEZ al `super_admin` que lo
      creó. Después se persiste sólo un hash + un flag `secretsRevealed: true`.
- [ ] Ningún secreto llega al historial de logs ni a `provisioning_logs`.
- [ ] No se permite descargar el `.env` salvo a `super_admin` autenticado
      y solo dentro de las 24 hs siguientes a la creación.

## Auditoría

- [ ] Todo `ClientTenant` y `ProvisioningJob` registra `createdById`
      (uid del super_admin).
- [ ] Cada cambio de estado escribe en `provisioning_logs` con uid + paso.
- [ ] El listado de clientes muestra quién los creó.

## Firestore Rules

- [ ] Colecciones `provisioning_*`: `allow read, write: if isSuperAdmin()`.
- [ ] `isSuperAdmin()` se valida contra `users/{uid}.rol == 'super_admin'`.
- [ ] No hay regla "fallback" que permita acceso anónimo.

## V2/V3 (cuando se agregue ejecución real)

- [ ] El worker corre en máquina separada con su propia identidad.
- [ ] El worker no acepta payload de comandos: lee el job de Firestore.
- [ ] El usuario que corre `docker` no es root; pertenece al grupo `docker`.
- [ ] El stack se monta dentro de `/opt/fluxtic/clients/<slug>` con
      `chown` al usuario provisioner y `chmod 700` en archivos sensibles.
- [ ] El `.env` en disco es `chmod 600`.
- [ ] La importación de workflows n8n usa un token interno por instancia,
      nunca un token global.
- [ ] Healthcheck HTTP usa timeout y no sigue redirects.
- [ ] El servicio nunca borra automáticamente en caso de fallo. Marca
      `ERROR` y deja artefactos para inspección manual.
