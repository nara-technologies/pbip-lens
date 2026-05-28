# Release Guide

[Leer en Español](RELEASE_GUIDE.es.md)

This guide details the mandatory process for launching new versions of **PBIP Lens**, ensuring consistency in versioning and quality in packaging.

## 1. Preparation and QA

Before versioning, perform the following validations:

- [ ] **Compilation**: Run `npm run compile` and verify that there are no TypeScript or Webpack errors.
- [ ] **Feature Flags**: Review `src/core/config/featureFlags.ts`. Ensure that features in the `dev` state are hidden for production and those in `preview` have their respective badge.
- [ ] **Stress Testing**: Run `python scripts/stress_tester.py --count 5000` and verify that the extension responds fluidly in audit mode.
- [ ] **Cleanup**: Run `python scripts/stress_tester.py --reset` to avoid including test measures in the repository.

## 2. File Versioning

Adhere to the [Semantic Versioning](https://semver.org/) standard.

- [ ] **package.json**: Increment the `"version"` property.
- [ ] **CHANGELOG.md**:
  - Add a new section with the format: `## [X.Y.Z] - YYYY-MM-DD`.
  - Classify changes into `Added`, `Changed`, `Fixed`.
- [ ] **README.md**: Update the status badge (`Status: vX.Y.Z--Stable`).

## 3. VSIX Packaging (Optional but recommended)

To verify what the end user will see:

- [ ] Run `vsce package`.
- [ ] Install the resulting `.vsix` in a clean instance of VS Code.
- [ ] Verify that views marked as `dev` do **NOT** appear.

## 4. Git and GitHub

The final release process in the repository:

```powershell
# 1. Stage versioning and documentation changes
git add package.json CHANGELOG.md README.md

# 2. Commit changes
git commit -m "chore: release vX.Y.Z"

# 3. Create the Tag (crucial for tracking)
git tag vX.Y.Z

# 4. Push to remote
git push origin main
git push origin vX.Y.Z
```

## 5. Feature Promotion Criteria

To move a feature between states in `featureFlags.ts`:

1. **Dev → Preview**: The feature is functional, does not cause crashes, and provides value to the user, but the UI or metadata might change.
2. **Preview → Prod**: The feature has been tested on large models, feedback is positive, and the data structure is stable. It does not require a warning badge.

---

*Maintained by Nara Technologies - 2026*
