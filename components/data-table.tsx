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
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  GripVerticalIcon,
  EllipsisVerticalIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from "lucide-react"

// ------------------------------------------------------------------
// TIPOS: la fila ya no tiene un shape fijo, es un registro genérico.
// Solo exigimos que tenga un "id" único.
// ------------------------------------------------------------------
export type DataRow = Record<string, string | number> & { id: number | string }

// Opción para columnas de tipo "select"
export interface DataTableSelectOption {
  label: string
  value: string
}

// Definición de cada columna que el consumidor del componente pasa
export interface DataTableColumnDef {
  /** clave dentro del objeto de datos, ej: "Nombre", "saldo positivo" */
  key: string
  /** texto que se muestra en el header de la tabla */
  header: string
  /** si es true, esta columna se muestra como link que abre el Drawer de detalle */
  isTitle?: boolean
  /** alinea el contenido a la derecha (útil para números/montos) */
  align?: "left" | "right"
  /** si es true, permite editar el valor inline con un input */
  editable?: boolean
  /**
   * tipo de celda a renderizar. "text" (default) muestra un Badge o Input,
   * "select" muestra un dropdown de shadcn con las "options" dadas.
   */
  type?: "text" | "select"
  /** opciones a mostrar cuando type === "select" */
  options?: DataTableSelectOption[]
  /** placeholder para el Select cuando el valor está vacío */
  placeholder?: string
  /** color del valor de esta columna (texto, y fondo/borde cuando se muestra como Badge), ej. saldo positivo/negativo */
  color?: "green" | "red"
  /** tamaño del texto del valor de esta columna */
  textSize?: "sm" | "base" | "lg" | "xl" | "2xl"
}

const columnTextColorClasses: Record<"green" | "red", string> = {
  green: "text-green-600 dark:text-green-500",
  red: "text-red-600 dark:text-red-500",
}

const columnBadgeColorClasses: Record<"green" | "red", string> = {
  green:
    "border-green-600/30 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-950 dark:text-green-400",
  red: "border-red-600/30 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950 dark:text-red-400",
}

const columnTextSizeClasses: Record<NonNullable<DataTableColumnDef["textSize"]>, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
}

// Acción configurable para el menú de 3 puntos (por fila)
export interface DataTableRowAction {
  /** identificador único de la acción */
  key: string
  /** texto mostrado en el menú */
  label: string
  /** estilo visual, ej. "destructive" para acciones como eliminar */
  variant?: "default" | "destructive"
  /** si es true, agrega un separador visual antes de esta acción */
  separatorBefore?: boolean
  /** callback ejecutado con la fila completa al seleccionar la acción */
  onSelect: (row: DataRow) => void
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, DataRow>()

function DragHandle({ id }: { id: number | string }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function DraggableRow({ row }: { row: Row<typeof features, DataRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

// ------------------------------------------------------------------
// Drawer de detalle genérico: recibe el registro y las columnas,
// y renderiza un input editable por cada columna.
// ------------------------------------------------------------------
function RowDetailDrawer({
  item,
  columns,
  titleKey,
}: {
  item: DataRow
  columns: DataTableColumnDef[]
  titleKey: string
}) {
  const isMobile = useIsMobile()
  return (
    <Drawer swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger
        render={
          <Button variant="link" className="w-fit px-0 text-left text-foreground" />
        }
      >
        {String(item[titleKey] ?? "")}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{String(item[titleKey] ?? "")}</DrawerTitle>
          <DrawerDescription>Detalle del registro</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <form className="flex flex-col gap-4">
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col gap-3">
                <Label htmlFor={`${item.id}-${col.key}`}>{col.header}</Label>
                <Input
                  id={`${item.id}-${col.key}`}
                  defaultValue={String(item[col.key] ?? "")}
                />
              </div>
            ))}
          </form>
        </div>
        <Separator />
        <DrawerFooter>
          <Button>Guardar</Button>
          <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ------------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------------
export interface DataTableProps {
  /** filas a mostrar, cada una debe tener un "id" */
  data: DataRow[]
  /**
   * definición de columnas. Si no se pasa, se infieren automáticamente
   * a partir de las claves del primer registro (excluyendo "id").
   */
  columns?: DataTableColumnDef[]
  /**
   * clave que se usa como "título" clickeable (abre el drawer de detalle).
   * Si no se especifica, se usa la primera columna.
   */
  titleKey?: string
  /**
   * muestra la columna de checkboxes (selección de filas) y el handle
   * de arrastre. Default: true.
   */
  enableRowSelection?: boolean
  /**
   * acciones del menú de 3 puntos al final de cada fila. Si no se pasa
   * (o se pasa un arreglo vacío), la columna de acciones no se renderiza.
   */
  rowActions?: DataTableRowAction[]
  /**
   * callback que se dispara cuando se edita una celda (input o select).
   * Útil para persistir cambios fuera del componente.
   */
  onCellChange?: (rowId: DataRow["id"], key: string, value: string) => void
}

function inferColumns(data: DataRow[]): DataTableColumnDef[] {
  if (!data.length) return []
  return Object.keys(data[0])
    .filter((key) => key !== "id")
    .map((key) => ({ key, header: key }))
}

export function DataTable({
  data: initialData,
  columns: columnsProp,
  titleKey,
  enableRowSelection = true,
  rowActions,
  onCellChange,
}: DataTableProps) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  const sortableId = React.useId()

  const columnDefs = React.useMemo(
    () => columnsProp ?? inferColumns(initialData),
    [columnsProp, initialData]
  )
  const resolvedTitleKey = titleKey ?? columnDefs[0]?.key ?? "id"
  const hasRowActions = !!rowActions && rowActions.length > 0

  const handleCellChange = React.useCallback(
    (rowId: DataRow["id"], key: string, value: string) => {
      setData((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
      )
      onCellChange?.(rowId, key, value)
    },
    [onCellChange]
  )

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  // Construcción dinámica de columnas a partir de columnDefs
  const columns = React.useMemo(() => {
    return columnHelper.columns([
      columnHelper.display({
        id: "drag",
        header: () => null,
        cell: ({ row }) => <DragHandle id={row.original.id} />,
      }),
      ...(enableRowSelection
        ? [
            columnHelper.display({
              id: "select",
              header: ({ table }) => (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                      table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                  />
                </div>
              ),
              cell: ({ row }) => (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                  />
                </div>
              ),
              enableSorting: false,
              enableHiding: false,
            }),
          ]
        : []),
      ...columnDefs.map((col) =>
        columnHelper.accessor((row) => row[col.key], {
          id: col.key,
          header: () =>
            col.align === "right" ? (
              <div className="w-full text-right">{col.header}</div>
            ) : (
              col.header
            ),
          cell: ({ row }) => {
            const value = row.original[col.key]

            // La columna "título" abre el drawer de detalle
            if (col.key === resolvedTitleKey) {
              return (
                <RowDetailDrawer item={row.original} columns={columnDefs} titleKey={resolvedTitleKey} />
              )
            }

            // Columna tipo "select": dropdown de shadcn con las opciones dadas
            if (col.type === "select") {
              const options = col.options ?? []
              return (
                <Select
                  value={String(value ?? "")}
                  onValueChange={(next) => handleCellChange(row.original.id, col.key, next)}
                  items={options}
                >
                  <SelectTrigger
                    className="w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
                    size="sm"
                  >
                    <SelectValue placeholder={col.placeholder ?? "Seleccionar"} />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )
            }

            if (col.editable) {
              return (
                <Input
                  className={cn(
                    "h-8 w-full border-transparent bg-transparent shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30",
                    col.color && columnTextColorClasses[col.color],
                    col.textSize && columnTextSizeClasses[col.textSize]
                  )}
                  defaultValue={String(value ?? "")}
                  style={{ textAlign: col.align === "right" ? "right" : "left" }}
                  onBlur={(e) => handleCellChange(row.original.id, col.key, e.target.value)}
                />
              )
            }

            return (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5",
                  col.color ? columnBadgeColorClasses[col.color] : "text-muted-foreground",
                  col.textSize && columnTextSizeClasses[col.textSize]
                )}
              >
                {String(value ?? "")}
              </Badge>
            )
          },
        })
      ),
      ...(hasRowActions
        ? [
            columnHelper.display({
              id: "actions",
              cell: ({ row }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="flex size-8 text-muted-foreground data-open:bg-muted"
                        size="icon"
                      />
                    }
                  >
                    <EllipsisVerticalIcon />
                    <span className="sr-only">Open menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {rowActions!.map((action) => (
                      <React.Fragment key={action.key}>
                        {action.separatorBefore && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          variant={action.variant}
                          onClick={() => action.onSelect(row.original)}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            }),
          ]
        : []),
    ])
  }, [columnDefs, resolvedTitleKey, enableRowSelection, hasRowActions, rowActions, handleCellChange])

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    getRowId: (row) => row.id.toString(),
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-lg border">
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          id={sortableId}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : <FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {table.getRowModel().rows?.length ? (
                <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={
                      columnDefs.length + 1 + (enableRowSelection ? 1 : 0) + (hasRowActions ? 1 : 0)
                    }
                    className="h-24 text-center"
                  >
                    Sin resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Página {table.state.pagination.pageIndex + 1} de {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// EJEMPLO DE USO
// ------------------------------------------------------------------
//
// const data = [
//   {
//     id: 1,
//     Nombre: "Juan amor",
//     usuario: "@amor_j",
//     "metodo de pago": "Paypal",
//     "saldo positivo": "130$",
//     "saldo negativo": "0",
//   },
// ]
//
// <DataTable
//   data={data}
//   titleKey="Nombre"
//   // checkbox opcional: si se omite o es false, no se renderiza esa columna
//   enableRowSelection={true}
//   columns={[
//     { key: "Nombre", header: "Nombre" },
//     { key: "usuario", header: "Usuario" },
//     {
//       key: "metodo de pago",
//       header: "Método de pago",
//       type: "select", // <- columna tipo selector
//       options: [
//         { label: "Paypal", value: "Paypal" },
//         { label: "Tarjeta de crédito", value: "Tarjeta de crédito" },
//         { label: "Transferencia", value: "Transferencia" },
//         { label: "Efectivo", value: "Efectivo" },
//       ],
//     },
//     { key: "saldo positivo", header: "Saldo positivo", align: "right", editable: true, color: "green", textSize: "lg" },
//     { key: "saldo negativo", header: "Saldo negativo", align: "right", editable: true, color: "red", textSize: "lg" },
//   ]}
//   // el callback recibe (rowId, key, nuevoValor) cada vez que se edita
//   // un input o se cambia un select
//   onCellChange={(rowId, key, value) => {
//     console.log("cambio en fila", rowId, key, value)
//   }}
//   // menú de 3 puntos: opcional. Si no se pasa "rowActions" (o va vacío),
//   // la columna de acciones no se renderiza en absoluto.
//   rowActions={[
//     { key: "edit", label: "Editar", onSelect: (row) => console.log("editar", row) },
//     { key: "duplicate", label: "Duplicar", onSelect: (row) => console.log("duplicar", row) },
//     {
//       key: "delete",
//       label: "Eliminar",
//       variant: "destructive",
//       separatorBefore: true,
//       onSelect: (row) => console.log("eliminar", row),
//     },
//   ]}
// />
//
// O, si no pasas "columns", el componente las infiere automáticamente
// a partir de las claves del primer objeto (usando la clave como header).