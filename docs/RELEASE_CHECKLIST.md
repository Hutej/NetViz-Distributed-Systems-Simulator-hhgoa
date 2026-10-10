# Release checklist

Status as of the final documentation pass. Checked items are done; unchecked items require human action.

- [x] All features implemented and tested (43 backend tests, frontend production build, WebSocket end-to-end check).
- [x] Screenshots captured into `docs/screenshots/` (5 files, verified current with the application).
- [x] README rewritten with real embedded screenshots, architecture diagram, stack, setup, API overview, and honest limitations.
- [x] Supporting docs created: ARCHITECTURE.md, API.md, DEVELOPMENT.md, RELEASE_CHECKLIST.md.
- [x] Screenshot link validation script passes (all referenced images exist).
- [x] Secret audit of tracked files passed (only the explicit local development placeholder in Django settings; no credentials, tokens, or keys).
- [x] Django system check, full backend test suite, frontend production build re-run and passing.

## Remaining manual steps

1. **Record the demo video** — walk through: Overview → Simulator (select a node, crash it) → run the Leader Failure scenario → Scenario Lab → Integrity Lab (run the fork experiment). A screen recording of the app running locally is sufficient.
2. **Upload the video** and paste the real URL into the "Demo video" section of `README.md` (currently marked pending).
3. **Verify the screenshots** still match the app if any UI changes are made after this commit; re-capture `docs/screenshots/*.png` if needed (the two Integrity Lab shots and the Leader Failure shot already reflect the current features).
4. **Check the submission portal** is still accepting entries.
5. **Submit the form** — include the repository URL, the demo video URL, and any required descriptions.
6. Optional: add repository topics/description on GitHub (e.g. `distributed-systems`, `blockchain`, `education`, `django`, `react`).

## Notes

- No LICENSE file exists yet. Add one only if the competition requires a specific license — do not add boilerplate without checking the rules.
- The Django settings contain a placeholder development secret key and `DEBUG=True`. This is documented in the README; do not deploy this project publicly as-is.
