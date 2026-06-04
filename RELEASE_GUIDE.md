# Release Guide

[Leer en Español](RELEASE_GUIDE.es.md)

This guide details the mandatory step-by-step checklist for releasing new versions of **PBIP Lens**, ensuring consistency in versioning, verification of packaging, and quality in delivery.

## Release Checklist

Follow these steps in order when releasing a new version:

### 1. Verification and QA
- [ ] **Code Verification**: Run `pnpm run compile` and make sure there are no TypeScript or Webpack errors.
- [ ] **Tests**: Run `pnpm test` (or `npm run test`) and ensure all test suites pass.
- [ ] **Feature Flags**: Check `src/core/config/featureFlags.ts`. Ensure that development features are disabled/hidden for production.
- [ ] **Stress Testing** (Optional): Run `python scripts/stress_tester.py --count 5000` to verify performance on large-scale models, followed by `python scripts/stress_tester.py --reset` to clean up mock measures.

### 2. Determine & Apply Version Bump
- [ ] **Determine the Bump Level**:
  - **Patch** (e.g., `0.4.4 -> 0.4.5`): Internal fixes, package configurations (like `.npmignore` adjustments), or documentation-only updates.
  - **Minor** (e.g., `0.4.0 -> 0.5.0`): New backward-compatible features (new rules, CLI parameters).
  - **Major** (e.g., `0.4.0 -> 1.0.0`): Breaking changes in the API, CLI commands, or core logic.
- [ ] **Update package.json**: Bump the `"version"` field in [package.json](file:///d:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/package.json).

### 3. Synchronize All Documentation Files
Every release requires updating the following files:
- [ ] **README.md**: Update the version badge (`Status: vX.Y.Z--Stable`) at the top of the file.
- [ ] **README.es.md**: Update the version badge (`Status: vX.Y.Z--Stable`) at the top of the file.
- [ ] **CHANGELOG.md**:
  - Add a new block at the top under `## [X.Y.Z] - YYYY-MM-DD`.
  - Classify changes into `Added` (new features), `Changed` (modified logic), and `Fixed` (bug fixes).
- [ ] **CHANGELOG.es.md**:
  - Add a corresponding release block under `## [X.Y.Z] - YYYY-MM-DD`.
  - Classify changes into `Añadido`, `Cambiado`, and `Corregido`.
- [ ] **RELEASE_GUIDE.md & RELEASE_GUIDE.es.md**: Update any reference examples to the latest version number if relevant.

### 4. Distribution and Packaging Tuning
- [ ] **Verify Ignores**: Check `.npmignore` and `.vscodeignore` to ensure development folders (such as `src/`, `tests/`, mock workspace folders like `test/`, and `webview/`) are correctly excluded so only compiled assets under `/dist` are shipped.
- [ ] **Webpack Packaging**: Run `pnpm run package` (webpack compilation) to verify the production bundle builds without errors.
- [ ] **Validate VSIX Local Packaging**: Compile the VS Code extension locally using `npx @vscode/vsce package` (or `vsce package`). Ensure it packages successfully without errors and generates a `.vsix` file.

### 5. Git Commit and Tagging
Once the build passes and the packaging is verified, proceed to commit and tag the release:
- [ ] **Stage Changes**:
  ```powershell
  git add package.json README.md README.es.md CHANGELOG.md CHANGELOG.es.md RELEASE_GUIDE.md RELEASE_GUIDE.es.md .npmignore
  ```
- [ ] **Commit Files**:
  ```powershell
  git commit -m "chore(release): bump version to X.Y.Z and update documentation"
  ```
- [ ] **Create Annotated Git Tag**:
  ```powershell
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  ```

### 6. Remote Sync & Automated Publication
- [ ] **Push Commits and Tags**:
  ```powershell
  # Push your current branch to remote
  git push origin <current-branch>
  # Push the new release tag to remote (this triggers the GitHub Actions release workflow)
  git push origin vX.Y.Z
  ```
- [ ] **Monitor GitHub Actions Pipeline**:
  - Pushing the tag `v*` triggers the automated CI/CD pipeline defined in [.github/workflows/release.yml](file:///d:/002. MANUEL VASQUEZ/PBIP Lens/pbip-lens/.github/workflows/release.yml).
  - Open the **Actions** tab on your GitHub repository.
  - Verify that the `Build and Publish Release` job compiles cleanly and publishes successfully to both NPM and the VS Code Marketplace.
- [ ] **Manual Fallback (If Pipeline Fails)**:
  - If you need to publish manually, run:
    ```powershell
    # Publish to VS Code Marketplace
    npx vsce publish -p $VSCE_PAT
    # Publish to NPMJS
    npm publish
    ```

---

*Maintained by Nara Technologies - 2026*
