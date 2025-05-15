import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export const createServerClient = () => {
  try {
    return createServerComponentClient<Database>({ cookies })
  } catch (error) {
    console.error("Error creating server client:", error)
    throw error
  }
}
