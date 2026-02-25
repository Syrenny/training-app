# Implementation Plan: Корректировки интерфейса

**Branch**: `003-ui-tweaks` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)

## Summary

Фронтенд-корректировки: визуальное выравнивание карточек, дропдаун недель из shadcn, иконка гантели из Lucide, state management через Zustand (кэширование + персистентность).

## Technical Context

**Language/Version**: TypeScript 5.9, React 19
**Primary Dependencies**: Zustand (new), lucide-react (existing), shadcn/ui (existing)
**Storage**: localStorage (via Zustand persist middleware)
**Testing**: Manual visual verification
**Target Platform**: Telegram Mini App (mobile)
**Project Type**: Frontend SPA

## Project Structure

```text
frontend/src/
├── lib/
│   └── store.ts              # NEW: Zustand store (week/day state + API cache)
├── components/
│   ├── WeekSelector.tsx       # MODIFY: replace buttons with shadcn dropdown
│   ├── ExerciseCard.tsx       # MODIFY: align number/badge, add dumbbell icon
│   └── DayTabs.tsx            # MODIFY: controlled tab from store
├── pages/
│   └── ProgramPage.tsx        # MODIFY: use store instead of local state
└── components/ui/
    └── select.tsx             # NEW: shadcn Select component
```
