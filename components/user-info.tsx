"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

import { MailIcon } from "lucide-react"
import { Input } from "@/components/ui/input"


const UserInfo = () => {


  return (
    <div className=" px-2  py-6 grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold">Usuario y Correo</h3>
        <p className="text-sm text-muted-foreground">
          Maneja tu usuario y correo.
        </p>
      </div>

      {/* Content */}
      <div className="lg:col-span-2">
        <form className="mx-auto space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="user-name">Usuario</Label>
              <Input id="user-name" placeholder="Dairy Dalmonte" />
            </div>
              <div className="flex flex-col items-start gap-2">
            <Label htmlFor="email" className="gap-1">
              Email<span className="text-destructive">*</span>
            </Label>
            <InputGroup>
              <InputGroupInput
                id="email"
                type="email"
                placeholder="Email address"
                required
              />
              <InputGroupAddon align="inline-end" className="pr-2.75">
                <MailIcon className="size-4" />
                <span className="sr-only">Email</span>
              </InputGroupAddon>
            </InputGroup>
          </div>
          </div>
    

          <div className="mt-6 flex justify-end">
            <Button type="submit" className="max-sm:w-full">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserInfo
