"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageIcon, UploadCloudIcon, TrashIcon } from "lucide-react"



const PersonalInfo = () => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      const t = window.setTimeout(() => setPreview(null), 0)

      return () => clearTimeout(t)
    }

    const url = URL.createObjectURL(file)

    const t = window.setTimeout(() => setPreview(url), 0)

    return () => {
      clearTimeout(t)
      URL.revokeObjectURL(url)
    }
  }, [file])

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]

    if (!f) return

    if (!f.type.startsWith("image/")) {
      window.alert("Please select an image file")
      e.currentTarget.value = ""

      return
    }

    if (f.size > 1024 * 1024) {
      window.alert("File must be smaller than 1MB")
      e.currentTarget.value = ""

      return
    }

    setFile(f)
  }

  const openPicker = () => inputRef.current?.click()

  const remove = () => {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold">Información de casa</h3>
        <p className="text-sm text-muted-foreground">
          Maneja la información de tu casa.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <form className="mx-auto">
          <div className="mb-6 w-full space-y-2">
            <Label>Your Avatar</Label>
            <div className="flex items-center gap-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload your avatar"
                onClick={openPicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openPicker()
                  }
                }}
                className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed hover:opacity-95"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="avatar preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={openPicker}
                  className="flex items-center gap-2"
                >
                  <UploadCloudIcon />
                  Upload avatar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={remove}
                  disabled={!file}
                  className="text-destructive!"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Pick a photo up to 1MB.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="name-house">Nombre de la Casa</Label>
              <Input id="name-house" placeholder="E D Bingo" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="id-house">ID de la Casa</Label>
              <Input id="id-house" placeholder="EDB" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="phone-number">Mobile</Label>
              <Input
                id="phone-number"
                type="tel"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </form>
        <div className="flex justify-end">
          <Button type="submit" className="max-sm:w-full">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PersonalInfo
