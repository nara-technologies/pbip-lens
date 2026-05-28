# PBIP Lens

[Leer en Español](README.es.md)

**PBIP Lens** is an Advanced Static Analyzer and Architecture Linter designed for Power BI development projects (.pbip, .tmdl, .pbir).

Developed for Data Architects and Business Intelligence Engineers, PBIP Lens integrates directly into Visual Studio Code to audit semantic model integrity, map complex lineages, and validate governance policies. Using a decoupled and extensible analysis engine, the tool helps reduce technical debt and ensure report stability before each deployment.

## The Challenge in Enterprise BI

As data models grow in enterprise environments, they accumulate obsolete measures, undocumented columns, and design violations. Deleting or modifying these elements carries a high risk of breaking visual reports or nested DAX dependencies. PBIP Lens mitigates this risk by transforming the project source code into a detailed semantic graph that reveals every interconnection.

## The Solution: Advanced and Extensible Linter

PBIP Lens functions as an architecture and code quality linter. By implementing Hexagonal Architecture and patterns such as Strategy and Pipeline, the analysis engine performs automatic, local evaluation of predefined policies (such as detecting orphan nodes and missing business descriptions). Its extensible design allows teams to incorporate custom naming, security, or performance rules tailored to their internal standards.

## Key Features

### 1. Measures Explorer
Immediately identify which measures are actively used in reports and which are obsolete.

* **Active Measures:** Measures detected within the JSON structures of report visuals, including dynamic format strings and conditional titles.
* **Orphan Measures:** Measures defined in the semantic model that have no structural impact on report visuals and are not referenced by any active measure.
* **DAX Dependency Graph:** Expand any measure to view its complete lineage (upstream dependencies and downstream dependents). The dependency tree proactively warns if an unused measure is an upstream source of a critical active measure.
* **Display Folders Support:** Measures are automatically grouped according to the logical folder structure defined in Power BI Desktop.

### 2. Table and Column Audit
Organize and inspect tables and columns with the same granularity as measures. Includes folder grouping, type differentiation (physical vs. calculated), and direct navigation to TMDL source code.

### 3. Queries Explorer (Preview)
Inspect Power Query (M) scripts directly within VS Code. PBIP Lens extracts M code from partitions and global expressions, allowing you to audit transformation logic without opening the external Power Query editor.

### 4. Interactive Dashboards
* **Model Health Dashboard:** Provides an executive summary of the project state, including a global orphan score, active vs. orphan ratios, and total visual counts.
* **Measure and Column Dashboards:** Dedicated interactive panels for individual assets. They include DAX definitions with syntax highlighting, dependency indicators, and metadata inspection.

### 5. Multi-Level AI Integration (BYOK)
PBIP Lens includes an optional professional-grade AI engine designed to analyze complex DAX logic and provide architectural recommendations directly within measure panels.
* **Bring Your Own Key (BYOK):** The architecture ensures security by using the native VS Code secret store (SecretStorage). API keys are never stored in plain text.
* **Multi-Provider Support:** Use local models via the native VS Code LM API (GitHub Copilot, Cursor) or configure external providers like Groq, Google Gemini, or OpenAI.
* **Streaming Responses:** AI analysis is streamed directly to the panel interface for immediate feedback.

### 6. Native Go-to-Source Navigation
Interact with any measure or column in the sidebar explorer, and PBIP Lens will instantly open the corresponding `.tmdl` file, positioning the cursor exactly at the source definition for immediate audit or editing.

## Quick Start Guide

1. Open the root folder of your Power BI project (.pbip) in VS Code.
2. Navigate to the PBIP Lens view in the activity bar.
3. The extension will automatically scan the workspace to locate the Semantic Model (.SemanticModel) and Report (.Report) definitions.
4. Use the explorer trees to navigate lineages, or click specific assets to open their source code or detailed audit panels.

## Architecture and Privacy

PBIP Lens is built with a strict focus on performance and enterprise data security:

* **100% Local Execution:** No schema data, report metadata, or DAX code is transmitted to external servers during standard audit operations. External transmission only occurs if the AI Explainer function is explicitly activated with the configured API provider.
* **Deep Structural Analysis:** Unlike generic plain-text searches that generate false positives, the core engine analyzes the deeply nested structures of modern `.pbir` formats and JSON visual definitions.

## Internal Engine

PBIP Lens uses a multi-layered static analysis engine:

* **TMDL Static Analyzer:** A robust parser that interprets the object hierarchy of the Tabular Model Definition Language (TMDL), extracting clean DAX definitions while managing inline comments and formatting metatags.
* **BFS Graph Engine:** Dependencies are calculated using a Breadth-First Search (BFS) traversal algorithm. If Column A feeds Measure B, and Measure B is used in a visual, the engine correctly identifies Column A as active.
* **Report Structure Mapping:** The engine interprets the `visual.json` schema to identify both direct field references and hidden configurations within the report layout.

## Known Limitations

* The current analysis engine requires projects to be saved using the Tabular Model Definition Language (TMDL) format.
* Detection of usage in highly customized third-party visuals using non-standard JSON structures may require manual validation.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
