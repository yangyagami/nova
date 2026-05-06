# Nova — AI-Powered Horror Novel Generator

**Nova** is a desktop application built with Tauri 2 that helps creators write compelling horror novels with AI assistance. From a one-sentence premise to a complete full-length novel, Nova handles outline generation, chapter-by-chapter writing, lore management, and AI-assisted polishing — all running locally on your machine.

![Tech Stack](https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite)

---

## Why Nova?

Generic AI writing tools fail at long-form horror for three reasons:

- **Character inconsistency** — the protagonist's eye color changes by chapter 20
- **No horror atmosphere** — the output reads like bland action, not creeping dread
- **Data on the cloud** — drafts and API keys live on someone else's server

Nova solves all three with a local-first architecture, horror-specialized prompt templates, and an automatic lore database that keeps your world consistent across hundreds of thousands of words.

---

## Target Users

- **Indie authors** publishing horror serials on platforms like FanFiction, Royal Road, or Kindle Vella
- **Content creators** producing horror shorts for social media or newsletter distribution
- **Horror enthusiasts** who want to experiment with AI-assisted storytelling in a privacy-respecting environment

---

## Key Features

### 🧠 Horror-Specialized AI Engine
- Dedicated system prompts tuned for horror writing (atmosphere, pacing, dread-building)
- Subgenre templates: **urban legend** and **folk horror**
- Task-specific templates: outline, chapter generation, summarization, lore extraction, polishing

### 📖 Full Novel Pipeline
| Stage | Description |
|---|---|
| **Premise** | Start with a one-line core idea |
| **Outline** | AI generates multi-volume structure with chapter-level details, horror beats, and hooks |
| **Writing** | Stream chapter generation with real-time output |
| **Polishing** | AI-assisted rewrite, expand, enhance horror, remove AI-isms, switch to first-person |
| **Export** | TXT, Word (.docx), Markdown |

### 🗃️ Automatic Lore Management
- Characters, locations, monsters, items, and organizations are **automatically extracted** from each chapter
- Lore entries are **injected into generation prompts** to maintain consistency
- Manual lock protects critical entries from being overwritten

### 🔒 100% Local & Private
- All data stored in a local SQLite database
- API key encrypted using system keychain via tauri-plugin-stronghold
- Zero telemetry, zero cloud storage — only outgoing requests are to your configured AI API

### 🎨 Dark Theme
- Built with a blood-red accent palette (`hsl(346 77% 49.8%)`) to match the horror genre
- Full dark mode across all components, including custom dropdowns and dialogs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | **Tauri 2.x** (~10MB installer) |
| Frontend | **React 18 + TypeScript 5** |
| Build Tool | **Vite 6** |
| Styling | **Tailwind CSS 3 + shadcn/ui** |
| State | **Zustand 5** |
| Editor | **TipTap 2** (ProseMirror-based rich text) |
| Database | **SQLite** (via `@tauri-apps/plugin-sql`) |
| AI Client | Custom streaming SSE client with exponential backoff retry |
| Routing | **React Router 6** |

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Rust 1.95+ (cargo)
- Tauri system dependencies (see [Tauri docs](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd nova

# Install JavaScript dependencies
pnpm install

# Run in development mode
pnpm tauri:dev
```

### Configuration
1. Launch Nova
2. Navigate to **Settings**
3. Enter your API key (OpenAI-compatible format)
4. Configure your API endpoint (defaults to DeepSeek)
5. Select or type your model name
6. Adjust temperature and max tokens to taste

---

## Project Structure

```
nova/
├── docs/                    # PRD and SPEC documentation (Chinese)
├── src/
│   ├── components/          # Reusable UI components (shadcn/ui style)
│   │   └── ui/              # Button, Input, Card, Select, Dialog, Badge
│   ├── db/                  # SQLite migrations and schema
│   ├── lib/                 # Utilities (db init, formatting, cn helper)
│   ├── pages/               # Dashboard, Settings, ProjectSetup, etc.
│   ├── services/
│   │   ├── deepseek/        # AI API client (streaming, retry, error handling)
│   │   └── prompt/          # Horror-specialized prompt templates
│   ├── stores/              # Zustand stores (project, settings)
│   └── types/               # TypeScript interfaces and types
├── src-tauri/
│   ├── src/                 # Rust backend (commands, db init)
│   ├── capabilities/        # Tauri capability permissions
│   └── tauri.conf.json      # Tauri configuration
└── package.json
```

---

## Development Status

| Milestone | Status | Features |
|---|---|---|
| **M1: Scaffold** | ✅ Complete | Tauri+SQLite integration, settings page, DeepSeek client, prompt templates, dark theme |
| **M2: Outline** | 🔄 In progress | AI outline generation, streaming output, project management |
| **M3: Writing** | ⬜ Planned | Chapter generation, batch writing, progress visualization |
| **M4: Editor** | ⬜ Planned | TipTap rich text editor, AI polish panel, version history |
| **M5: Lore & Export** | ⬜ Planned | Auto lore extraction, character management, TXT/DOCX/MD export |

---

## License

MIT
