# Personal Agent Skills

This repository contains reusable Agent Skills. Each skill lives in its own
directory under `skills/` and includes a `SKILL.md` file.

## Available skills

- `animated-theme-toggle` — Add, retrofit, or review animated light/dark theme switching in frontend projects.

## Install a skill

List the skills available in this repository:

```bash
npx skills add https://github.com/yrx100/animated-theme-toggle --list
```

Install one skill by name:

```bash
npx skills add https://github.com/yrx100/animated-theme-toggle --skill animated-theme-toggle
```

Install globally for Codex without interactive prompts:

```bash
npx skills add https://github.com/yrx100/animated-theme-toggle --skill animated-theme-toggle --agent codex --global --yes
```

## Add another skill

Create a new directory using the skill name and put its `SKILL.md` and optional
resources inside it:

```text
skills/
├── animated-theme-toggle/
│   ├── SKILL.md
│   ├── assets/
│   ├── references/
│   └── test/
└── another-skill/
    └── SKILL.md
```

Keep each skill name unique and use the same lowercase, hyphenated name for its
directory and the `name` field in `SKILL.md`.
