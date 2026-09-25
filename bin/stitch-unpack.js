#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

function unzipFile(zipPath, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const platform = process.platform;

  if (platform === 'darwin') {
    /* macOS: ditto es la herramienta nativa preferida de Apple para preservar metadatos de archivos */
    try {
      execSync(`ditto -xk "${zipPath}" "${targetDir}"`, { stdio: 'ignore' });
    } catch (err) {
      /* Respaldo tradicional con unzip de BSD */
      execSync(`unzip -q "${zipPath}" -d "${targetDir}"`, { stdio: 'ignore' });
    }
  } else if (platform === 'win32') {
    /* Windows: tar viene preinstalado desde Windows 10 */
    try {
      execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'ignore' });
    } catch (err) {
      /* Respaldo PowerShell si tar tuviera restricciones */
      const psCommand = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`;
      execSync(psCommand, { stdio: 'ignore' });
    }
  } else {
    /* Linux y otros entornos Unix */
    execSync(`unzip -q "${zipPath}" -d "${targetDir}"`, { stdio: 'ignore' });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function formatHtml(html) {
  let formatted = '';
  let indent = 0;
  const tab = '  ';
  const tokens = html.replace(/>\s*</g, '><').match(/(<[^>]+>|[^<]+)/g) || [];
  const selfClosing = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

  tokens.forEach((token) => {
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      formatted += tab.repeat(indent) + token + '\n';
    } else if (token.startsWith('<') && !token.startsWith('<!')) {
      const tagNameMatch = token.match(/^<([a-zA-Z0-9]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : '';
      const isSelfClosing = token.endsWith('/>') || selfClosing.test(tagName);

      formatted += tab.repeat(indent) + token + '\n';
      if (!isSelfClosing) indent++;
    } else {
      const text = token.trim();
      if (text.length > 0) {
        formatted += tab.repeat(indent) + text + '\n';
      }
    }
  });

  return formatted.trim();
}

function formatCss(css) {
  return css
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*/g, ' {\n  ')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\s*}\s*/g, '\n}\n\n')
    .trim();
}

async function selectZipFile() {
  const cliArg = process.argv[2];
  if (cliArg) {
    const resolvedPath = path.resolve(process.cwd(), cliArg);
    if (fs.existsSync(resolvedPath) && resolvedPath.endsWith('.zip')) {
      return resolvedPath;
    }
    console.error(`El archivo especificado no existe o no es un zip: ${cliArg}`);
    return null;
  }

  const zipFiles = fs.readdirSync(process.cwd()).filter((f) => f.endsWith('.zip'));

  if (zipFiles.length === 0) {
    console.error('No se encontro ningun archivo .zip en esta carpeta.');
    return null;
  }

  if (zipFiles.length === 1) {
    return path.join(process.cwd(), zipFiles[0]);
  }

  console.log('\nSe encontraron varios archivos .zip:');
  zipFiles.forEach((file, index) => {
    console.log(`  [${index + 1}] ${file}`);
  });

  const answer = await askQuestion('\nIngresa el numero del archivo que deseas procesar: ');
  const selectedIndex = parseInt(answer.trim(), 10) - 1;

  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= zipFiles.length) {
    console.error('Seleccion invalida.');
    return null;
  }

  return path.join(process.cwd(), zipFiles[selectedIndex]);
}

async function run() {
  const currentPlatform = process.platform === 'darwin' ? 'macOS' : (process.platform === 'win32' ? 'Windows' : 'Linux');
  console.log(`\nEntorno detectado: ${currentPlatform}`);

  const zipPath = await selectZipFile();
  if (!zipPath) {
    rl.close();
    return;
  }

  const zipBaseName = path.basename(zipPath, '.zip');
  const outputDir = path.join(process.cwd(), zipBaseName);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-unpack-'));

  console.log(`\n--- Procesando: ${path.basename(zipPath)} ---`);

  try {
    /* 1. Descomprimir en directorio temporal nativo */
    console.log('Descomprimiendo en contenedor temporal...');
    unzipFile(zipPath, tempDir);

    /* 2. Localizar archivo HTML de entrada */
    const tempFiles = fs.readdirSync(tempDir);
    const htmlFiles = tempFiles.filter((f) => f.endsWith('.html'));

    if (htmlFiles.length === 0) {
      console.error('El zip no contiene ningun archivo .html.');
      return;
    }

    const sourceHtmlFile = htmlFiles.includes('code.html') ? 'code.html' : htmlFiles[0];
    console.log(`Archivo HTML detectado: ${sourceHtmlFile}`);

    /* 3. Definir nombre de salida */
    const defaultTarget = 'index.html';
    let targetName = await askQuestion(`\n¿Nombre del archivo HTML para produccion? (Enter para '${defaultTarget}'): `);
    targetName = targetName.trim() || defaultTarget;
    if (!targetName.endsWith('.html')) targetName += '.html';

    /* 4. Estructurar carpetas de assets */
    const assetsDir = path.join(outputDir, 'assets');
    const imagesDir = path.join(assetsDir, 'images');
    const cssDir = path.join(assetsDir, 'css');
    const jsDir = path.join(assetsDir, 'js');

    [imagesDir, cssDir, jsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    let htmlContent = fs.readFileSync(path.join(tempDir, sourceHtmlFile), 'utf8');

    /* 5. Extraer CSS */
    console.log('\nExtrayendo estilos CSS...');
    let extractedCss = '';
    htmlContent = htmlContent.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, cssBody) => {
      extractedCss += cssBody + '\n';
      return '';
    });

    if (extractedCss.trim().length > 0) {
      const linkTag = '  <link rel="stylesheet" href="./assets/css/styles.css">\n';
      if (!htmlContent.includes('./assets/css/styles.css')) {
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `${linkTag}</head>`);
        } else {
          htmlContent = linkTag + htmlContent;
        }
      }
    }

    /* 6. Extraer JavaScript en linea */
    console.log('Extrayendo scripts JS en linea...');
    let extractedJs = '';
    htmlContent = htmlContent.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (_, jsBody) => {
      extractedJs += jsBody + '\n';
      return '';
    });

    if (extractedJs.trim().length > 0) {
      const scriptTag = '  <script src="./assets/js/main.js" defer></script>\n';
      if (!htmlContent.includes('./assets/js/main.js')) {
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${scriptTag}</body>`);
        } else {
          htmlContent += '\n' + scriptTag;
        }
      }
    }

    /* 7. Descargar y reescribir recursos externos */
    console.log('Buscando y descargando recursos externos...');
    const urlRegex = /https:\/\/[a-zA-Z0-9.\-_]+\.googleusercontent\.com\/[^\s"'()]+/g;
    const allMatches = new Set([
      ...(htmlContent.match(urlRegex) || []),
      ...(extractedCss.match(urlRegex) || [])
    ]);

    const urlMap = new Map();
    let imgCount = 1;

    for (const url of allMatches) {
      let ext = 'webp';
      if (url.includes('.png')) ext = 'png';
      else if (url.includes('.jpg') || url.includes('.jpeg')) ext = 'jpg';
      else if (url.includes('.svg')) ext = 'svg';

      const filename = `img_${imgCount++}.${ext}`;
      const localDest = path.join(imagesDir, filename);

      console.log(`   Descargando: ${filename}`);
      await downloadFile(url, localDest);

      urlMap.set(url, {
        htmlPath: `./assets/images/${filename}`,
        cssPath: `../images/${filename}`
      });
    }

    urlMap.forEach((paths, originalUrl) => {
      htmlContent = htmlContent.replaceAll(originalUrl, paths.htmlPath);
    });

    /* 8. Guardar CSS */
    if (extractedCss.trim().length > 0) {
      urlMap.forEach((paths, originalUrl) => {
        extractedCss = extractedCss.replaceAll(originalUrl, paths.cssPath);
      });
      fs.writeFileSync(path.join(cssDir, 'styles.css'), formatCss(extractedCss), 'utf8');
      console.log('Archivo generado: assets/css/styles.css');
    }

    /* 9. Guardar JS */
    if (extractedJs.trim().length > 0) {
      fs.writeFileSync(path.join(jsDir, 'main.js'), extractedJs.trim(), 'utf8');
      console.log('Archivo generado: assets/js/main.js');
    }

    /* 10. Guardar HTML final (sin copiar screen.png ni DESIGN.md) */
    fs.writeFileSync(path.join(outputDir, targetName), formatHtml(htmlContent), 'utf8');

    console.log(`\n¡Proyecto limpio generado en: "${outputDir}"!`);
    console.log(`  HTML:      ${targetName}`);
    console.log(`  Recursos:  assets/ (css, js, images)`);
    console.log(`  Original:  ${path.basename(zipPath)} (intacto)`);

  } catch (error) {
    console.error('\nOcurrio un error al procesar el archivo:', error.message);
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
    rl.close();
  }
}

run();