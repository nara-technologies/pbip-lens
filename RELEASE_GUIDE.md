# Guía de Publicación (Release Guide) 🚀

Esta guía detalla el proceso obligatorio para lanzar nuevas versiones de **PBIP Lens**, asegurando consistencia en el versionado y calidad en el empaquetado.

## 1. Preparación y QA

Antes de versionar, realiza las siguientes validaciones:

- [ ] **Compilación**: Ejecuta `npm run compile` y verifica que no haya errores de TypeScript o Webpack.
- [ ] **Feature Flags**: Revisa `src/core/config/featureFlags.ts`. Asegúrate de que las features en `dev` estén ocultas para producción y las de `preview` tengan su badge.
- [ ] **Pruebas de Estrés**: Corre `python scripts/stress_tester.py --count 5000` y verifica que la extensión responda fluidamente en el modo de auditoría.
- [ ] **Limpieza**: Ejecuta `python scripts/stress_tester.py --reset` para no incluir medidas de prueba en el repo.

## 2. Versionado de Archivos

Sigue el estándar de [Semantic Versioning](https://semver.org/).

- [ ] **package.json**: Incrementa la propiedad `"version"`.
- [ ] **CHANGELOG.md**:
    - Agrega una nueva sección con el formato: `## [X.Y.Z] - YYYY-MM-DD`.
    - Clasifica los cambios en `Added`, `Changed`, `Fixed`.
- [ ] **README.md**: Actualiza el badge de estado (`Status: vX.Y.Z--Stable`).

## 3. Empaquetado VSIX (Opcional pero recomendado)

Para verificar qué verá el usuario final:

- [ ] Ejecuta `vsce package`.
- [ ] Instala el `.vsix` resultante en una instancia limpia de VS Code.
- [ ] Verifica que las vistas marcadas como `dev` **NO** aparezcan.

## 4. Git y GitHub

El proceso final de publicación en el repositorio:

```powershell
# 1. Stagear cambios de versionado y docs
git add package.json CHANGELOG.md README.md
git commit -m "chore: release vX.Y.Z"

# 2. Crear el Tag (crucial para tracking)
git tag vX.Y.Z

# 3. Pushing
git push origin main
git push origin vX.Y.Z
```

## 5. Criterios de Promoción de Features

Para mover una funcionalidad entre estados en `featureFlags.ts`:

1.  **Dev → Preview**: La feature es funcional, no causa crashes y tiene valor para el usuario, pero la UI o los metadatos podrían cambiar.
2.  **Preview → Prod**: La feature ha sido probada en modelos grandes, el feedback es positivo y la estructura de datos es estable. No requiere badge de advertencia.

---
*Mantenido por Nara Technologies - 2026*
