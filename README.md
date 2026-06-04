# PBIP Lens

[Leer en Español](README.es.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://marketplace.visualstudio.com)
[![Status: Production Ready](https://img.shields.io/badge/Status-v0.4.1--Stable-green.svg)](#)

**PBIP Lens** is an Advanced Static Analyzer and Architecture Linter designed for Power BI development projects (`.pbip`, `.tmdl`, `.pbir`). 

Designed for BI Engineers and Data Architects, PBIP Lens parses tabular model definition files (TMDL) and report visual schemas into a consolidated semantic graph. It automates model auditing, maps complex DAX lineages, and validates enterprise governance policies both locally in the IDE and automatically in CI/CD pipelines.

---

## The Challenge in Enterprise BI

As enterprise BI models scale, they inevitably accumulate technical debt: obsolete measures, undocumented columns, and inconsistent naming conventions. Deleting or refactoring these assets carries a massive risk of silently breaking visual reports or nested DAX calculations.

**PBIP Lens** solves this by converting your Power BI project source code into a detailed, queryable dependency graph. It maps relationships from physical columns up through multiple layers of nested DAX calculations, all the way to their usage inside individual report visuals. It tells you exactly what is active, what is orphan, and what is safe to modify or delete.

---

## Dual Installation

To support the entire BI lifecycle, PBIP Lens is distributed in two formats:

### A. The IDE Extension (Local Development)
Install the VS Code extension directly from the Marketplace to get a visual interface, interactive sidebars, and direct file editing links.
* Search for **PBIP Lens** in VS Code Extensions and click **Install**.

### B. The Command-Line Interface (CI/CD Pipelines)
Install the CLI utility globally or locally in your runner environment to enforce model standards automatically on every commit.
```bash
# Install globally via npm
npm install -g pbip-lens

# Or run instantly via npx
npx pbip-lens <path-to-project>
```

---

## The CLI & CI/CD Integration

PBIP Lens acts as the guardian of your BI project's architecture, preventing flawed semantic models from reaching production environments.

When executed on your repository path, the CLI builds the semantic model graph, runs the audit engine against configured policies, and generates a formatted report grouped by severity level (`ERRORS` vs `WARNINGS`).

### Pipeline Gatekeeper (Exit Codes)
The CLI operates under strict execution rules to automate quality gates in CI/CD:
* **Exit Code `0` (PASSED)**: The model is clean or contains only `warn`-level violations.
* **Exit Code `1` (FAILED)**: The model contains one or more `error`-level violations. This will break the build or pull request pipeline.

```bash
$ pbip-lens ./my-powerbi-project

Resolving target project path: /home/runner/work/my-powerbi-project
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

## Governance & Configuration

You can fully customize policy enforcement via a `.pbiplensrc.json` file placed in the root directory of your Power BI project.

### Config File Structure
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

### Config Options
1. **Rule Severities**: Individual rules can be mapped to one of three levels:
   - `error`: Triggers a pipeline-breaking error (exits with code `1`).
   - `warn`: Prints a colored warning in stdout, but does not block the pipeline (exits with code `0`).
   - `off`: Disables the rule evaluation entirely.
2. **Strict Defaults**: If no `.pbiplensrc.json` is found in the project root, PBIP Lens defaults to a **strict-error configuration** (all built-in rules set to `error`).
3. **Exclusion List (`ignore`)**: Exclude specific files, tables, or measures from linting by providing exact matches, substrings, or wildcard patterns (e.g. `*Temp*` or `System_*`).

---

## VS Code Node Inspector

For local development and refactoring, PBIP Lens provides a premium, interactive **Node Inspector** panel inside Visual Studio Code.

* **Clean DAX definitions**: View measure expressions formatted with syntax highlighting, stripped of distracting inline metadata.
* **Granular Lineage Tree**: Inspect upstream (what this measure depends on) and downstream (what visuals or nested measures consume this measure) dependencies.
* **Visual Title Warnings**: Highlights when a visual consumes a measure but lacks a descriptive title.
* **Instant Refactoring**: Physically delete orphan measures from disk with a single click, directly from the webview panel.
* **Go-to-Source Navigation**: Double-click any explorer tree node to open the corresponding `.tmdl` definition file with the cursor placed exactly at the source line.

---

## Technical Details & Architecture

* **Tabular Model Parser (TMDL)**: Interprets Tabular Model Definition Language specifications, managing block layouts and multi-line expressions.
* **Visual Schema Resolver**: Deeply parses the modern `.pbir` visual format and layout JSONs to detect dynamic formatting, tooltips, and conditional styling usages.
* **100% Local and Secure**: No schema data, code, or metadata is ever transmitted to external servers. Your corporate IP remains entirely inside your secure network.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
