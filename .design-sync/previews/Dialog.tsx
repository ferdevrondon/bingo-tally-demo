import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from "next-appyy"

export function Open() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo jugador</DialogTitle>
          <DialogDescription>
            Completa los datos para agregar un jugador a esta ronda.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
