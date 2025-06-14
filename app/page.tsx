import { WorkHoursTracker } from "@/components/work-hours-tracker"

export default function Home() {
  return (
    <main className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Work Hours Tracker</h1>
      <WorkHoursTracker />
    </main>
  )
}
