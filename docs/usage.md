# Using PixelCI

A walkthrough of the PixelCI web UI for reviewing visual regression test results.

## Login

Visit your PixelCI instance and log in via your configured OAuth provider (e.g. GitLab).

<img src="/images/login-light.png" alt="Login page" class="light-only">
<img src="/images/login-dark.png" alt="Login page" class="dark-only">

## Apps List

After logging in, you'll see all apps configured in PixelCI.

<img src="/images/app-list-light.png" alt="App list" class="light-only">
<img src="/images/app-list-dark.png" alt="App list" class="dark-only">

Click an app to view its builds.

## Build List

The build list shows all builds for an app, grouped by branch. Each build displays its status:

- **Needs Review** — new visual changes detected that need approval
- **No Changes** — all screenshots match approved baselines
- **Changes Approved** — all changes in this build have been approved

<img src="/images/build-list-light.png" alt="Build list" class="light-only">
<img src="/images/build-list-dark.png" alt="Build list" class="dark-only">

Click a build to view its screenshots.

## Screen Comparison

The screen comparison view shows screenshots from the new build alongside the reference build (the approved baseline on the default branch).

<img src="/images/screen-list-light.png" alt="Screen list" class="light-only">
<img src="/images/screen-list-dark.png" alt="Screen list" class="dark-only">

### Show Changes

Use the **Show Changes** toggle to filter the view to only screens that have visual differences. This helps you focus on what's changed without scrolling through unchanged screens.

### Show Diff

Enable **Show Diff** to highlight pixel differences between the reference and new screenshots. Changed pixels are overlaid on the image so you can see exactly what moved or changed.

<img src="/images/screen-diff-light.png" alt="Screen list with diff mode" class="light-only">
<img src="/images/screen-diff-dark.png" alt="Screen list with diff mode" class="dark-only">

### All Screens

Uncheck **Show Changes** to view every screen in the build, including unchanged ones.

<img src="/images/screen-all-light.png" alt="All screens" class="light-only">
<img src="/images/screen-all-dark.png" alt="All screens" class="dark-only">

## Approving Changes

Click **Approve** to approve all visual changes in a build. This marks the build as the new approved baseline.

Once approved:

- The build status changes to **Changes Approved**
- The failed CI job is automatically restarted via the GitLab API, and you're redirected to the pipeline page
- Future builds on the same branch will compare against this build
- Other branches that produce the same visual changes will be automatically approved (cross-branch approval matching)

## Build Status Flow

Every build moves through these statuses:

```
draft → processing → no changes
                   → needs review → changes approved (after approval)
                   → changes approved (auto-approved)
```

| Status | Description |
|--------|-------------|
| **draft** | Build created, screenshots being uploaded |
| **processing** | Comparing screenshots against baselines |
| **no changes** | All screenshots match — nothing to review |
| **needs review** | Visual differences found — human review required |
| **changes approved** | All changes approved (manually or via cross-branch matching) |

## How Comparisons Work

When a build is processed, PixelCI runs a multi-stage comparison:

1. **Previous build on same branch** — checks if changes match a previously approved build on this branch
2. **Default branch baseline** — compares against the latest approved build on the default branch
3. **Cross-branch matching** — looks for identical approved changes on other branches since the baseline
4. **New screen detection** — screens not present in the baseline are flagged as new

Changes are flagged only when pixel differences exceed the configured threshold (default 1%). This approach minimizes false positives — once a change is approved anywhere, it's recognized across all branches.
