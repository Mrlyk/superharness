# Architecture Conventions

## Pre-Dev Checklist

- [ ] Read `layering.md` for layered architecture rules

## Quality Check

- [ ] Code follows layered architecture (Controller -> Service -> Repository)
- [ ] No layer violations (e.g., Controller directly accessing Repository)
- [ ] Dependencies flow inward
