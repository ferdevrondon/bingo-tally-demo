import type { User } from "@supabase/supabase-js"

export type AppUser = {
  name: string
  email: string
  avatar: string
}

export function toAppUser(user: User): AppUser {
  return {
    name: user.user_metadata?.full_name ?? user.email ?? "Usuario",
    email: user.email ?? "",
    avatar: user.user_metadata?.avatar_url ?? "/avatars/shadcn.jpg",
  }
}
