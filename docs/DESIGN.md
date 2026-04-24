# EOS Pulse — Design System

## Theme

- **Base theme:** Dark (default and only theme for v1)
- **Font:** Inter Variable — imported from `@fontsource-variable/inter`
- **Primary color:** HSL `174.4 68.9% 34.2%` (light) / `173.4 72.7% 41.4%` (dark)
- **Border radius:** `0.45rem` (set in `mspbot.config.ts`)
- **Brand:** MSPBots teal on dark backgrounds

---

## Component Library

**All UI must be built with `@mspbots/ui` components exclusively.**

Never use raw HTML elements when a component exists. The lint-arch check enforces this.

### Raw HTML → Component Mapping

| Never use | Use instead |
|---|---|
| `<button>` | `Button` (variants: `default` / `secondary` / `outline` / `ghost` / `link` / `destructive`) |
| `<input>` | `Input`, or `InputGroup` + `InputGroupInput` for addons |
| `<textarea>` | `Textarea`, or `InputGroup` + `InputGroupTextarea` |
| `<select>` / `<option>` | `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` |
| `<input type="checkbox">` | `Checkbox` |
| `<input type="radio">` | `RadioGroup` + `RadioGroupItem` |
| `<table>` | `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableHead` + `TableCell` |
| `<dialog>` | `Dialog` or `AlertDialog` or `Sheet` or `Drawer` |
| `<label>` | `Label` |
| `<progress>` | `Progress` |
| `<details>` / `<summary>` | `Collapsible` or `Accordion` |
| `<nav>` breadcrumbs | `Breadcrumb` + sub-components |
| `<div role="alert">` | `Alert` + `AlertTitle` + `AlertDescription` |
| `<div role="tooltip">` | `Tooltip` + `TooltipTrigger` + `TooltipContent` |
| `<div>` dropdown menu | `DropdownMenu` + sub-components |
| `<div>` right-click menu | `ContextMenu` + sub-components |
| `<div>` card | `Card` + `CardHeader` + `CardContent` + `CardFooter` |
| `<div>` tabs | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` |
| `<div>` separator | `Separator` |
| `<div>` spinner | `Spinner` |
| `<div>` skeleton | `Skeleton` |
| `<div>` empty state | `Empty` + `EmptyHeader` + `EmptyTitle` + `EmptyDescription` |
| `<kbd>` | `Kbd`, `KbdGroup` |
| `<div>` avatar | `Avatar` + `AvatarImage` + `AvatarFallback` |
| `overflow-auto` / `overflow-scroll` | `ScrollArea` |
| `<div>` badge / pill | `Badge` |

---

## Layout

Uses `@mspbots/layout` — configured in `mspbot.config.ts`:

```ts
layout: {
  mode: 'vertical',        // vertical sidebar
  collapsible: true,
  defaultCollapsed: false,
  header: { enabled: true },
}
```

---

## Icons

- **`lucide-react` only** — never install other icon libraries
- Never use emoji as functional icons inside UI components
- Icon size defaults: `16` (inline), `20` (buttons), `24` (headings)

---

## Color Conventions

| Semantic meaning | Token |
|---|---|
| On-track / success | `Badge variant="success"` / `text-green-500` |
| Off-track / warning | `Badge variant="warning"` / `text-yellow-500` |
| At-risk / error / destructive | `Badge variant="destructive"` / `text-red-500` |
| Neutral / secondary info | `text-muted-foreground` |
| Active / selected | `text-primary` |

---

## EOS-Specific UI Patterns

### Rock Status Badge

```tsx
const ROCK_STATUS_VARIANT = {
  on_track:  'success',
  off_track: 'warning',
  complete:  'default',
  dropped:   'secondary',
} as const

<Badge variant={ROCK_STATUS_VARIANT[rock.status]}>
  {rock.status.replace('_', ' ')}
</Badge>
```

### Issue Status Badge

```tsx
const ISSUE_STATUS_VARIANT = {
  open:            'destructive',
  ids_in_progress: 'warning',
  resolved:        'success',
  dropped:         'secondary',
} as const
```

### IDS Issue Card Rules

- Status badge: top-right corner
- Owner avatar + name: bottom-left
- Resolution notes field: only visible when transitioning to `'resolved'`
- Resolution notes: show live character count with visual indicator at 50-char minimum
- Warn user if they try to submit with fewer than 50 chars — never silently truncate

### Meeting Segment Timer

```tsx
// Overrun threshold: segment target duration
<Progress value={elapsedPercent} className={elapsedPercent > 100 ? 'bg-destructive' : ''} />
```

- Progress turns red (`destructive` variant) when over-time
- Show elapsed / target format: `"12:34 / 60:00"`

### Meeting Close Guard

When a facilitator attempts to close a meeting with open issues, show:

```tsx
<AlertDialog>
  <AlertDialogTitle>Cannot close meeting</AlertDialogTitle>
  <AlertDialogDescription>
    {n} issue(s) must be resolved or dropped before closing.
  </AlertDialogDescription>
  {/* list blocking issues with links */}
</AlertDialog>
```

### Pre-meeting Check-in Form

- `Card` per person
- `Skeleton` while loading
- `Badge` showing submitted / pending status
- `Textarea` for headline (single line, short)
- Scorecard metrics rendered as `Input` fields with labels

---

## Class Merging

Always use `cn()` from `@mspbots/ui` for conditional class merging.

```tsx
import { cn } from '@mspbots/ui'

// ✅ correct
<div className={cn('base-class', isActive && 'active-class', className)} />

// ❌ never
<div className={`base-class ${isActive ? 'active-class' : ''}`} />
```

Never install `clsx`, `classnames`, or `tailwind-merge` separately — `cn()` covers all cases.

---

## Scrollable Areas

Always use `ScrollArea` for any container that may overflow.

```tsx
// ✅ correct
<ScrollArea className="h-[400px]">
  {items.map(...)}
</ScrollArea>

// ❌ never
<div className="overflow-auto h-[400px]">
  {items.map(...)}
</div>
```
