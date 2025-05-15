import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WorkHoursTracker } from "@/components/work-hours-tracker"

export default async function Home() {
  try {
    const supabase = createServerClient()

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      redirect("/login")
    }

    return (
      <main className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Work Hours Tracker</h1>
        <WorkHoursTracker />
      </main>
    )
  } catch (error) {
    console.error("Error in Home page:", error)
    redirect("/login")
  }
}
