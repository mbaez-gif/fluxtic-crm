# Fluxtic CRM — Sprint 3

Módulos implementados:
- **Clientes** — fichas con contactos, vinculación a oportunidad, estado
- **Clientes / detalle** — KPIs, proyectos y abonos del cliente
- **Proyectos** — CRUD con presupuesto, fechas, estado y barra de progreso
- **Proyectos / detalle** — gestión de tareas del proyecto inline
- **Abonos** — contratos recurrentes con cálculo automático de renovación
- **Abonos / pagos** — registro de cobros con historial expandible
- **Tareas** — kanban global con filtro por proyecto, prioridad y etiquetas

---

## Guía paso a paso para integrar

### Paso 1 — Descomprime el ZIP

Descomprime `fluxtic-crm-sprint3.zip`. Verás esta estructura:

```
fluxtic-s3/
└── src/
    └── app/
        ├── clientes/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── [id]/
        │       ├── layout.tsx
        │       └── page.tsx
        ├── proyectos/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── [id]/
        │       ├── layout.tsx
        │       └── page.tsx
        ├── abonos/
        │   ├── layout.tsx
        │   └── page.tsx
        └── tareas/
            ├── layout.tsx
            └── page.tsx
```

### Paso 2 — Copia los archivos sobre tu proyecto

Copia **todo el contenido de `fluxtic-s3/src/`** dentro de tu proyecto en `fluxtic/src/`, reemplazando los archivos existentes.

En Windows puedes arrastrar las carpetas directamente en el Explorador de archivos.
En Mac puedes usar Finder o el terminal:

```bash
cp -r fluxtic-s3/src/app/clientes  fluxtic/src/app/
cp -r fluxtic-s3/src/app/proyectos fluxtic/src/app/
cp -r fluxtic-s3/src/app/abonos    fluxtic/src/app/
cp -r fluxtic-s3/src/app/tareas    fluxtic/src/app/
```

### Paso 3 — Verifica que no hay errores en local (opcional)

```bash
cd fluxtic
npm run dev
```

Abre http://localhost:3000 y navega a cada módulo para confirmar que carga.

### Paso 4 — Sube a GitHub

Abre GitHub Desktop:
1. Verás los archivos nuevos en la columna "Changes"
2. Escribe en Summary: `feat: Sprint 3 - Clientes, Proyectos, Abonos, Tareas`
3. Clic en **Commit to main**
4. Clic en **Push origin**

### Paso 5 — Vercel redespliega automáticamente

En cuanto el push llega a GitHub, Vercel detecta el cambio y redespliega en ~2 minutos. No tienes que hacer nada más.

Puedes ver el progreso en vercel.com → tu proyecto → Deployments.

### Paso 6 — Verifica en producción

Entra a `fluxtic-crm.vercel.app` y comprueba:
- [ ] Módulo Clientes carga y permite crear/editar
- [ ] Ficha de cliente muestra proyectos y abonos
- [ ] Módulo Proyectos carga y permite crear
- [ ] Detalle de proyecto muestra tareas
- [ ] Módulo Abonos carga, permite crear y registrar pagos
- [ ] Módulo Tareas muestra el kanban con 4 columnas

---

## Resumen de lo que hace cada módulo

### Clientes
- Lista en tarjetas con estado (Activo / Inactivo / Churned)
- Formulario con múltiples contactos por empresa
- Ficha de detalle con KPIs (proyectos activos, abonos, MRR)
- Vinculación opcional a una oportunidad ganada

### Proyectos
- Tabla con filtros por estado
- Barra de progreso basada en tareas completadas
- Ficha de detalle con gestión de tareas inline
- Cambio de estado de tarea con un clic

### Abonos
- Tabla con alerta visual de renovaciones próximas (7 días) y vencidas
- Cálculo automático de fecha de renovación según periodicidad
- Botón "Pago cobrado" que registra el pago y avanza la renovación
- Historial de pagos expandible por fila
- Cards de resumen por periodicidad (mensual / trimestral / anual)

### Tareas
- Kanban global con 4 columnas: Pendiente → En progreso → Revisión → Completada
- Filtro por proyecto activo
- Mover tarea entre columnas desde el menú contextual
- Prioridad visual (punto de color), etiquetas y fecha límite
- También accesibles desde la ficha del proyecto
