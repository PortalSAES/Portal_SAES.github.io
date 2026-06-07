# SISE · Portal del Asesor — Instrucciones de configuración

## Archivos del proyecto
- `index.html` → Pantalla de login
- `portal.html` → Portal principal con BO Llamadas
- `INSTRUCCIONES.md` → Esta guía

---

## 1. Crear proyecto en Firebase

1. Ve a https://console.firebase.google.com
2. Clic en **Agregar proyecto** → dale un nombre (ej: `sise-portal`)
3. Sigue los pasos y crea el proyecto

---

## 2. Habilitar Authentication

1. En la consola Firebase → **Authentication** → **Comenzar**
2. En la pestaña **Sign-in method** → activa **Correo electrónico/contraseña**
3. En **Users** → crea manualmente los usuarios permitidos:
   - `GCHACONR@cientifica.edu.pe` + una contraseña temporal
   - `jruizsi@cientifica.edu.pe` + una contraseña temporal
   - (agrega todos los asesores que necesites)

---

## 3. Habilitar Firestore

1. En la consola Firebase → **Firestore Database** → **Crear base de datos**
2. Elige **Modo de prueba** por ahora (luego configurar reglas)
3. Selecciona la región más cercana (ej: `us-central1`)

---

## 4. Crear colección de asesores autorizados

En Firestore, crea una colección llamada **`asesores_autorizados`** con un documento por cada asesor:

- **ID del documento** = el correo en minúsculas (ej: `gchaconr@cientifica.edu.pe`)
- **Campos:**
  ```
  nombre: "Gabriela Chacon"
  rol: "asesor"
  activo: true
  ```

Esto es lo que valida el login — si el correo no tiene documento aquí, no puede entrar.

---

## 5. Obtener credenciales Firebase

1. En la consola Firebase → ícono de engranaje → **Configuración del proyecto**
2. Baja hasta **Tus apps** → clic en `</>` (Web)
3. Registra la app → copia el objeto `firebaseConfig`

Reemplaza en **ambos archivos** (`index.html` y `portal.html`) la sección:

```javascript
const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROJECT.firebaseapp.com",
  projectId:         "TU_PROJECT_ID",
  storageBucket:     "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};
```

---

## 6. Reglas de Firestore (producción)

Una vez probado, actualiza las reglas en Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Solo usuarios autenticados pueden leer/escribir llamadas
    match /bo_llamadas/{doc} {
      allow read, write: if request.auth != null;
    }
    
    // Solo lectura para asesores autorizados
    match /asesores_autorizados/{email} {
      allow read: if request.auth != null;
      allow write: if false; // solo admin desde consola
    }
  }
}
```

---

## 7. Colecciones en Firestore

El portal usa automáticamente estas colecciones:
- `asesores_autorizados` → control de acceso
- `bo_llamadas` → registros de llamadas (se crea sola al guardar el primer registro)

---

## Flujo de uso

1. Asesor WSP recibe consulta de alumno por WhatsApp
2. Abre el portal → va a **BO Llamadas**
3. Hace clic en **Nuevo registro** y llena los datos
4. El asesor BO ve el registro en tiempo real y realiza la llamada
5. Actualiza el estado (Atendido / No responde / Derivado / etc.)

---

## Despliegue recomendado

Opción gratuita: **Firebase Hosting**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
