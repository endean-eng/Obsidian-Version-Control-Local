> ### v2.0.1 Hardened Local Edition (Live Release)
> This repository is an actively maintained, security-hardened continuation of **Version Control for Obsidian** (originally created by Yuichi Aragi & Lae Aragi and archived in May 2026), developed and maintained by **Dean Innovative Design** (Elijah Dean).
>
> **What is New in v2.0.1:**
> - **Opt-In AI Milestone Summaries (New in v2.0.1):** Optional AI title and diff generation supporting Google Gemini and 100% offline local endpoints (Ollama / LocalAI at `http://localhost:11434/v1`).
> - **OS Keychain Credential Isolation (New in v2.0.1):** AI credentials strictly resolve through Obsidian `app.secretStorage` or OS DPAPI keychain—never stored in `data.json` or committed to Git.
> - **Deprecation-Proof Markdown Audit Log (New in v2.0.1):** Appends clean, human-readable unified diff records directly into `.versiondb/<noteId>/HISTORY.md`.
> - **Dirty-Lock Latency Protection (New in v2.0.1):** User keystrokes in title or description fields instantly lock them against asynchronous overwrite.
> - **100% Local & Air-Gapped by Default:** Zero background network requests, zero telemetry, and zero unprompted outbound calls. Third-party tracking badges have been completely eliminated.
> - **Multi-Byte UTF-8 & CJK Integrity Fix (#50):** Fixed Web Worker `ArrayBuffer` byte-offset slicing bugs that caused garbled text (Mojibake) in Chinese/CJK and symbol-heavy notes.
> - **Legacy `.vctrl` Edit History Fix (#43 / #44):** Added automatic GZIP/ZLIB header magic-byte detection and fallback decompression so older edit histories load reliably.
> - **Workspace Tab-Scrolling Fix (#51):** Eliminated focus-scroll hijacking and global CSS root collisions that broke horizontal tab scrolling in Obsidian.
> - **Instant Version Naming Prompt (#52):** Saving a version via hotkey or Command Palette prompts you to name your milestone immediately.
> - **Deleted Note History Retention & Recovery (#49):** Deleting a note in Obsidian retains full version history. Use **`Version Control: Restore version from deleted / orphaned notes`** to recover deleted notes and snapshots.
>
> *Engineering & Audit Transparency: Static security audits, air-gap refactoring, and patch engineering for this fork are developed by Dean Innovative Design in collaboration with Google Gemini 4 Argon.*

---

***

<div align="center">

![Banner](assets/1000202057.jpg)

**Version 2.0.1** • *Maintained by Dean Innovative Design* • **MIT Licensed**

</div>

***

# Version Control for Obsidian

**Not another Git wrapper. Not automatic backup. This is version control for your *thoughts*.**

If you're a writer, a perfectionist, or someone who iterates through multiple drafts before finding the right words—this plugin was made for you. It's for those moments when you want to save something meaningful, not because a timer went off, but because *you* decided this version is worth keeping.

---

## 🎯 A Different Philosophy

**Git is amazing, but it wasn't designed for writers.** Git treats your entire vault as a single branch, but when you're writing, you don't want to version a folder—you want to version *a note*. A single piece of writing. A specific idea.

**This plugin flips that model:**
- **Git versions folders** → **This plugin versions individual files**
- **Git treats a vault as a branch** → **This plugin treats each note as its own repository**
- **Git makes you leave the file to branch** → **This plugin lets you branch *within* the note**

Think of it this way: you're writing a note about a complex idea. You want to explore two different angles—maybe a technical explanation vs. a philosophical one. With Git, you'd need to create separate files or switch branches. With this plugin, you **branch your thoughts right there in the same note**, each with its own independent history.

---

## 💡 The Core Philosophy: Conscious Milestones

At its heart, this plugin is about **intentionality**—saving versions when **you** decide they're worth saving. When you've reached a milestone. When you've captured something meaningful that you might want to return to later.

- **For perfectionists:** Save each iteration as you refine your ideas, without cluttering your vault with "Copy of..." files.
- **For writers:** Mark meaningful drafts ("First complete thought," "After research," "Final before rewrite") instead of generic timestamps.
- **For thinkers:** Branch your ideas to explore different directions, then merge back what works.

This **intentional** approach to version control is the core philosophy of this plugin—it's designed for people who want to be in control of their creative evolution.

**But we also have your back.** Alongside intentional Version History, this plugin offers an optional **Edit History** feature—automatic, passive snapshots that work in the background as a safety net. You get the best of both worlds: conscious milestones when you want them, and invisible protection when you need it.

---

## 🤝 Works *With* Git, Not Against It

Because this plugin operates at the **file level** (not the vault level), it plays perfectly alongside Git:

- **Use Git** to manage your vault structure, sync across devices, and track large-scale changes
- **Use this plugin** to manage the fine-grained evolution of individual notes, with meaningful milestones and experimental branches

No conflicts. No competition. Two complementary tools for different scales of version control.

---

## 📝 What This Plugin Supports

As of now, this plugin provides version control for:

- ✅ **Markdown files (`.md`)** – Your notes, your writing, your ideas
- ✅ **Obsidian Bases (`.base`)** – Fully supported!

---

## 🚀 Key Features That Transform Your Workflow

### 💾 **Save Intentional Snapshots**
Create meaningful version milestones with custom names and descriptions. Save "First complete thought," "After research," "Final before rewrite" – exactly when YOU decide it's worth preserving.

### 🤖 **Opt-In AI Milestone Summaries (New in v2.0.1)**
Automatic generation of concise titles and bulleted change descriptions based on unified note diffs.
- **100% Air-Gapped & Local Support**: Defaults to OFF. Works seamlessly with local Ollama / LocalAI (`http://localhost:11434/v1`) or cloud Google Gemini.
- **OS Keychain Isolation**: API keys are heavily isolated via Obsidian `app.secretStorage` or OS DPAPI keychain—never stored in plaintext `data.json`.
- **Dirty-Lock Keystroke Protection**: Your manual keystrokes immediately lock the input fields to prevent AI overwrites while you type.
- **Resilient Diffing**: Word-level diffing with single-hunk overflow guard respects context windows while providing high-quality summaries.

### 📜 **Deprecation-Proof Markdown Audit Log (`HISTORY.md`)**
Every intentional snapshot automatically logs a clean, human-readable unified diff and description directly to `.versiondb/<noteId>/HISTORY.md`. This transparent audit log can be read in plain text, standard Markdown viewers, and git—meaning your history remains accessible even without Obsidian or the plugin.

### 🛡️ **Deleted Note History Retention & Recovery**
Deleting a note in Obsidian no longer purges its history. A dedicated Command Palette workflow (`Version Control: Restore version from deleted / orphaned notes`) allows you to easily recover deleted notes and safely restore their entire version timeline.

### ⚡ **Instant Naming Modal Prompt**
Saving versions triggered via hotkey or the Command Palette opens a modal prompt immediately, making milestone titling fast and seamless without needing to navigate the sidebar.

### 🔍 **Advanced Comparison (Diff) Engine**
See exactly what changed between any two versions with multiple comparison modes.
- **Side-by-Side View**: Compare versions left and right (like standard developer tools).
- **Unified View**: See changes inline for a streamlined reading experience.
- **Granular Diffs**: Choose between Line, Word, Character, or Smart Diff to catch even the smallest modifications.
- **Panel or Window View**: Choose how you want to review changes.

### 🌿 **Branch Within Same Note**
Need to try a different direction within the *same file*? You can create multiple branches to work on parallel ideas. 

Crucially, **every branch is a fully isolated environment**. When you switch branches, you aren't just changing the text; you are switching contexts. Each branch maintains its own independent:
- **Timeline**: An isolated chronological view for both history types within that branch.
- **Settings**: Unique configurations (retention, auto-save rules) specific to that branch.
- **Edit History**: Automatic background snapshots unique to that branch.
- **Version History**: Intentional milestones saved only within that branch.

### 🕰️ **Timeline & Search**
Don't remember in which version you made a specific change?
- **Global Search**: Search through the *content* of your history. The timeline lets you search diffs between all versions and edits to find that one paragraph you deleted three days ago.
- **Visual Timeline**: See your note's evolution as a chronological list with expandable details.

### 📊 **Deep Statistics**
Get granular insights into your writing progress.
- Track lines, words, and characters for every version and edit.
- **Stats**: View counts with or without Markdown syntax included.
- **Dashboard Heatmap**: Visualize your productivity with a contribution graph based on the number of versions/edits saved over time.

### ⚙️ **Customizability**
We give you more flexibility that we think you'll likely need, because your workflow is unique.
- **Global Settings**: Apply rules to all tracked notes.
- **Per-Branch Overrides**: Set specific settings, retention policies, or auto-save rules for individual branches or histories.
- **Auto-Registration**: Automatically start tracking any note based on criteria.
- **Auto-Save Triggers**: Configure saves based on a timer, number of lines changed, or file modification events.

### 📦 **Efficient Storage & Compression**
Want to keep your history forever without bloating your hard drive?
- **Compression**: Enable optional GZIP compression. Versions are compressed before saving to disk. (They remain accessible—just change the extension to `.gz` and open the archive).
- **Sync-Friendly**: Edit history is stored as compressed diffs in `.vctrl` files, making them efficient to sync across devices.

### 📢 **Automatic Changelog (100% Air-Gapped)**
Stay in the loop without checking the repo. The plugin features an automatic changelog view that appears on new updates, detailing exactly what has improved. **This changelog is bundled locally—meaning zero outbound network polling or remote tracking.**

---

## The Interface

The plugin is designed to be intuitive and fit seamlessly with your Obsidian theme, whether you prefer light or dark mode.

<table>
  <tr>
    <td align="center"><strong>Card View (Light)</strong></td>
    <td align="center"><strong>Card View (Dark)</strong></td>
  </tr>
  <tr>
    <td><img src="assets/20251111_001800.jpg" alt="Card View in Light Mode"></td>
    <td><img src="assets/20251111_001358.jpg" alt="Card View in Dark Mode"></td>
  </tr>
  <tr>
    <td align="center"><strong>List View (Light)</strong></td>
    <td align="center"><strong>List View (Dark)</strong></td>
  </tr>
  <tr>
    <td><img src="assets/20251111_001725.jpg" alt="List View in Light Mode"></td>
    <td><img src="assets/20251111_001603.jpg" alt="List View in Dark Mode"></td>
  </tr>
</table>

---

## How is this different from Obsidian's File Recovery?

**Obsidian File Recovery:** A basic, passive safety net for "oops" moments.

**Version Control (This Plugin):** A comprehensive toolkit—intentional milestones for your creative workflow *plus* automatic edit tracking for peace of mind.

Here's the key differences:

| Aspect | File Recovery | This Plugin |
|--------|---------------|-------------|
| **Control** | Automatic snapshots only | Manual, intentional milestones + automatic protection |
| **Naming** | No custom names | Meaningful names like "Brainstorming complete" |
| **Search** | None | **Search text within diffs across history** |
| **Storage** | Hidden internal DB | Accessible files (MD or compressed) |
| **Features** | Basic restore | Branching, Side-by-Side Diff, Timeline, Heatmap |
| **Visibility** | On-demand | Integrated into your daily workflow |

---

## Two Types of History

This plugin offers two complementary approaches. Both are **opt-in**—you are in control.

### 🎯 **Version History** (Intentional Snapshots)
- **When**: Only when you explicitly choose to save (or via specific auto-save rules).
- **Purpose**: Creative milestones and meaningful drafts.
- **Storage**: `.versiondb` folder (in your vault).
- **Format**: Full Markdown copies (optionally compressed).
- **Best for**: Perfectionists and conscious creators.

### ⏱️ **Edit History** (Automatic Snapshots)
- **When**: Based on your settings (timer, lines changed, modification).
- **Purpose**: Safety net and session recovery.
- **Storage**: `.vctrl` files (in your vault).
- **Format**: **Compressed diffs**. This is highly space-efficient and designed to be sync-friendly.
- **Best for**: "Oops" moments and seeing how you evolved.

---

## Quick Start Guide

For immediate use:

1.  **Save your first version**: Click the `+` button in the bottom-right corner.
2.  **Switch between histories**: Click the menu button (☰) → "Edit/Version history".
3.  **Access settings**: Click the gear icon in the top-right corner.
4.  **View timeline**: Click the menu button (☰) → "Timeline".
5.  **Create branches**: Click the menu button (☰) → "Branches".

---

## Platform Support

* ⚠️ **Mobile** (iOS & Android) - *Compatibility may still be inconsistent*
* ✅ **Desktop** (Windows, macOS, Linux)

---

## ⚖️ Open Source & Licensing

We believe in the freedom of software. This plugin's source code is available under the **MIT License**. 

If you find that our vision doesn't perfectly align with yours, or if you want to make drastic changes to the core functionality, you are encouraged to **fork the repository**. Under the MIT license, you are free to modify, redistribute, and build upon this work—you don't even have to give credit to us. We want this tool to be a foundation for better versioning, however that looks for you.

---

## 🛠️ Maintenance and Contribution 

This repository is maintained and governed by **Dean Innovative Design** (Elijah Dean) as a privacy-centric, 100% air-gapped fork of the original Version Control plugin.

*   **Active Maintenance:** This project is actively developed and tested for daily production use. Check `ROADMAP.md` for upcoming enhancements and planned features.
*   **Security First:** The core philosophy remains absolute privacy. Zero telemetry, zero unprompted network calls. Any new network features (like LLM summary generation) are strictly opt-in and configurable to hit local offline endpoints.
*   **Contributions:** We welcome bug fixes, usability enhancements, and security audits! Please open an Issue on the `endean-eng/Obsidian-Version-Control-Local` GitHub repository to discuss major architectural changes before submitting a Pull Request, so we can ensure alignment with the air-gap philosophy.
*   **Feedback:** Feature Requests, Issues, and Suggestions are actively monitored via GitHub Issues.

---

## 🦙 Local Ollama Configuration Guide

To use the **Opt-In AI Milestone Summaries** completely offline and air-gapped, follow these steps:

1. **Install Ollama**: Download and install [Ollama](https://ollama.com/) on your machine.
2. **Download a Model**: Open your terminal and pull a fast, lightweight model (e.g., `ollama run qwen2.5:0.5b` or `ollama run llama3.2`).
3. **Configure the Plugin**: 
   - Go to Version Control Settings ⚙️
   - Enable "AI diff titles & descriptions"
   - Select **OpenAI-Compatible / Local Ollama** from the AI Provider dropdown.
   - Leave the **API Key** blank.
   - Enter your model name in **Model ID** (e.g., `qwen2.5:0.5b`).
   - Enter `http://localhost:11434/v1/chat/completions` in the **Custom Endpoint URL**.
   - Click **Save AI Configuration**.

Now, whenever you save an intentional snapshot, the plugin will securely query your local Ollama instance without any network egress.

---

## 📥 Download & Installation

To install the locally-hardened version of the Version Control plugin:

### Option 1: Stable Release (v2.0.1+)
1. Go to the [Releases page](https://github.com/endean-eng/Obsidian-Version-Control-Local/releases) on GitHub.
2. Download `main.js`, `styles.css`, and `manifest.json` from the latest release.
3. Create a folder named `version-control` inside your vault's `.obsidian/plugins/` directory and place the files there.
4. Reload Obsidian and enable the plugin.

### Option 2: Community Beta Testing (via BRAT)
To test cutting-edge beta releases directly inside Obsidian:
1. Install the **Obsidian42 - BRAT** community plugin.
2. Add the beta repository URL: `endean-eng/Obsidian-Version-Control-Local`
3. BRAT will automatically fetch and keep the plugin updated with the latest beta tags.

---

## Final Thoughts

This plugin was born from my own workflow frustrations. As someone who constantly modifies and perfects the same note, creating many variations until I'm satisfied, I needed a solution that gave me control. Not vault-wide version tracking. Not hidden modals. Just simple, intentional milestones for my ideas—with the option for automatic protection when I want it.

If that resonates with you—if you're someone who wants to consciously manage how your thoughts evolve, while also having a safety net for those inevitable "oops" moments—then this plugin might be exactly what you need.

***

*Made with ❤️ for writers, perfectionists, and conscious creators.*

***
