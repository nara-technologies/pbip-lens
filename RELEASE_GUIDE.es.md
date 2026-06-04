# Guía de Publicación (Release Guide) 🚀

Esta guía detalla la lista de verificación obligatoria paso a paso para lanzar nuevas versiones de **PBIP Lens**, asegurando consistencia en el versionado, validación de empaquetado y calidad en la entrega.

## Lista de Verificación de Lanzamiento

Sigue estos pasos en orden al lanzar una nueva versión:

### 1. Validación y QA
- [ ] **Verificación del Código**: Ejecuta `pnpm run compile` y asegúrate de que no haya errores de TypeScript o Webpack.
- [ ] **Pruebas**: Ejecuta `pnpm test` (o `npm run test`) y confirma que todas las pruebas pasen con éxito.
- [ ] **Feature Flags**: Revisa `src/core/config/featureFlags.ts`. Asegúrate de que las funcionalidades en desarrollo (`dev`) estén desactivadas/ocultas en producción.
- [ ] **Pruebas de Estrés** (Opcional): Corre `python scripts/stress_tester.py --count 5000` para verificar el rendimiento en modelos a gran escala, y luego `python scripts/stress_tester.py --reset` para limpiar las medidas de prueba simuladas.

### 2. Determinar y Aplicar el Incremento de Versión
- [ ] **Determinar el Nivel de Cambio**:
  - **Patch** (ej., `0.4.1 -> 0.4.2`): Correcciones internas, ajustes de configuración del paquete (como modificaciones en `.npmignore`) o actualizaciones exclusivas de documentación.
  - **Minor** (ej., `0.4.0 -> 0.5.0`): Nuevas funcionalidades compatibles con versiones anteriores (nuevas reglas, parámetros CLI).
  - **Major** (ej., `0.4.0 -> 1.0.0`): Cambios disruptivos en la API, comandos CLI o lógica del núcleo.
- [ ] **Actualizar package.json**: Incrementa el campo `"version"` en [package.json](file:///d:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/package.json).

### 3. Sincronizar Todos los Archivos de Documentación
Cada lanzamiento exige actualizar rigurosamente los siguientes archivos:
- [ ] **README.md**: Actualiza la insignia de versión (`Status: vX.Y.Z--Stable`) en la cabecera del archivo.
- [ ] **README.es.md**: Actualiza la insignia de versión (`Status: vX.Y.Z--Stable`) en la cabecera del archivo.
- [ ] **CHANGELOG.md**:
  - Agrega un bloque al inicio bajo `## [X.Y.Z] - YYYY-MM-DD`.
  - Clasifica los cambios en `Added` (nuevas características), `Changed` (lógica modificada) y `Fixed` (corrección de errores).
- [ ] **CHANGELOG.es.md**:
  - Agrega el bloque correspondiente bajo `## [X.Y.Z] - YYYY-MM-DD`.
  - Clasifica los cambios en `Añadido`, `Cambiado` y `Corregido`.
- [ ] **RELEASE_GUIDE.md y RELEASE_GUIDE.es.md**: Actualiza cualquier ejemplo de referencia al último número de versión si es relevante.

### 4. Ajustes de Distribución y Empaquetado
- [ ] **Verificar Exclusiones**: Inspecciona `.npmignore` y `.vscodeignore` para garantizar que las carpetas de desarrollo (como `src/`, `tests/`, espacios de trabajo simulados `test/` y código frontend `webview/`) estén correctamente excluidas, de modo que solo los artefactos compilados bajo `/dist` se incluyan en el paquete.
- [ ] **Empaquetado Webpack**: Ejecuta `pnpm run package` (compilación de webpack) para comprobar que el bundle de producción se compila sin errores.
- [ ] **Validar Empaquetado VSIX Local**: Compila la extensión localmente usando `npx @vscode/vsce package` (o `vsce package`). Asegúrate de que se complete sin errores y genere el archivo `.vsix` correctamente.

### 5. Git Commit y Etiquetado
Una vez completadas y validadas las compilaciones y el empaquetado, procede a confirmar los cambios y etiquetar:
- [ ] **Stagear Cambios**:
  ```powershell
  git add package.json README.md README.es.md CHANGELOG.md CHANGELOG.es.md RELEASE_GUIDE.md RELEASE_GUIDE.es.md .npmignore
  ```
- [ ] **Confirmar Archivos (Commit)**:
  ```powershell
  git commit -m "chore(release): bump version to X.Y.Z and update documentation"
  ```
- [ ] **Crear Etiqueta Git Anotada (Tag)**:
  ```powershell
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  ```

### 6. Sincronización Remota y Publicación
- [ ] **Subir Commits y Etiquetas (Push)**:
  ```powershell
  git push origin <rama-actual>
  git push origin vX.Y.Z
  ```
- [ ] **Publicar Extensión VS Code**: Sube la extensión al Visual Studio Code Marketplace usando:
  ```powershell
  npx @vscode/vsce publish
  ```
- [ ] **Publicar Paquete CLI NPM**: Publica el CLI en NPMJS usando:
  ```powershell
  npm publish
  ```

---

*Mantenido por Nara Technologies - 2026*
