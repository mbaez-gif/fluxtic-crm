# Fluxtic CRM

CRM interno para la consultora Fluxtic. Stack: **Next.js 14** · **Tailwind CSS** · **Firebase Auth** · **Firestore**.

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com) y crea un proyecto.
2. Activa **Authentication → Email/Password**.
3. Activa **Firestore Database** en modo producción.
4. En *Configuración del proyecto → Tus apps → Web*, copia la configuración.

Crea el archivo `.env.local` en la raíz (copia `.env.local.example`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Desplegar reglas e índices de Firestore

```bash
# Instala Firebase CLI si no lo tienes
npm install -g firebase-tools

firebase login
firebase init   # selecciona Firestore, usa el proyecto ya creado

firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Crear el primer usuario administrador

En Firebase Console → Authentication → Users → Añadir usuario.

Luego en Firestore → Colección `users` → Añadir documento manualmente con el UID del usuario:

```json
{
  "uid":      "UID_DEL_USUARIO",
  "email":    "admin@fluxtic.com",
  "nombre":   "Admin",
  "rol":      "admin",
  "avatarUrl": null,
  "creadoEn": <timestamp>
}
```

### 5. Arrancar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Estructura del proyecto

```
src/
├── app/
│   ├── auth/login/        # Pantalla de login
│   ├── dashboard/         # Dashboard con KPIs
│   ├── leads/             # Módulo leads (CRUD completo)
│   ├── diagnosticos/      # Módulo diagnósticos
│   ├── oportunidades/     # Pipeline kanban
│   ├── propuestas/        # Propuestas comerciales
│   ├── clientes/          # Fichas de clientes
│   ├── proyectos/         # Proyectos activos
│   ├── abonos/            # Contratos de retención
│   └── tareas/            # Gestión de tareas
├── components/
│   ├── auth/              # AuthProvider, useRequireAuth
│   ├── layout/            # AppShell, Sidebar, PageHeader
│   └── ui/                # Badge, Spinner, EmptyState, StatCard
├── lib/
│   ├── firebase/          # config, auth, firestore helpers
│   ├── hooks/             # useAuth, useCollection, useDocument
│   └── utils.ts           # cn() helper
├── types/                 # Todos los tipos TypeScript
└── styles/globals.css     # Design tokens + componentes base
```

## Módulos implementados en Sprint 1

| Módulo | Estado |
|---|---|
| Setup + Firebase config | ✅ Completo |
| Auth (login / logout) | ✅ Completo |
| Layout + Sidebar | ✅ Completo |
| Dashboard con KPIs | ✅ Completo |
| Leads (CRUD completo) | ✅ Completo |
| Diagnósticos | 🔲 Sprint 2 |
| Pipeline / Oportunidades | 🔲 Sprint 2 |
| Propuestas | 🔲 Sprint 2 |
| Clientes | 🔲 Sprint 3 |
| Proyectos | 🔲 Sprint 3 |
| Abonos | 🔲 Sprint 3 |
| Tareas (kanban) | 🔲 Sprint 3 |
