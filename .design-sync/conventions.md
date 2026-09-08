## Setup

No global provider is required to use most components — `Button`, `Card`, `Badge`, `Input`, `Label`, `Field`, `Select`, `Dialog`, `Table`, `Tabs`, `Checkbox`, and `Breadcrumb` all work standalone. Two exceptions need a wrapper from their own family:

- `Sidebar` and its subcomponents (`SidebarProvider`, `SidebarContent`, `SidebarMenu*`, etc.) must be composed inside `SidebarProvider`.
- `Tooltip` subcomponents (`TooltipContent`, `TooltipTrigger`) must be composed inside `TooltipProvider`.

Overlay components (`Dialog`, `Select`, `Sheet`, `Drawer`, `DropdownMenu`) are self-contained root components — no extra wrapper needed, just compose `<X><XTrigger/><XContent>...</XContent></X>`.

Dark mode is a class toggle, not a provider: add `.dark` to an ancestor element (typically `<html>`) and every token flips automatically.

## Styling idiom

This kit is Tailwind v4 utility classes on top of CSS custom-property tokens (OKLCH color space), defined once in `:root` / `.dark` and consumed as `bg-primary`, `text-primary-foreground`, etc. Real token pairs from this kit — always use the foreground/background pair together, never hardcode a hex:

| Pair | Use for |
|---|---|
| `bg-primary` / `text-primary-foreground` | primary buttons, active tab, selected item |
| `bg-secondary` / `text-secondary-foreground` | secondary buttons, secondary badges |
| `bg-destructive/10` / `text-destructive` | destructive buttons, error/invalid states |
| `bg-muted` / `text-muted-foreground` | tab list background, descriptions, disabled text |
| `bg-card` / `text-card-foreground` | card surfaces |
| `bg-popover` / `text-popover-foreground` | dialog/select/dropdown surfaces |
| `border-input` / `bg-input/30` | input, select-trigger borders and fills |
| `ring-foreground/10` | 1px hairline card/popover border (`ring-1`, not `border`) |

Shape language: pill controls use `rounded-4xl` (buttons, inputs, badges, select/tabs triggers); surfaces use `rounded-2xl` (cards, dialogs, popovers) or `rounded-xl` for nested items (dialog corners, menu items). Interactive elements share one focus ring recipe: `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`. Invalid/error state is `aria-invalid` (not a `variant` prop) driving `aria-invalid:border-destructive aria-invalid:ring-destructive/20` automatically — just set `aria-invalid` on `Input`/`Field` rather than adding manual error classes.

Variant props follow CVA (`class-variance-authority`) on components that have them: `Button` (`variant`: default/outline/secondary/ghost/destructive/link, `size`: xs/sm/default/lg/icon…), `Badge` (`variant`: default/secondary/destructive/outline/ghost), `Card` (`size`: default/sm). Compound components (`Card`, `Dialog`, `Select`, `Field`, `Table`, `Tabs`, `Breadcrumb`) are always used as their full family, never a bare root — e.g. `Card` needs `CardHeader`/`CardTitle`/`CardContent` children to look right, not raw text.

## Where the truth lives

Read `styles.css` (imports `_ds_bundle.css`, which holds every token and utility class actually used) before styling anything new. Per-component API: `<Name>.d.ts`. Per-component usage: `<Name>.prompt.md`.

## Example

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter, Badge, Button } from "next-appyy"

<Card className="w-80">
  <CardHeader>
    <CardTitle>Números disponibles</CardTitle>
    <CardDescription>Números aún sin jugador asignado</CardDescription>
    <CardAction>
      <Badge variant="outline">14 sin jugador</Badge>
    </CardAction>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">...</p>
  </CardContent>
  <CardFooter>
    <Button size="sm" variant="outline">Ver detalle</Button>
  </CardFooter>
</Card>
```
