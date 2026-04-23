# Fluxtic CRM — Sprint 2

Módulos implementados en este sprint:
- **Diagnósticos** — CRUD en tarjetas con drawer de detalle
- **Oportunidades** — Pipeline Kanban con 5 columnas y mover entre etapas
- **Propuestas** — Tabla con versioning, drawer de detalle y cambio de estado rápido

---

## Cómo integrar con Sprint 1

Copia los archivos de este ZIP **sobre el proyecto del Sprint 1**, respetando la misma estructura de carpetas:

```
fluxtic/
└── src/
    └── app/
        ├── diagnosticos/
        │   ├── layout.tsx   ← reemplaza el placeholder
        │   └── page.tsx     ← reemplaza el placeholder
        ├── oportunidades/
        │   ├── layout.tsx
        │   └── page.tsx
        └── propuestas/
            ├── layout.tsx
            └── page.tsx
```

No hay cambios en `package.json` ni dependencias nuevas.

---

## Funcionalidades por módulo

### Diagnósticos
- Vista en tarjetas (grid 3 columnas)
- Filtro por estado: Borrador / En revisión / Completado
- Formulario modal con selector de lead calificado, hallazgos y recomendaciones
- Drawer lateral de detalle con lectura enriquecida
- Cambio de estado desde el menú contextual de cada tarjeta

### Pipeline (Oportunidades)
- Kanban con 5 columnas: Análisis · Propuesta · Negociación · Ganada · Perdida
- Total de pipeline visible por columna y en el header
- Barra de probabilidad visual en cada tarjeta
- Mover oportunidad entre etapas desde el menú contextual
- Selector de diagnóstico filtrado por lead seleccionado

### Propuestas
- Tabla con columnas: título, oportunidad, importe, estado, versión, fecha
- Versioning automático (v1, v2…) al editar
- Drawer lateral con cambio de estado rápido (botones Borrador / Enviada / Aceptada / Rechazada)
- Entregables ingresados como lista libre (un ítem por línea)
- Soporte para EUR, USD, GBP

---

## Próximo sprint (Sprint 3)

| Módulo   | Funcionalidades |
|---|---|
| Clientes | Ficha completa, lista de contactos, conversión desde oportunidad ganada |
| Proyectos| CRUD con presupuesto, fechas, estado, tareas anidadas |
| Abonos   | Contratos recurrentes, registro de pagos, alertas de renovación |
| Tareas   | Kanban global, filtro por proyecto y responsable |
