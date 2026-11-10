"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { RoundKindBadge, roundKindClasses } from "@/components/round-kind-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  applyShortcut,
  cycleLength,
  MAX_PATTERN_BLOCKS,
  MAX_REPEAT_COUNT,
  PATTERN_SHORTCUTS,
  patternSummary,
  previewStrip,
  withTemplates,
  type PatternBlockInput,
} from "@/lib/round-pattern"
import { roundOptionLabel, type Round } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// The cycle of an automatic game session: blocks `round template × count`,
// in play order (drag to reorder; the first block is the first round). Below,
// the preview strip of the next rounds and the summary sentence.

/** A block being edited, with a stable id for drag and drop. */
export interface EditorBlock extends PatternBlockInput {
  id: string
}

let nextBlockId = 0
export function newEditorBlock(block: PatternBlockInput): EditorBlock {
  nextBlockId += 1
  return { ...block, id: `block-${nextBlockId}` }
}

function BlockRow({
  block,
  index,
  templates,
  onChange,
  onRemove,
  canRemove,
}: {
  block: EditorBlock
  index: number
  templates: Round[]
  onChange: (block: EditorBlock) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const template = templates.find((t) => t.id === block.roundTemplateId)
  const items = templates.map((t) => ({ value: String(t.id), label: roundOptionLabel(t) }))

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="relative z-0 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 data-[dragging=true]:z-10 data-[dragging=true]:shadow-md sm:flex-nowrap"
    >
      <Button
        {...attributes}
        {...listeners}
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 cursor-grab touch-none text-muted-foreground"
        aria-label={`Arrastrar el bloque ${index + 1} para reordenar`}
      >
        <GripVerticalIcon className="size-4" />
      </Button>
      <span className="w-5 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Select
          value={String(block.roundTemplateId)}
          onValueChange={(value) => {
            const id = Number(value)
            if (id) onChange({ ...block, roundTemplateId: id })
          }}
          items={items}
        >
          <SelectTrigger className="min-w-0 flex-1" aria-label={`Ronda del bloque ${index + 1}`}>
            <SelectValue placeholder="Selecciona una ronda" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {templates.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {roundOptionLabel(t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {template && <RoundKindBadge kind={template.kind} />}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={block.repeatCount <= 1}
          onClick={() => onChange({ ...block, repeatCount: block.repeatCount - 1 })}
          aria-label="Una vez menos"
        >
          <MinusIcon className="size-4" />
        </Button>
        <span
          className="w-10 text-center text-sm font-semibold tabular-nums"
          aria-live="polite"
          aria-label={`${block.repeatCount} veces`}
        >
          ×{block.repeatCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={block.repeatCount >= MAX_REPEAT_COUNT}
          onClick={() => onChange({ ...block, repeatCount: block.repeatCount + 1 })}
          aria-label="Una vez más"
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Eliminar el bloque ${index + 1}`}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </li>
  )
}

/** The next rounds, a letter each, with a bar where the cycle repeats. */
export function PatternPreviewStrip({
  blocks,
  templates,
}: {
  blocks: PatternBlockInput[]
  templates: Round[]
}) {
  const full = withTemplates(blocks, templates)
  const length = cycleLength(full)
  const strip = previewStrip(full, Math.min(length * 2 + 1, 41))
  if (strip.length === 0) return null

  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Próximas rondas">
      {strip.map((item) => (
        <li key={item.index} className="flex items-center gap-1.5">
          {item.cycleStart && (
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-foreground/40" />
          )}
          <span
            title={`Ronda ${item.index + 1} · ${item.name}`}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-xs font-bold",
              roundKindClasses(item.kind)
            )}
          >
            <span aria-hidden="true">{item.short}</span>
            <span className="sr-only">
              Ronda {item.index + 1}: {item.name}
              {item.cycleStart ? ", se repite el ciclo" : ""}
            </span>
          </span>
        </li>
      ))}
      <li aria-hidden="true" className="text-sm text-muted-foreground">
        …
      </li>
    </ol>
  )
}

export function RoundPatternEditor({
  templates,
  blocks,
  onChange,
}: {
  templates: Round[]
  blocks: EditorBlock[]
  onChange: (blocks: EditorBlock[]) => void
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const dndId = React.useId()
  const summary = patternSummary(withTemplates(blocks, templates))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = blocks.findIndex((b) => b.id === active.id)
    const to = blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(blocks, from, to))
  }

  function addBlock() {
    // A different template than the last block's, when there is one.
    const last = blocks[blocks.length - 1]
    const template = templates.find((t) => t.id !== last?.roundTemplateId) ?? templates[0]
    if (!template) return
    onChange([...blocks, newEditorBlock({ roundTemplateId: template.id, repeatCount: 1 })])
  }

  function pickShortcut(id: string) {
    const shortcut = PATTERN_SHORTCUTS.find((s) => s.id === id)
    const applied = shortcut ? applyShortcut(shortcut, templates) : null
    if (applied) onChange(applied.map(newEditorBlock))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Atajos:</span>
        {PATTERN_SHORTCUTS.map((shortcut) => {
          const available = applyShortcut(shortcut, templates) !== null
          return (
            <Button
              key={shortcut.id}
              variant="outline"
              size="sm"
              disabled={!available}
              title={available ? undefined : "Falta una ronda de ese tipo en el catálogo"}
              onClick={() => pickShortcut(shortcut.id)}
            >
              {shortcut.label}
            </Button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        {blocks.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Agrega al menos una ronda al patrón.
          </p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2">
                {blocks.map((block, index) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    index={index}
                    templates={templates}
                    canRemove={blocks.length > 1}
                    onChange={(next) =>
                      onChange(blocks.map((b) => (b.id === next.id ? next : b)))
                    }
                    onRemove={() => onChange(blocks.filter((b) => b.id !== block.id))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        <Button
          variant="outline"
          className="w-fit gap-2"
          disabled={templates.length === 0 || blocks.length >= MAX_PATTERN_BLOCKS}
          onClick={addBlock}
        >
          <PlusIcon className="size-4" />
          Agregar ronda al patrón
        </Button>
        <p className="text-xs text-muted-foreground">
          La primera ronda del patrón es la ronda inicial. Arrastra los bloques para cambiar el
          orden.
        </p>
      </div>

      {blocks.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <span className="text-xs font-bold tracking-wide uppercase">Vista previa</span>
          <PatternPreviewStrip blocks={blocks} templates={templates} />
          <p className="text-sm">{summary}</p>
        </div>
      )}
    </div>
  )
}
