# Obsidian Version Control Local: Roadmap

This roadmap tracks the development lifecycle of the Dean Innovative Design fork, emphasizing air-gapped security, zero-telemetry workflows, and powerful local integrations for Obsidian.

## v2.0.1-beta.1 (Current)
*   **Opt-In AI Milestone Summaries:** Optional AI title and diff generation supporting Google Gemini and 100% offline local endpoints (Ollama / LocalAI).
*   **OS Keychain Credential Isolation:** AI credentials strictly resolve through Obsidian `app.secretStorage` or OS DPAPI keychain—never stored in vault text.
*   **Deprecation-Proof Markdown Audit Log:** Appends clean, human-readable unified diff records directly into `.versiondb/<noteId>/HISTORY.md`.
*   **Dirty-Lock Latency Protection:** User keystrokes in title or description fields instantly lock them against asynchronous overwrite.
*   **Surgical Diff Truncation & Resiliency:** Improved diffing mechanics utilizing `diffWordsWithSpace` and single-hunk overflow guarding for large offline edits.

## v2.0.2
*   **Mobile UI/UX Refinement:** Address inconsistent compatibility and layout issues on iOS and Android platforms to ensure a robust mobile experience.
*   **HISTORY.md Retroactive Synchronization:** Ensure bidirectional synchronization of `.versiondb/<noteId>/HISTORY.md` when a user retroactively edits a version's title/description or deletes a version directly from the UI sidebar.
*   **Offline Local Ollama Benchmarking:** Introduce an automated benchmarking test suite to measure token generation latency and format constraint adherence for models like `llama3.2`, `mistral`, and `qwen2.5` via `localhost:11434`.

## v2.1.0
*   **Selective Cherry-Picking:** Allow users to accept specific diff hunks or individually staging edits when restoring or merging historical versions, rather than all-or-nothing overwrite.
*   **Multi-Note Batch History Export:** Generate a comprehensive project-wide timeline report spanning multiple notes.

## v2.2.0
*   **Vault-Wide Orphaned Version Pruning:** Introduce robust cleanup utilities to safely garbage collect snapshots from deleted notes.
*   **Obsidian Canvas/Base Integration:** Extend `.versiondb` snapshot mechanisms to natively track coordinate layout changes in Obsidian `.canvas` files.
