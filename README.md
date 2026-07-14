# 个人 Agent Skills

本仓库收录可复用的 Agent Skills。每个技能均位于 `skills/` 下独立目录中，并包含一个 `SKILL.md` 文件。

## 可用技能

- `animated-theme-toggle` — 为前端项目添加、改造或评审带动画的明暗主题切换。
- `project-refactor` — 中文项目重构工作流：先分析方案，再一次确认后自主实施与验证。

## 安装技能

列出本仓库提供的技能：

```bash
npx skills add https://github.com/yrx100/agentSkills --list
```

按名称安装一个技能：

```bash
npx skills add https://github.com/yrx100/agentSkills --skill animated-theme-toggle
```

为 Codex 全局安装（无交互提示）：

```bash
npx skills add https://github.com/yrx100/agentSkills --skill animated-theme-toggle --agent codex --global --yes
```

## 添加技能

以技能名创建新目录，并在其中放入 `SKILL.md` 和可选资源：

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

请保持技能名唯一，并让目录名与 `SKILL.md` 中 `name` 字段使用相同的小写连字符格式名称。
