# Changelog

All notable changes to the **PBIP Lens** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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