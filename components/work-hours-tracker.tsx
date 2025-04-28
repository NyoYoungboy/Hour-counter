"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { AlertCircle, Clock, MapPin, RotateCcw, History } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type WorkEntry = {
  date: Date
  startTime: string
  endTime: string
  hoursWorked: number
  location: string
  kilometers: number
  addedAt: string // Timestamp when entry was added
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

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedEntries = localStorage.getItem("workEntries")
    if (savedEntries) {
      const parsedEntries = JSON.parse(savedEntries).map((entry: any) => ({
        ...entry,
        date: new Date(entry.date),
        // Ensure all entries have an addedAt timestamp
        addedAt: entry.addedAt || new Date().toISOString(),
      }))
      setEntries(parsedEntries)
    }

    const savedPeriods = localStorage.getItem("previousPeriods")
    if (savedPeriods) {
      setPreviousPeriods(JSON.parse(savedPeriods))
    }

    const savedLastResetTime = localStorage.getItem("lastReset")
    if (savedLastResetTime) {
      setLastResetTime(savedLastResetTime)
    }
  }, [])

  // Save entries to localStorage whenever they change
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem("workEntries", JSON.stringify(entries))
    }
  }, [entries])

  // Save previous periods to localStorage whenever they change
  useEffect(() => {
    if (previousPeriods.length > 0) {
      localStorage.setItem("previousPeriods", JSON.stringify(previousPeriods))
    }
  }, [previousPeriods])

  // Save lastResetTime to localStorage whenever it changes
  useEffect(() => {
    if (lastResetTime) {
      localStorage.setItem("lastReset", lastResetTime)
    }
  }, [lastResetTime])

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

  const handleAddEntry = () => {
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

    const newEntry: WorkEntry = {
      date: new Date(date),
      startTime,
      endTime,
      hoursWorked,
      location,
      kilometers,
      addedAt: now,
    }

    // Check if entry for this date already exists
    const existingEntryIndex = entries.findIndex(
      (entry) => format(entry.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"),
    )

    if (existingEntryIndex >= 0) {
      // Update existing entry but preserve its original addedAt timestamp
      const updatedEntries = [...entries]
      newEntry.addedAt = updatedEntries[existingEntryIndex].addedAt
      updatedEntries[existingEntryIndex] = newEntry
      setEntries(updatedEntries)
    } else {
      // Add new entry
      setEntries([...entries, newEntry])
    }

    setError("")
  }

  const handleResetTotals = () => {
    if (confirm("Are you sure you want to reset the totals? This will start a new calculation period.")) {
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
        endDate = format(sortedEntries[0].date, "MMMM d, yyyy")
      }

      // Find the first entry date in the current period
      let startDate = "No entries"
      if (currentPeriodEntries.length > 0) {
        // Sort entries by date
        const sortedEntries = [...currentPeriodEntries].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )
        startDate = format(sortedEntries[0].date, "MMMM d, yyyy")
      }

      // Save the current period summary before resetting
      const newPeriodSummary: PeriodSummary = {
        id: now.getTime().toString(),
        startDate,
        endDate,
        resetDate: format(now, "MMMM d, yyyy 'at' h:mm a"),
        totalHours,
        totalKilometers,
      }

      // Only add to previous periods if there are actual hours to report
      if (totalHours > 0) {
        setPreviousPeriods([newPeriodSummary, ...previousPeriods])
      }

      // Update the last reset time
      setLastResetTime(resetTime)
    }
  }

  const handleDeleteEntry = (index: number) => {
    const updatedEntries = [...entries]
    updatedEntries.splice(index, 1)
    setEntries(updatedEntries)
    localStorage.setItem("workEntries", JSON.stringify(updatedEntries))
  }

  const handleDeletePeriod = (id: string) => {
    if (confirm("Are you sure you want to delete this period summary?")) {
      const updatedPeriods = previousPeriods.filter((period) => period.id !== id)
      setPreviousPeriods(updatedPeriods)
      localStorage.setItem("previousPeriods", JSON.stringify(updatedPeriods))
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            {entries.some((entry) => format(entry.date, "yyyy-MM-dd") === format(date || new Date(), "yyyy-MM-dd"))
              ? "Update Entry"
              : "Add Entry"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Period Summary</CardTitle>
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
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((entry, index) => {
                  const isCurrentPeriod =
                    !lastResetTime || new Date(entry.addedAt).getTime() > new Date(lastResetTime).getTime()

                  return (
                    <Card key={index} className={`p-4 ${!isCurrentPeriod ? "opacity-70" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{format(entry.date, "EEEE, MMMM d, yyyy")}</p>
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
                          onClick={() => handleDeleteEntry(index)}
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
