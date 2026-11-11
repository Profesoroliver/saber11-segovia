# Ruta Saber 11° · Sociales y Ciudadanas — I.E. Segovia (Décimo 1)

## Contenido del paquete

| Archivo | Función |
|---|---|
| `index.html` | La app completa (un solo archivo, funciona sin internet) |
| `Code.gs` | Backend en Google Apps Script: correos + hoja de desempeños |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Instalación como app (PWA) y caché offline si se publica en un sitio https |

## 1. Activar los correos (15 minutos, una sola vez)

1. Inicie sesión en Google **con la cuenta del canal de YouTube SocialesLab**.
2. Cree una Hoja de cálculo nueva: *Seguimiento Saber 11 – Décimo 1*.
3. Menú **Extensiones → Apps Script**. Borre el contenido y pegue `Code.gs`. Guarde.
4. En el selector de funciones elija `configurarYProbar` → **Ejecutar** → autorice los permisos. Llega un correo de prueba y se crean las hojas `Entradas`, `Sesiones`, `Respuestas`, `Resumen`.
5. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Copie la URL que termina en `/exec`.
7. Abra `index.html` con el Bloc de notas, busque `ENDPOINT: ""` y pegue la URL entre las comillas:
   ```js
   ENDPOINT: "https://script.google.com/macros/s/XXXXXXXX/exec",
   ```
8. Cambie también `TEACHER_PIN: "Segovia2026"` por su PIN. Guarde.

## 2. Distribuir la app

| Vía | Sin internet | Instalable | Cómo |
|---|---|---|---|
| Archivo `index.html` por WhatsApp/USB | Sí, siempre | No | El estudiante lo abre con Chrome desde Descargas |
| GitHub Pages / Netlify (https) | Sí, tras la primera apertura | Sí (“Agregar a pantalla de inicio”) | Suba los 6 archivos de la carpeta |

## 3. Flujo de registro

```
Entrada  → evento ENTRADA  → cola local → (si hay red) Apps Script → correo 🟢 + hoja Entradas
Práctica → respuestas guardadas en el dispositivo (tiempo por ítem, competencia, eje)
Salir    → evento CIERRE   → correo ⏱️ (tiempo activo, aciertos, PS/IAP/PRS, nivel,
                              fortaleza, debilidad, ejes <60 %) + hojas Sesiones/Respuestas/Resumen
Sin red  → todo queda en cola y se envía solo al reconectarse (el correo indica “registro diferido”)
Cierre sin pulsar “Salir” → el tiempo se recupera en la siguiente apertura (marcado “recuperado”)
```

- **Tiempo**: solo cuenta mientras la app está visible en pantalla.
- **Nivel estimado**: <40 % N1 · 40–59 % N2 · 60–79 % N3 · ≥80 % N4. Es una escala interna por aciertos, no el puntaje ICFES.
- **Acceso del estudiante**: nombre + número de matrícula.
- **Duplicados**: cada evento tiene ID único; el script descarta repetidos.

## 4. Límites técnicos

- Gmail personal permite ~100 correos/día con Apps Script. 17 estudiantes × 2 correos por sesión ≈ 34/día. Si satura, ponga `NOTIFICAR_ENTRADAS: false` y conserve solo los cierres.
- Si cambia `Code.gs`, use **Implementar → Gestionar implementaciones → Editar → Nueva versión** (la URL se mantiene).
- El panel docente dentro de la app muestra solo los datos del dispositivo; el consolidado está en la hoja `Resumen`.

## 5. Banco de ítems

40 ítems originales (uno por eje de la ruta S01–S40), selección múltiple con única respuesta, retroalimentación por opción.

| Competencia | Ítems |
|---|---|
| PS · Pensamiento social | 15 |
| IAP · Interpretación y análisis de perspectivas | 14 |
| PRS · Pensamiento reflexivo y sistémico | 11 |

Claves: 10 A · 10 B · 10 C · 10 D, en orden aleatorio, sin tres iguales seguidas. La clave es la opción más larga en 8 de los 40 ítems, una proporción cercana al azar.
