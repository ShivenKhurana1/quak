# LADIES AND GENTLEMEN WELCOME TO QUAKKK (thanks to inspo from the project "milo" from the bulletin that one week!

**the terminal quakker that codes with you, builds with you, 🚢s with you.**

## Features

### AI Agent features and stuff
- **Four modes** — `agent` (full tool access), `chat` (conversation), `plan` (strategic), `dontAsk` (no permission prompts)
- **Rich toolset** — read/write/edit files, search code, run shell commands, lint, test, search the web, create projects, manage git, take screenshots, and more
- **Sub-agents** — delegates like specialized tasks and stuff
- **Session persistence** — can resume conversations to get back to them
- **Memory** — long-term memory via the `MEMORY.md` file and vector search
- **Context-aware** — looks at per-project `QUAK.md`, git status, recent file changes for info
- **LSP client** — go-to-definition, find references, completions, hover info

### Commands to use duh 🔥🔥😄
`/help`, `/pet`, `/feed`, `/bread`, `/stats`, `/current`, `/achievements`, `/init`, `/undo`, `/stop`, `/cost`, `/search`, `/export`, `/mode`, `/project`, `/permissions`, `/memory`, `/plan`, `/resume`, `/provider`, `/quack`, `/genz`, `/vibe`, `/swim`, `/pond`, `/migrate`, `/dive`, `/crimes`, `/clean`

### Extensibility because extending is fun??
- **MCP (Model Context Protocol)** — plug in external MCP servers. (Not sure if this fully works yet tho)
- **Custom prompts** — override the systems prompts in `~/.quak/prompts/`

### Security cuz who doesnt want that
- **Encrypted credentials** — AES-256-GCM encrypted key storage
- **Granular permissions** — allow/ask/deny rules with glob patterns, protected paths
- **File checkpoints** — automatic undo for file edits

## Installation

```bash
npm install -g @shiviwhivi/quak
```

Then run:

```bash
quak
```

Or run directly from source:

```bash
npx tsx src/cli.ts
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Test
npx vitest run
```

## Requirements

- Node.js 18+
- A terminal that supports Unicode and 256 colors

## Configuration

Quak stores its data in `~/.quak/`:
- `state.json` — XP, level, bread, streaks
- `providers.json` — AI provider configs
- `settings.json` — permissions, notifications, agent settings
- `sessions/` — saved conversations
- `memory/` — long-term memory
- `plugins/` — user-installed plugins
- `mcp.json` — MCP server configs

Per-project context goes in `QUAK.md` (generate with `/init`).
