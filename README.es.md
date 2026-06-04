# PBIP Lens

[Read in English](README.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://marketplace.visualstudio.com)
[![Status: Production Ready](https://img.shields.io/badge/Status-v0.4.5--Stable-green.svg)](#)

**PBIP Lens** es un Analizador Estático Avanzado y Linter de Arquitectura diseñado para proyectos de desarrollo de Power BI (`.pbip`, `.tmdl`, `.pbir`).

Desarrollado para Ingenieros de BI y Arquitectos de Datos, PBIP Lens analiza los archivos de definición del modelo tabular (TMDL) y los esquemas visuales de los reportes en un gráfico semántico consolidado. Automatiza las auditorías de modelos, mapea linajes complejos de DAX y valida políticas de gobernanza corporativas tanto de forma local en el IDE como de forma automatizada en pipelines de CI/CD.

---

## El desafío del BI Empresarial

A medida que los modelos de BI empresariales crecen, acumulan inevitablemente deuda técnica: medidas obsoletas, columnas no documentadas y convenciones de nomenclatura inconsistentes. Eliminar o refactorizar estos activos conlleva un riesgo enorme de romper silenciosamente reportes visuales o cálculos de DAX anidados.

**PBIP Lens** resuelve esto convirtiendo el código fuente de tu proyecto de Power BI en un grafo de dependencias detallado e interactivo. Mapea relaciones desde columnas físicas a través de múltiples capas de cálculos DAX anidados, hasta su uso final dentro de los visuales de reportes individuales. Te dice exactamente qué está activo, qué está huérfano y qué es seguro modificar o eliminar.

---

## Installaión Dual

Para dar soporte a todo el ciclo de vida del BI, PBIP Lens se distribuye en dos formatos:

### A. La Extensión de IDE (Desarrollo Local)
Instala la extensión de VS Code directamente desde el Marketplace para obtener una interfaz visual, paneles laterales interactivos y enlaces de edición de código directa.
* Busca **PBIP Lens** en las Extensiones de VS Code y haz clic en **Instalar**.

### B. La Interfaz de Línea de Comandos / CLI (Pipelines CI/CD)
Instala la utilidad CLI de forma global o local en tu entorno de ejecución para aplicar los estándares de modelo de forma automatizada en cada confirmación (commit).
```bash
# Instalar globalmente mediante npm
npm install -g pbip-lens

# O ejecutar al instante con npx
npx pbip-lens <ruta-al-proyecto>
```

---

## La CLI & CI/CD Integration

PBIP Lens actúa como el guardián de la arquitectura de tu proyecto de BI, evitando que modelos semánticos defectuosos o con violaciones lleguen a los entornos de producción.

Cuando se ejecuta sobre la ruta de tu repositorio, el CLI construye el grafo del modelo semántico, ejecuta el motor de auditoría contra las políticas configuradas y genera un reporte formateado agrupado por nivel de severidad (`ERRORS` vs `WARNINGS`).

### Guardián del Pipeline (Códigos de Salida)
El CLI opera bajo reglas estrictas de ejecución para automatizar filtros de calidad en CI/CD:
* **Código de Salida `0` (PASSED)**: El modelo está limpio o contiene únicamente violaciones de nivel `warn` (advertencia).
* **Código de Salida `1` (FAILED)**: El modelo contiene una o más violaciones de nivel `error`. Esto romperá la ejecución del pipeline del build o pull request.

```bash
$ pbip-lens ./mi-proyecto-powerbi

Resolving target project path: /home/runner/work/mi-proyecto-powerbi
Loaded rules configuration: {"orphan-node":"error","missing-description":"warn"}
Starting project pipeline processing...
Audit analysis completed.

=== PBIP LENS LINTER REPORT ===

ERRORS (1):
  - [orphan-node] Node: 'Sales'[Total Revenue Obsolete] (_Measures.tmdl:42) | Message: Node 'Sales'[Total Revenue Obsolete] is orphan (no incoming dependencies).

WARNINGS (1):
  - [missing-description] Node: 'Products'[Margin] (Products.tmdl:12) | Message: Node 'Products'[Margin] is missing a description.

SUMMARY:
  - Errors: 1
  - Warnings: 1

Result: FAILED (Exit Code: 1 due to error-level violations)
```

---

## Gobernanza & Configuración

Puedes personalizar completamente el cumplimiento de políticas mediante un archivo `.pbiplensrc.json` colocado en el directorio raíz de tu proyecto de Power BI.

### Estructura del Archivo de Configuración
```json
{
  "rules": {
    "orphan-node": "error",
    "missing-description": "warn"
  },
  "ignore": [
    "*Temp*",
    "System_*",
    "definition/tables/LogTable.tmdl"
  ]
}
```

### Opciones de Configuración
1. **Severidades de Regla**: Las reglas individuales se pueden mapear a uno de tres niveles:
   - `error`: Activa un error que rompe el pipeline (sale con código `1`).
   - `warn`: Imprime una advertencia coloreada en stdout, pero no bloquea el pipeline (sale con código `0`).
   - `off`: Desactiva la evaluación de la regla por completo.
2. **Valores por Defecto Estrictos**: Si no se encuentra ningún `.pbiplensrc.json` en la raíz del proyecto, PBIP Lens asume por defecto una **configuración estricta de error** (todas las reglas integradas establecidas en `error`).
3. **Lista de Exclusiones (`ignore`)**: Excluye archivos, tablas o medidas específicas del análisis linter proporcionando coincidencias exactas, subcadenas o patrones de comodín (por ejemplo, `*Temp*` o `System_*`).

---

## 5. VS Code Node Inspector

Para el desarrollo y refactorización local, PBIP Lens proporciona un panel interactivo premium de **Inspector de Nodo** dentro de Visual Studio Code.

* **Definiciones DAX Limpias**: Visualiza expresiones de medidas formateadas con resaltado de sintaxis, libres de metadatos de formato o etiquetas de linaje.
* **Árbol de Linaje Granular**: Inspecciona dependencias upstream (de qué depende esta medida) y downstream (qué visuales o medidas anidadas la consumen).
* **Advertencias de Títulos Visuales**: Resalta cuando un visual consume una medida pero no tiene un título explícito configurado.
* **Refactorización Instantánea**: Elimina físicamente medidas huérfanas del disco con un solo clic, directamente desde el panel del inspector.
* **Navegación al Código Fuente**: Haz doble clic en cualquier nodo del explorador de árbol para abrir el archivo de definición `.tmdl` correspondiente con el cursor colocado exactamente en la línea fuente de la definición.

---

## Detalles Técnicos y Arquitectura

* **Analizador Tabular (TMDL)**: Interpreta las especificaciones del lenguaje de definición del modelo tabular (TMDL), manejando bloques de diseño y expresiones de múltiples líneas.
* **Resolución de Esquemas Visuales**: Analiza a fondo el formato visual moderno `.pbir` y los JSON de diseño de Power BI para detectar usos en formatos dinámicos, tooltips y títulos condicionales.
* **100% Local y Seguro**: Ningún dato de esquema, código o metadato se transmite a servidores externos. Tu propiedad intelectual corporativa permanece por completo dentro de tu red segura.

---

## Licencia

Este proyecto está licenciado bajo la Licencia MIT; consulta el archivo [LICENSE](LICENSE) para obtener más detalles.
