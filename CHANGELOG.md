# Changelog

[Leer en Español](CHANGELOG.es.md)

All notable changes to the **PBIP Lens** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-06-04
### Fixed
- **NPM Ignore Tuning:** Refined `.npmignore` to exclude `test/` (mock workspaces) and `webview/` (development webview assets) to reduce the published NPM package size and resolve `vsce package` errors.

## [0.4.1] - 2026-06-04
### Fixed
- **Packaging Configuration:** Removed the restrictive `files` configuration block from `package.json` and introduced `.npmignore` to prevent packaging errors during the extension building process (`vsce package`).

## [0.4.0] - 2026-06-04
### Added
- **CLI & CI/CD Linter Mode:** Introduction of the CLI execution engine (`pbip-lens`) for automated validation of Power BI semantic models in headless pipeline environments.
- **Rule Severity Configuration:** Support for custom policy mapping (`error` | `warn` | `off`) via `.pbiplensrc.json` configuration file at the target project root.
- **Exclusion Lists (Ignore Patterns):** Wildcard glob and substring pattern support (`ignore`) to bypass analysis on temporary tables, system measures, or specific `.tmdl` files.
- **Console Logger Adapter:** Premium `ConsoleLogger` with ANSI color escape codes for terminal outputs, routing linter issues separately through process stdout/stderr channels.

### Changed
- **Licensing Compliance:** Migrated the project license from MIT to Apache License 2.0 to ensure corporate-grade distribution compliance.
- **Default Lint Policy:** Adopted strict-error as fallback behavior when no configuration is detected, ensuring pipelines break on architectural debt.

## [0.3.1] - 2026-05-28
### Fixed
- **Documentation Sync:** Updated Changelog and README to reflect the massive architectural changes introduced in `0.3.0`.

## [0.3.0] - 2026-05-28
### Added
- **C²E Architecture Core:** Complete rewrite of the extraction pipeline using a pure Hexagonal Architecture (Contract-Context-Execution).
- **Semantic Graph Engine:** Deterministic 360° mapping of all tabular model relationships, DAX dependencies, and visual usage.
- **Strategy-Based Linter:** New `AuditEngine` with extensible rules to detect architectural debt (`OrphanNodeRule`, `MissingDescriptionRule`).
- **Physical Relationship Parser:** Deep scanning of `relationships.tmdl` to build bidirectional edges, eliminating false positives for primary/foreign keys.
- **TMDL Documentation Parser:** Native extraction of `///` XML-style documentation comments from DAX measures and columns.
- **Relational Diagram UI:** Node Inspector now renders visual ER-style diagrams for cross-filtering relationships dynamically.

### Changed
- **Node Inspector Overhaul:** Deprecated the obsolete "Orphan Score" progress bar. Replaced with strict Impact Levels and localized Linter Findings.
- **Semantic Badging:** UI now explicitly maps structural dependencies with specific tags (e.g., `RELATIONSHIP`) instead of generic groupings.
- **Marketplace Branding:** Updated extension icon to a high-contrast solid dark theme for universal visibility across IDE themes and web.

### Removed
- Removed legacy regex-based extraction methods that failed on complex TMDL formatting.

## [0.2.0] - 2026-05-27
### Added
- Internal architectural bridge release (Transition to C²E). Superseded immediately by `0.3.0` for public marketplace release.


## [0.1.3] - 2026-04-10

### Added
- **Modular Semantic Model**: Limited scanning strictly to the `definition/` directory, ignoring artifacts in `TMDLScripts` or history.
- **Display Folders Support**: Measures and Columns are now grouped by their `displayFolder` property in the tree views.
- **Queries Explorer (✦ preview)**: New view to browse Power Query (M) scripts, partitions, and global expressions.
- **Relationships Explorer (⚙ dev)**: Initial support for browsing model relationships (visible in development mode).
- **Advanced Metadata**: Measures now include `filePath` and lineage metadata for easier auditing.
- **Feature Flags System**: Robust state management (`dev`/`preview`/`prod`) to control feature visibility and badging.
- **Native Stress Tester**: Enhanced `stress_tester.py` to inject 8,000+ clonic measures with real DAX logic and cross-references.

### Changed
- **Parser Optimization**: TMDL Parser now extracts `displayFolder`, M expressions, and Relationships metadata.
- **UI Refactoring**: Improved lifecycle management for Tree Views (preventing leaks) and synced hierarchy commands (Expand/Collapse) across all new explorers.

### Fixed
- **View Registration**: Corrected registration of secondary views to prevent "TreeDataProvider not found" errors during hierarchy expansion.
- **File Scanner**: Fixed issue where stale TMDL scripts from peripheral folders were causing duplicate measure warnings.


## [0.1.2] - 2026-04-08

### Added
- **UI 2.0 (Welcome Views)**: Implementing big "Audit Project" buttons when no data is loaded, improving onboarding.
- **Hierarchy Controls**: New "Expand All" and "Collapse All" actions in the view title and context menus.
- **Refresh Icon**: Replaced standard play icon with a standard VS Code refresh icon for audit updates.

### Fixed
- **Welcome View Visibility**: Resolved issue where placeholder items were hiding the welcome buttons.

## [0.1.1] - 2026-04-08

### Added
- **Calculated Column Dependencies (6th Pillar)**: Tracking between calculated columns and their dependencies.
- **Visual Item Indicators**: Type icons (Medida/Columna) in dependency lists within the dashboard.

### Fixed
- **Universal Case-Insensitivity**: Fixed lookups for measures and columns in DAX expressions (ignoring casing).
- **Enhanced Relationship Detection**: Support for dot notation (`Table.Column`) in relationship definitions.
- **Dashboard Stability**: Fixed "0 counts" and "No content found" errors in Column Dashboards.
- **UI Tree Stability**: Resolved crashes (`undefined`) when expanding measures or columns in the sidebar.

## [0.1.0] - 2026-04-08

### Added
- **Tables Explorer**: New native VS Code sidebar view to browse tables and columns independently.
- **Measures Explorer**: Dedicated view for DAX measures with "In Use" and "Orphaned" categorization.
- **Advanced Column Audit (The 4 Pillars)**:
    - Relationship Key detection (Primary/Foreign keys).
    - Sort-By Column target identification.
    - DAX Dependency tracking (is used in measures).
    - RLS (Row Level Security) impact analysis.
- **Column Dashboard**: Interactive Markdown report for every column, providing a deep dive into its usage and metadata.
- **Clean Architecture**: Complete backend refactor using modular patterns (Models, IO, Parsers, Graph).
- **Navigation**: Click-to-source functionality for Measures and Columns directly to `.tmdl` files.

### Changed
- Refactored TMDL Parser to handle complex string literal names and brackets correctly.
- Improved workspace scanning to support nested PBIP report and dataset structures.
- Optimized DAX dependency resolution using a Breadth-First Search (BFS) graph engine.

### Fixed
- Fixed truncate issue where table and column names were showing only the first character.
- Resolved "ghost" linting errors by cleanup of deprecated monolithic files.

---
*Maintained by Nara Technologies*