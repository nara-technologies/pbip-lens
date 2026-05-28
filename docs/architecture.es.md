# PBIP Lens: Estructura del Proyecto y Arquitectura

Este documento detalla la estructura completa de directorios del proyecto PBIP Lens, describe su arquitectura hexagonal (Ports & Adapters), la implementación del patrón Strategy en el motor de linter, y la inicialización de las clases principales del núcleo.

---

## 1. Árbol de Directorios Completo del Proyecto

A continuación se muestra la estructura jerárquica de todos los archivos y carpetas en el espacio de trabajo del proyecto:

```
pbip-lens/
├── .vscode/                   # Configuración del espacio de trabajo y depurador de VS Code
│   ├── launch.json
│   ├── settings.json
│   └── tasks.json
├── dist/                      # Salida de la compilación de producción generada por Webpack
│   ├── extension.js
|   └── extension.js.map
├── docs/                      # Documentación del proyecto
│   └── architecture.md        # [Este archivo] Arquitectura y guía estructural
├── images/                    # Recursos visuales e iconos de la extensión
│   ├── icons/
│   │   ├── folder-orphan.svg
│   │   └── folder-used.svg
│   ├── logo.png
│   └── logo.svg
├── src/                       # Código fuente principal de la extensión
│   ├── core/                  # Núcleo puro (Lógica de dominio estéril de APIs de infraestructura)
│   │   ├── config/
│   │   │   └── featureFlags.ts
│   │   ├── engine/            # Motores de procesamiento
│   │   │   ├── AuditEngine.ts       # Motor de linter (Strategy Pattern)
│   │   │   ├── GraphQueries.ts      # Consultas y resumen de métricas del grafo
│   │   │   ├── PurgeEngine.ts       # Borrado físico de medidas (Mutación)
│   │   │   └── SemanticEngine.ts    # Orquestador del pipeline de análisis semántico
│   │   ├── graph/             # Grafo de dependencias y registro transaccional
│   │   │   ├── PendingReferenceRegistry.ts
│   │   │   └── SemanticGraph.ts
│   │   ├── models/            # Modelos canónicos e interfaces del modelo de datos
│   │   │   └── CanonicalModel.ts
│   │   ├── analyzer/          # Analizadores estructurales y binder de dependencias DAX
│   │   │   ├── Lexer.ts
│   │   │   ├── ResolutionBinder.ts
│   │   │   ├── ScopeManager.ts
│   │   │   ├── StructuralParser.ts
│   │   │   └── Token.ts
│   │   ├── extractors/        # Extracción y lectura física de TMDL y Reportes
│   │   │   ├── DaxLexer.ts
│   │   │   ├── PbipProjectReader.ts
│   │   │   ├── RelationshipParser.ts
│   │   │   ├── TmdlNodeExtractor.ts
│   │   │   ├── reportParser.ts
│   │   │   └── securityParser.ts
│   │   ├── factories/         # Fábricas de instanciación del dominio
│   │   │   └── EngineFactory.ts
│   │   ├── pipeline/          # Infraestructura del Pipeline (Patrón Tubería)
│   │   │   ├── AnalysisPhase.ts
│   │   │   ├── ExtractionPhase.ts
│   │   │   ├── IPipelinePhase.ts
│   │   │   ├── ProcessingContext.ts
│   │   │   └── ResolutionPhase.ts
│   │   ├── ports/             # Puertos / Interfaces Hexagonales puras
│   │   │   ├── IAuditRule.ts        # Contrato para reglas de auditoría dinámicas
│   │   │   ├── IFileSystem.ts       # Contrato de lectura/escritura de archivos
│   │   │   └── ILogger.ts           # Contrato de logging
│   │   └── rules/             # Reglas concretas de linter (Estrategias)
│   │       ├── MissingDescriptionRule.ts
│   │       └── OrphanNodeRule.ts
│   ├── extension/             # Controladores de la extensión de VS Code
│   │   ├── ExtensionController.ts   # Orquestador principal y wiring
│   │   └── WebviewManager.ts        # Gestor de paneles Webview
│   ├── infrastructure/        # Adaptadores e implementación física de infraestructura
│   │   ├── adapters/
│   │   │   ├── NodeFileSystem.ts    # Implementación física del FS basada en Node.js
│   │   │   └── VSCodeLogger.ts      # Adaptador de logs en el Output Channel de VS Code
│   │   ├── NodeFileSystem.ts        # FileSystem legacy
│   │   └── VSCodeFileSystem.ts      # VFS legacy de VS Code
│   ├── ui/                    # Vistas y componentes de la UI nativa
│   │   ├── tree/
│   │   │   ├── AuditTreeProvider.ts
│   │   │   └── SemanticTreeProvider.ts
│   │   ├── NodeInspectorManager.ts
│   │   └── icons.ts
│   └── extension.ts           # Punto de entrada de activación de la extensión VS Code
├── syntaxes/                  # Gramáticas TextMate de sintaxis del lenguaje
│   └── dax.tmLanguage.json    # Definición de coloreado sintáctico de DAX/TMDL
├── test/                      # Modelos PBIP de prueba para tests de integración
│   └── 001_GROW_COSTS_REPORT/ # Reporte muestra real con archivos TMDL y layouts
├── tests/                     # Suites de tests automatizados (Jest)
│   ├── binder.test.ts
│   ├── graph.test.ts
│   ├── integration.test.ts    # Test E2E de procesamiento con el modelo real
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   └── report.test.ts
├── webview/                   # Panel de interfaz gráfica interactiva (Dashboard)
│   └── dashboard/
│       ├── index.html
│       ├── main.js
│       └── styles.css
├── .gitignore
├── .prettierrc
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── RELEASE_GUIDE.md
├── eslint.config.mjs
├── jest.config.js
├── package.json               # Definiciones, scripts, aportes de VS Code y dependencias
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json              # Configuración de compilación TypeScript
└── webpack.config.js          # Configuración de empaquetado para el bundle de VS Code
```

---

## 2. Principios de Arquitectura

El diseño de PBIP Lens está gobernado por dos principios clave de bajo acoplamiento:

### A. Arquitectura Hexagonal (Ports & Adapters)
Toda lógica de negocio y parsing reside de forma estéril dentro de `src/core/`. Esta carpeta tiene estrictamente prohibido importar módulos de Node (`fs`, `path`) o de VS Code (`vscode`).
* **Ports**: Se definen en `src/core/ports/` (ej. [IFileSystem](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/core/ports/IFileSystem.ts), [ILogger](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/core/ports/ILogger.ts)).
* **Adapters**: Se definen en `src/infrastructure/adapters/` (ej. [NodeFileSystem](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/infrastructure/adapters/NodeFileSystem.ts), [VSCodeLogger](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/infrastructure/adapters/VSCodeLogger.ts)) e implementan físicamente estos contratos.
* **Wiring**: El acoplamiento se resuelve inyectando las implementaciones al inicializar los motores en el punto de entrada de la infraestructura ([ExtensionController](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/extension/ExtensionController.ts)).

### B. Patrón Strategy en Auditorías (Linter)
La lógica para validar la sanidad del modelo no está hardcodeada dentro del motor de análisis. 
* **Reglas abstractas**: Cada regla implementa la interfaz [IAuditRule](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/core/ports/IAuditRule.ts).
* **Inyección**: El [AuditEngine](file:///D:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/src/core/engine/AuditEngine.ts) recibe un arreglo dinámico de `IAuditRule[]`. Cuando se ejecuta `analyze()`, evalúa recursivamente cada regla inyectada sobre el grafo sin conocer su lógica interna, recogiendo una lista estructurada de infracciones (`RuleViolation`).

---

## 3. Inicialización y Firmas de Clases Principales (`src/core/`)

Las clases principales del motor semántico, mutación y auditoría se instancian e inyectan dentro del controlador global:

### `PbipProjectReader`
* **Propósito**: Lee el archivo `.pbip` y extrae rutas y referencias a las carpetas del modelo.
* **Firma:**
  ```typescript
  constructor(private fs: IFileSystem)
  ```

### `TmdlNodeExtractor`
* **Propósito**: Analiza los archivos TMDL de forma ligera mediante indentación heurística para extraer medidas y columnas.
* **Firma:** (Constructor implícito vacío).

### `ReportParser`
* **Propósito**: Analiza los archivos visuales en la carpeta `.Report/` (formato moderno PBIR o legacy `report.json`).
* **Firma:**
  ```typescript
  constructor(private fs: IFileSystem)
  ```

### `SecurityParser`
* **Propósito**: Parsea roles de seguridad y filtros estáticos (RLS).
* **Firma:**
  ```typescript
  constructor(private fs: IFileSystem)
  ```

### `RelationshipParser`
* **Propósito**: Parsea definiciones de relaciones desde archivos TMDL y las registra en el grafo semántico.
* **Firma:**
  ```typescript
  constructor(private fs: IFileSystem)
  ```

### `ResolutionBinder`
* **Propósito**: Resuelve dependencias pendientes y enlaza aristas en el grafo de forma transaccional.
* **Firma:**
  ```typescript
  constructor(private graph: SemanticGraph, private registry: PendingReferenceRegistry)
  ```

### `SemanticEngine`
* **Propósito**: Orquestador principal del pipeline completo de análisis estático del modelo.
* **Firma:**
  ```typescript
  constructor(
      private projectReader: PbipProjectReader,
      private nodeExtractor: TmdlNodeExtractor,
      private lexer: DaxLexer,
      private parser: StructuralParser,
      private graph: SemanticGraph,
      private registry: PendingReferenceRegistry,
      private binder: ResolutionBinder,
      private reportParser: ReportParser,
      private securityParser: SecurityParser,
      private logger: ILogger
  )
  ```

### `PurgeEngine`
* **Propósito**: Permite realizar mutaciones físicas en disco eliminando de forma segura medidas huérfanas de sus declaraciones TMDL.
* **Firma:**
  ```typescript
  constructor(private fs: IFileSystem, private logger: ILogger)
  ```

### `AuditEngine`
* **Propósito**: Linter extensible que corre reglas basadas en estrategias en busca de anomalías en el grafo.
* **Firma:**
  ```typescript
  constructor(private rules: IAuditRule[], private logger: ILogger)
  ```

### `GraphQueries`
* **Propósito**: Expone consultas ligeras sobre el grafo semántico para ser visualizadas en Webviews y TreeViews.
* **Firma:**
  ```typescript
  constructor(private graph: SemanticGraph, private auditEngine: AuditEngine)
  ```

### `EngineFactory`
* **Propósito**: Fábrica estática encargada de instanciar el `SemanticEngine` resolviendo y cableando internamente todas sus dependencias del dominio.
* **Firma:**
  ```typescript
  public static createSemanticEngine(fs: IFileSystem, logger: ILogger): SemanticEngine
  ```

---

## 4. Punto de Entrada (Entry Point) de la Extensión

El punto de entrada principal donde se levanta la extensión al activarse en VS Code es el archivo **`src/extension.ts`**.

* **Función `activate(context)`**: Es la función de ciclo de vida nativa de VS Code que se dispara cuando la extensión es invocada. Esta inicializa una instancia de `ExtensionController` (definido en `src/extension/ExtensionController.ts`) y registra los comandos globales del editor.
