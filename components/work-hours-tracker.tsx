"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { AlertCircle, Clock, MapPin, RotateCcw, History, Wifi, WifiOff, LogOut } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import { supabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"

type WorkEntry = {
  id: string
  date: Date
  startTime: string
  endTime: string
  hoursWorked: number
  location: string
  kilometers: number
  addedAt: string
}

type PeriodSummary = {
  id: string
  startDate: string
  endDate: string
  resetDate: string
  totalHours: number
  totalKilometers: number
}

export function WorkHoursTracker() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [location, setLocation] = useState("Brakel 18km")
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [totalKilometers, setTotalKilometers] = useState(0)
  const [error, setError] = useState("")
  const [previousPeriods, setPreviousPeriods] = useState<PeriodSummary[]>([])
  const [lastResetTime, setLastResetTime] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { user, signOut } = useAuth()
  const router = useRouter()

  // Check if user is authenticated
  useEffect(() => {
    if (!user && !isLoading) {
      router.push("/login")
    }
  }, [user, router, isLoading])

  // Load data from Supabase on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setIsLoading(true)

        // Load work entries
        const { data: entriesData, error: entriesError } = await supabaseClient
          .from("work_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })

        if (entriesError) throw entriesError

        // Transform entries to match our local format
        const transformedEntries = entriesData.map((entry) => ({
          id: entry.id,
          date: new Date(entry.date),
          startTime: entry.start_time,
          endTime: entry.end_time,
          hoursWorked: Number(entry.hours_worked),
          location: entry.location,
          kilometers: entry.kilometers,
          addedAt: entry.added_at,
        }))

        setEntries(transformedEntries)

        // Load period summaries
        const { data: periodsData, error: periodsError } = await supabaseClient
          .from("period_summaries")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (periodsError) throw periodsError

        setPreviousPeriods(periodsData)

        // Load user settings (last reset time)
        const { data: settingsData, error: settingsError } = await supabaseClient
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (settingsError && settingsError.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is fine for new users
          throw settingsError
        }

        if (settingsData?.last_reset_time) {
          setLastResetTime(settingsData.last_reset_time)
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setError("Failed to load your data. Please refresh the page.")
        setIsLoading(false)
      }
    }

    if (user) {
      loadData()
    }
  }, [user])

  // Set online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: "You're back online",
        description: "Your data will now sync automatically",
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: "You're offline",
        description: "Don't worry, your data is saved locally",
        variant: "destructive",
      })
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [toast])

  // Calculate totals whenever entries or lastResetTime change
  useEffect(() => {
    // Only count entries that were added after the last reset
    const currentPeriodEntries = entries.filter((entry) => {
      return !lastResetTime || new Date(entry.addedAt).getTime() > new Date(lastResetTime).getTime()
    })

    const hours = currentPeriodEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0)
    const km = currentPeriodEntries.reduce((sum, entry) => sum + entry.kilometers, 0)

    setTotalHours(hours)
    setTotalKilometers(km)
  }, [entries, lastResetTime])

  const calculateHours = (start: string, end: string): number => {
    const [startHour, startMinute] = start.split(":").map(Number)
    const [endHour, endMinute] = end.split(":").map(Number)

    let hours = endHour - startHour
    let minutes = endMinute - startMinute

    if (minutes < 0) {
      hours -= 1
      minutes += 60
    }

    return Number.parseFloat((hours + minutes / 60).toFixed(2))
  }

  const getKilometers = (loc: string): number => {
    return loc.includes("Brakel") ? 18 : 50
  }

  const handleAddEntry = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add entries",
        variant: "destructive",
      })
      return
    }

    if (!date) {
      setError("Please select a date")
      return
    }

    const hoursWorked = calculateHours(startTime, endTime)

    if (hoursWorked <= 0) {
      setError("End time must be after start time")
      return
    }

    const kilometers = getKilometers(location)
    const now = new Date().toISOString()
    const formattedDate = format(date, "yyyy-MM-dd")

    try {
      // Check if entry for this date already exists
      const existingEntryIndex = entries.findIndex(
        (entry) => format(new Date(entry.date), "yyyy-MM-dd") === formattedDate,
      )

      if (existingEntryIndex >= 0) {
        // Update existing entry
        const existingEntry = entries[existingEntryIndex]

        const { data, error } = await supabaseClient
          .from("work_entries")
          .update({
            start_time: startTime,
            end_time: endTime,
            hours_worked: hoursWorked,
            location: location,
            kilometers: kilometers,
            updated_at: now,
          })
          .eq("id", existingEntry.id)
          .select()

        if (error) throw error

        // Update local state
        const updatedEntry = {
          ...existingEntry,
          startTime,
          endTime,
          hoursWorked,
          location,
          kilometers,
        }

        const updatedEntries = [...entries]
        updatedEntries[existingEntryIndex] = updatedEntry
        setEntries(updatedEntries)

        toast({
          title: "Entry updated",
          description: `Updated entry for ${format(date, "MMMM d, yyyy")}`,
        })
      } else {
        // Add new entry
        const { data, error } = await supabaseClient
          .from("work_entries")
          .insert({
            user_id: user.id,
            date: formattedDate,
            start_time: startTime,
            end_time: endTime,
            hours_worked: hoursWorked,
            location: location,
            kilometers: kilometers,
            added_at: now,
          })
          .select()

        if (error) throw error

        // Add to local state
        const newEntry: WorkEntry = {
          id: data[0].id,
          date: date,
          startTime,
          endTime,
          hoursWorked,
          location,
          kilometers,
          addedAt: now,
        }

        setEntries([newEntry, ...entries])

        toast({
          title: "Entry added",
          description: `Added new entry for ${format(date, "MMMM d, yyyy")}`,
        })
      }

      setError("")
    } catch (error) {
      console.error("Error saving entry:", error)
      setError("Failed to save entry. Please try again.")
    }
  }

  const handleResetTotals = async () => {
    if (!user) return

    if (confirm("Are you sure you want to reset the totals? This will start a new calculation period.")) {
      try {
        const now = new Date()
        const resetTime = now.toISOString()

        // Find entries from the current period
        const currentPeriodEntries = entries.filter((entry) => {
          return !lastResetTime || new Date(entry.addedAt).getTime() > new Date(lastResetTime || "").getTime()
        })

        // Find the last entry date in the current period
        let endDate = "No entries"
        if (currentPeriodEntries.length > 0) {
          // Sort entries by date
          const sortedEntries = [...currentPeriodEntries].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
          endDate = format(new Date(sortedEntries[0].date), "MMMM d, yyyy")
        }

        // Find the first entry date in the current period
        let startDate = "No entries"
        if (currentPeriodEntries.length > 0) {
          // Sort entries by date
          const sortedEntries = [...currentPeriodEntries].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )
          startDate = format(new Date(sortedEntries[0].date), "MMMM d, yyyy")
        }

        // Save the current period summary before resetting
        if (totalHours > 0) {
          const { data, error } = await supabaseClient
            .from("period_summaries")
            .insert({
              user_id: user.id,
              start_date: startDate,
              end_date: endDate,
              reset_date: format(now, "MMMM d, yyyy 'at' h:mm a"),
              total_hours: totalHours,
              total_kilometers: totalKilometers,
            })
            .select()

          if (error) throw error

          // Add to local state
          const newPeriodSummary: PeriodSummary = {
            id: data[0].id,
            startDate,
            endDate,
            resetDate: format(now, "MMMM d, yyyy 'at' h:mm a"),
            totalHours,
            totalKilometers,
          }

          setPreviousPeriods([newPeriodSummary, ...previousPeriods])
        }

        // Update the last reset time in user settings
        const { error: settingsError } = await supabaseClient.from("user_settings").upsert({
          user_id: user.id,
          last_reset_time: resetTime,
          updated_at: resetTime,
        })

        if (settingsError) throw settingsError

        // Update local state
        setLastResetTime(resetTime)

        toast({
          title: "Totals reset",
          description: "Your previous period has been saved and a new period has started",
        })
      } catch (error) {
        console.error("Error resetting totals:", error)
        setError("Failed to reset totals. Please try again.")
      }
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!user) return

    try {
      const { error } = await supabaseClient.from("work_entries").delete().eq("id", id)

      if (error) throw error

      // Update local state
      const updatedEntries = entries.filter((entry) => entry.id !== id)
      setEntries(updatedEntries)

      toast({
        title: "Entry deleted",
        description: "The entry has been removed",
      })
    } catch (error) {
      console.error("Error deleting entry:", error)
      setError("Failed to delete entry. Please try again.")
    }
  }

  const handleDeletePeriod = async (id: string) => {
    if (!user) return

    if (confirm("Are you sure you want to delete this period summary?")) {
      try {
        const { error } = await supabaseClient.from("period_summaries").delete().eq("id", id)

        if (error) throw error

        // Update local state
        const updatedPeriods = previousPeriods.filter((period) => period.id !== id)
        setPreviousPeriods(updatedPeriods)

        toast({
          title: "Period deleted",
          description: "The period summary has been removed",
        })
      } catch (error) {
        console.error("Error deleting period:", error)
        setError("Failed to delete period. Please try again.")
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-1 md:col-span-2 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Welcome, {user?.email}</h2>
        <Button variant="outline" size="sm" onClick={signOut} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      {!isOnline && (
        <Alert variant="warning" className="col-span-1 md:col-span-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Your changes will be saved locally and synced when you're back online.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Work Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="date">Select Date</Label>
            <div className="mt-2">
              <Calendar mode="single" selected={date} onSelect={setDate} className="border rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="location" className="mt-1">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Brakel 18km">Brakel 18km</SelectItem>
                <SelectItem value="Gent 50km">Gent 50km</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAddEntry} className="w-full">
            {entries.some(
              (entry) => format(new Date(entry.date), "yyyy-MM-dd") === format(date || new Date(), "yyyy-MM-dd"),
            )
              ? "Update Entry"
              : "Add Entry"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Period Summary</span>
              {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-amber-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>Total Hours:</span>
              </div>
              <span className="font-bold text-xl">{totalHours.toFixed(2)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span>Total Kilometers:</span>
              </div>
              <span className="font-bold text-xl">{totalKilometers} km</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full flex items-center gap-2" onClick={handleResetTotals}>
              <RotateCcw className="h-4 w-4" />
              Reset Totals (For Invoice)
            </Button>
          </CardFooter>
        </Card>

        {previousPeriods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Previous Period Summaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {previousPeriods.map((period) => (
                  <AccordionItem key={period.id} value={period.id}>
                    <AccordionTrigger className="text-sm">
                      Period: {period.startDate} to {period.endDate}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 p-2 bg-muted/30 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Hours:</span>
                          <span className="font-medium">{period.totalHours.toFixed(2)}h</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Kilometers:</span>
                          <span className="font-medium">{period.totalKilometers} km</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Reset Date:</span>
                          <span className="font-medium">{period.resetDate}</span>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive/80 h-7 text-xs"
                            onClick={() => handleDeletePeriod(period.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground">No entries yet</p>
            ) : (
              entries
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((entry) => {
                  const isCurrentPeriod =
                    !lastResetTime || new Date(entry.addedAt).getTime() > new Date(lastResetTime).getTime()

                  return (
                    <Card key={entry.id} className={`p-4 ${!isCurrentPeriod ? "opacity-70" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{format(new Date(entry.date), "EEEE, MMMM d, yyyy")}</p>
                            {!isCurrentPeriod && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Previous period</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.startTime} - {entry.endTime} ({entry.hoursWorked}h)
                          </p>
                          <p className="text-sm text-muted-foreground">{entry.location}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
