# Historial de Cambios (Changelog)

Todos los cambios notables en la extensión **PBIP Lens** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.3] - 2026-06-04
### Corregido
- **Intercepción de Argumentos CLI:** Se añadió soporte para manejar banderas de ayuda (`--help`/`-h`) y versión (`--version`/`-v`) de forma que salgan limpiamente de la ejecución, evitando fallos de procesamiento cuando se invocan estas opciones.

## [0.4.2] - 2026-06-04
### Corregido
- **Ajuste de Ignorado de NPM:** Se refinó `.npmignore` para excluir las carpetas `test/` (espacios de prueba simulados) y `webview/` (fuentes de desarrollo de la webview), reduciendo el tamaño del paquete NPM y solucionando fallos en `vsce package`.

## [0.4.1] - 2026-06-04
### Corregido
- **Configuración de Empaquetado:** Se eliminó el bloque restrictivo `files` de `package.json` y se introdujo `.npmignore` para solucionar errores durante el proceso de empaquetado de la extensión (`vsce package`).

## [0.4.0] - 2026-06-04
### Añadido
- **Modo Linter para CLI y CI/CD:** Incorporación del motor de ejecución CLI (`pbip-lens`) para la validación automatizada de modelos semánticos en entornos desatendidos.
- **Configuración de Severidad de Reglas:** Soporte para mapear reglas del linter (`error` | `warn` | `off`) mediante un archivo de configuración `.pbiplensrc.json` en la raíz del proyecto.
- **Lista de Exclusiones (Patrones de Ignorado):** Soporte de comodines y subcadenas (`ignore`) para omitir el análisis de tablas temporales, medidas del sistema o archivos `.tmdl` específicos.
- **Adaptador de Log para Consola:** Implementación de `ConsoleLogger` con códigos de color ANSI y separación de flujos stdout/stderr para reportes en terminal.

### Cambiado
- **Cumplimiento Legal de Licencia:** Migración de la licencia del proyecto de MIT a Apache License 2.0 para garantizar el cumplimiento corporativo.
- **Política por Defecto del Linter:** Adopción de un modo estricto de error por defecto cuando no se detecta archivo de configuración, rompiendo los pipelines automáticamente ante cualquier deuda arquitectónica.

## [0.3.1] - 2026-05-28
### Corregido
- **Sincronización de Documentación:** Se actualizaron el Changelog y el README para reflejar los cambios arquitectónicos masivos introducidos en la versión `0.3.0`.

## [0.3.0] - 2026-05-28
### Añadido
- **Núcleo Arquitectónico C²E:** Reescritura completa del pipeline de extracción utilizando una Arquitectura Hexagonal pura (Contract-Context-Execution).
- **Motor de Grafo Semántico:** Mapeo determinista de 360° de todas las relaciones del modelo tabular, dependencias DAX y uso en visuales.
- **Linter basado en Patrón Strategy:** Nuevo `AuditEngine` con reglas extensibles para detectar deuda técnica (`OrphanNodeRule`, `MissingDescriptionRule`).
- **Parser de Relaciones Físicas:** Escaneo profundo de `relationships.tmdl` para construir aristas (edges) bidireccionales, eliminando los falsos positivos en llaves primarias/foráneas.
- **Parser de Documentación TMDL:** Extracción nativa de comentarios de documentación estilo XML (`///`) de medidas y columnas DAX.
- **Interfaz de Diagrama Relacional:** El Inspector de Nodo ahora renderiza dinámicamente diagramas visuales estilo ER (Entidad-Relación) para las relaciones de filtrado cruzado.

### Cambiado
- **Reestructuración del Inspector de Nodo:** Se desaprobó y eliminó la barra de progreso obsoleta de "Orphan Score". Fue reemplazada por Niveles de Impacto estrictos y un panel localizado de Hallazgos del Linter (Linter Findings).
- **Etiquetado Semántico (Badging):** La interfaz ahora mapea explícitamente las dependencias estructurales con etiquetas específicas (ej. `RELATIONSHIP`) en lugar de usar agrupaciones genéricas ("Otros").
- **Branding de Marketplace:** Se actualizó el ícono de la extensión a un tema oscuro sólido de alto contraste para garantizar visibilidad universal en la web y en cualquier tema del IDE.

### Eliminado
- Se eliminaron los métodos de extracción heredados basados en expresiones regulares simples que fallaban ante formatos TMDL complejos.

## [0.2.0] - 2026-05-27
### Añadido
- Lanzamiento interno de puente arquitectónico (Transición a la metodología C²E). Reemplazado inmediatamente por la versión `0.3.0` para su lanzamiento público en el Marketplace.

## [0.1.3] - 2026-04-10

### Agregado
- **Modelo Semántico Modular**: Escaneo limitado estrictamente al directorio `definition/`, ignorando artefactos en `TMDLScripts` o del historial.
- **Soporte para Carpetas de Visualización**: Agrupación automática de Medidas y Columnas por su propiedad `displayFolder` en las vistas de árbol.
- **Explorador de Consultas (preview)**: Nueva vista para explorar scripts de Power Query (M), particiones y expresiones globales.
- **Explorador de Relaciones (dev)**: Soporte inicial para navegar las relaciones del modelo (visible en modo de desarrollo).
- **Metadatos Avanzados**: Inclusión de `filePath` y metadatos de linaje en las medidas para facilitar la auditoría.
- **Sistema de Feature Flags**: Gestión de estado robusta (`dev`/`preview`/`prod`) para controlar la visibilidad y distintivos de las características.
- **Probador de Estrés Nativo**: Mejora en `stress_tester.py` para inyectar más de 8,000 medidas clonadas con lógica DAX real y referencias cruzadas.

### Cambiado
- **Optimización de Parser**: El parser de TMDL ahora extrae `displayFolder`, expresiones M y metadatos de relaciones.
- **Refactorización de UI**: Gestión del ciclo de vida mejorada para Tree Views (previniendo fugas de memoria) y comandos de jerarquía sincronizados (Expandir/Colapsar) en todos los exploradores.

### Solucionado
- **Registro de Vistas**: Corrección del registro de vistas secundarias para prevenir errores de "TreeDataProvider no encontrado" durante la expansión de jerarquías.
- **Escáner de Archivos**: Solución a un error por el cual scripts TMDL antiguos en carpetas periféricas causaban advertencias de medidas duplicadas.


## [0.1.2] - 2026-04-08

### Agregado
- **UI 2.0 (Vistas de Bienvenida)**: Implementación de botones destacados de "Auditar Proyecto" cuando no hay datos cargados, mejorando la adopción inicial.
- **Controles de Jerarquía**: Acciones de "Expandir Todo" y "Colapsar Todo" en el título de la vista y en los menús contextuales.
- **Icono de Actualización**: Reemplazo del icono de reproducción estándar por un icono de actualización de VS Code para las actualizaciones de auditoría.

### Solucionado
- **Visibilidad de Vista de Bienvenida**: Solución al problema donde elementos de marcador de posición ocultaban los botones de bienvenida.

## [0.1.1] - 2026-04-08

### Agregado
- **Dependencias de Columnas Calculadas (Sexto Pilar)**: Rastreo entre columnas calculadas y sus dependencias.
- **Indicadores Visuales**: Iconos de tipo (Medida/Columna) en las listas de dependencias dentro del dashboard.

### Solucionado
- **Sensibilidad a Mayúsculas Universal**: Búsquedas insensibles a mayúsculas para medidas y columnas en expresiones DAX.
- **Detección de Relaciones Mejorada**: Soporte para la notación de punto (`Tabla.Columna`) en definiciones de relaciones.
- **Estabilidad del Dashboard**: Solución de errores de "conteos en 0" y "contenido no encontrado" en los Dashboards de Columnas.
- **Estabilidad del Árbol de UI**: Solución de caídas (`undefined`) al expandir medidas o columnas en la barra lateral.

## [0.1.0] - 2026-04-08

### Agregado
- **Explorador de Tablas**: Nueva vista nativa en la barra lateral de VS Code para explorar tablas y columnas de forma independiente.
- **Explorador de Medidas**: Vista dedicada para medidas DAX con categorización de "En Uso" y "Huérfanas".
- **Auditoría Avanzada de Columnas (Los 4 Pilares)**:
    - Detección de claves de relaciones (claves primarias y foráneas).
    - Identificación del destino de Sort-By Column.
    - Rastreo de dependencias DAX (uso en medidas).
    - Análisis de impacto RLS (Row Level Security).
- **Dashboard de Columnas**: Reporte interactivo en Markdown para cada columna, proporcionando un análisis profundo de su uso y metadatos.
- **Arquitectura Limpia**: Refactorización completa del backend utilizando patrones modulares (Modelos, IO, Parsers, Grafo).
- **Navegación**: Funcionalidad de clic para ir a la fuente directamente a los archivos `.tmdl` de Medidas y Columnas.

### Cambiado
- Refactorización de TMDL Parser para gestionar correctamente nombres con caracteres literales complejos y corchetes.
- Optimización del escaneo de espacios de trabajo para dar soporte a estructuras de datasets y reportes PBIP anidados.
- Optimización de la resolución de dependencias DAX utilizando un motor de grafos BFS (Breadth-First Search).

### Solucionado
- Solución de un problema de truncamiento donde los nombres de tablas y columnas mostraban solo el primer carácter.
- Eliminación de errores de linter "fantasma" al limpiar archivos monolíticos obsoletos.

---
*Mantenido por Nara Technologies*
