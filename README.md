# Stitch Unpack 🚀

Herramienta CLI multiplataforma (Windows y macOS) sin dependencias externas para transformar exportaciones `.zip` de **Google Stitch** en proyectos web estáticos limpios, desacoplados y listos para producción.

---

## ⚡ ¿Qué problema resuelve?

Google Stitch exporta prototipos funcionales dentro de un único archivo monolítico (`code.html`), pero con dos inconvenientes principales:
1. **Recursos temporales:** Las imágenes se vinculan a URLs efímeras de `googleusercontent.com` que expiran o presentan bloqueos en producción.
2. **Código acoplado:** Todo el CSS y JavaScript se encuentra incrustado dentro del HTML.

`stitch-unpack` automatiza la transición a producción:
* ✅ Descomprime el `.zip` en un contenedor temporal aislado.
* ✅ Extrae los bloques `<style>` a `assets/css/styles.css`.
* ✅ Extrae los scripts en línea a `assets/js/main.js`.
* ✅ Descarga automáticamente todas las imágenes remotas a `assets/images/` y reescribe las rutas tanto en el HTML como en el CSS.
* ✅ Aplica formato limpio (*beautify*) al HTML y CSS.
* ✅ Descarta archivos irrelevantes de previsualización (`screen.png`, `DESIGN.md`).
* ✅ Conserva el archivo `.zip` original intacto.

---

## 📁 Estructura del proyecto generado

```text
nombre-del-zip/
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── main.js
│   └── images/
│       ├── img_1.webp
│       └── img_2.webp
└── index.html
```

---

## 🛠️ Requisitos

* **Node.js** (versión 18 o superior).
* No requiere instalar paquetes de npm (`0 dependencias`).

---

## 📦 Instalación

### Método universal (Vía npm link)

Clona este repositorio y entra en la carpeta:

```bash
git clone https://github.com/TU_USUARIO/stitch-unpack.git
cd stitch-unpack
npm link
```

A partir de este momento, el comando `stitch-unpack` estará disponible en cualquier terminal de tu sistema.

---

## 🚀 Uso

### 1. Detección automática (Interactivo)
Colócate en la carpeta donde tienes tu archivo `.zip` descargado desde Stitch y ejecuta:

```bash
stitch-unpack
```
* Si hay un solo archivo `.zip`, se procesará automáticamente.
* Si hay varios, te permitirá seleccionar cuál procesar mediante un menú numérico.

### 2. Pasando el archivo por parámetro
```bash
stitch-unpack mi-landing.zip
```

---

## 📄 Licencia

MIT