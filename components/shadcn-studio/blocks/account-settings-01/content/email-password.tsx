"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import { MailIcon, EyeOffIcon, EyeIcon, CheckIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"

const requirements = [
  { regex: /.{12,}/, text: "At least 12 characters" },
  { regex: /[a-z]/, text: "At least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
  { regex: /[0-9]/, text: "At least 1 number" },
  {
    regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,
    text: "At least 1 special character",
  },
]

const EmailPass = () => {
  const [isVisible, setIsVisible] = useState(false)

  const [password, setPassword] = useState("")

  const toggleVisibility = () => setIsVisible((prevState) => !prevState)

  const strength = requirements.map((req) => ({
    met: req.regex.test(password),
    text: req.text,
  }))

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length
  }, [strength])

  const getColor = (score: number) => {
    if (score === 0) return "bg-border"
    if (score <= 1) return "bg-destructive"
    if (score <= 2) return "bg-orange-500 "
    if (score <= 3) return "bg-amber-500"
    if (score === 4) return "bg-yellow-400"

    return "bg-green-500"
  }

  const getText = (score: number) => {
    if (score === 0) return "Enter a password"
    if (score <= 2) return "Weak password"
    if (score <= 3) return "Medium password"
    if (score === 4) return "Strong password"

    return "Very strong password"
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
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

export default EmailPass
