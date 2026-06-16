# CI pipeline (pending installation)

`github-actions-ci.yml` is the project's CI workflow (backend tests, frontend
build, and a guard that fails if any database file is committed).

It lives here rather than `.github/workflows/` because the token currently used
to push cannot create workflow files (it lacks the GitHub `workflow` scope).

**To activate it**, someone with a `workflow`-scoped token (or via the GitHub
web UI) should move it into place:

```bash
mkdir -p .github/workflows
git mv ops/ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions pipeline"
git push
```

Or paste its contents into a new file at `.github/workflows/ci.yml` via the
GitHub UI (the UI push is authorized for workflows).
