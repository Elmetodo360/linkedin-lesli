# App de revisión de posts LinkedIn — Supply Chain

Mini-app temporal para que Lesli revise los 16 posts (martes 08:00) y marque, en cada uno:
**Lo apruebo / Con cambios / No lo quiero** + notas. Las respuestas se guardan en una Google Sheet que lee Chema para adaptar los textos definitivos.

## Estructura
```
04_App/
├── index.html      # interfaz
├── styles.css
├── app.js          # lógica + guardado (Sheets + respaldo local)
├── config.js       # <-- rellenar: nombre + URL del Web App
├── posts.json      # los 16 posts (generado desde POSTS_16_DEFINITIVOS.md)
└── backend/Code.gs # Apps Script (backend Google Sheets)
```

## Puesta en marcha (3 pasos)

### 1) Backend (Google Sheets + Apps Script)
1. Crea una Hoja de cálculo nueva (en `elmetodo360@gmail.com` o la cuenta que prefieras).
2. **Extensiones → Apps Script**. Borra lo que haya y pega `backend/Code.gs`. Guarda.
3. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos. Copia la **URL del Web App**.

### 2) Configurar la app
En `config.js`:
- `reviewerName`: su nombre (ej. `"María"`).
- `appsScriptUrl`: pega la URL del Web App del paso anterior.

### 3) Publicar (GitHub Pages)
- Sube `04_App/` a un repositorio (o subcarpeta) y activa **GitHub Pages**.
- Comparte la URL con ella. Funciona en móvil y ordenador.

> **Sin backend configurado**, la app funciona igual pero guarda solo en el navegador de ella (modo local). Útil para probar.

## Cómo leo sus respuestas
- En la Google Sheet, pestaña **Revisiones**: una fila por post con decisión, notas y fecha.
- Con eso, Chema/Catalina adapta los textos: aplica los "con cambios", descarta los "No" y deja listos los aprobados.

## Notas técnicas
- Escritura: `POST` text/plain en modo `no-cors` (evita preflight CORS). Patrón ya usado en otras apps del ecosistema.
- Lectura/resume: JSONP (`?action=list&callback=`), porque Apps Script no envía cabeceras CORS en GET.
- Respaldo: todo se guarda también en `localStorage`, así que aunque falle la red no se pierde su trabajo.
- Para regenerar `posts.json` tras editar los textos: `python _build/parse_posts.py`.
