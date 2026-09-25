# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [1.0.0] - 2026-09-25

### Añadido
- Detección automática y selección interactiva de archivos `.zip`.
- Descompresión en directorio temporal nativo sin dependencias de terceros.
- Descarga asíncrona de recursos alojados en `googleusercontent.com` con guardado en `assets/images/`.
- Extracción desacoplada de CSS a `assets/css/styles.css` con reescritura de URLs de fondo.
- Extracción de scripts en línea a `assets/js/main.js` respetando scripts externos (CDN).
- Formateador simple nativo (beautify) para HTML y CSS.
- Filtrado automático de archivos residuales (`screen.png`, `DESIGN.md`, `code.html`).
- Soporte multiplataforma garantizado para Windows y macOS.