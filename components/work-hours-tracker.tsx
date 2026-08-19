"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertCircle, Clock, Download, FileText, History, MapPin } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

type WorkEntry = {
  id: string
  date: string
  startTime: string
  endTime: string
  hoursWorked: number
  location: string
  kilometers: number
  addedAt: string
  invoiceId?: string | null
}

type InvoiceSnapshot = {
  id: string
  monthKey: string
  createdAt: string
  totalHours: number
  totalKilometers: number
  entries: WorkEntry[]
  legacy?: boolean
  legacyStartDate?: string
  legacyEndDate?: string
}

type LegacyPeriod = {
  id: string
  startDate: string
  endDate: string
  resetDate: string
  totalHours: number
  totalKilometers: number
}

const ENTRY_KEY = "workEntries"
const INVOICE_KEY = "invoiceSnapshots"
const LEGACY_PERIOD_KEY = "previousPeriods"

function monthKeyFromDate(value: string | Date) {
  return format(new Date(value), "yyyy-MM")
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  return format(new Date(year, month - 1, 1), "MMMM yyyy")
}

function normalizeEntry(raw: any): WorkEntry {
  const date = raw.date ? new Date(raw.date) : new Date()
  return {
    id: raw.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: date.toISOString(),
    startTime: raw.startTime || "09:00",
    endTime: raw.endTime || "17:00",
    hoursWorked: Number(raw.hoursWorked || 0),
    location: raw.location || "Brakel 18km",
    kilometers: Number(raw.kilometers || 0),
    addedAt: raw.addedAt || new Date().toISOString(),
    invoiceId: raw.invoiceId || null,
  }
}

export function WorkHoursTracker() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [location, setLocation] = useState("Brakel 18km")
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [invoices, setInvoices] = useState<InvoiceSnapshot[]>([])
  const [error, setError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const { toast } = useToast()

  const selectedMonth = monthKeyFromDate(date || new Date())

  useEffect(() => {
    const savedEntries = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]").map(normalizeEntry)
    setEntries(savedEntries)

    const savedInvoices = JSON.parse(localStorage.getItem(INVOICE_KEY) || "[]") as InvoiceSnapshot[]

    // Preserve older "reset period" summaries from the previous version instead of deleting history.
    const legacyPeriods = JSON.parse(localStorage.getItem(LEGACY_PERIOD_KEY) || "[]") as LegacyPeriod[]
    const migratedLegacy: InvoiceSnapshot[] = legacyPeriods
      .filter((p) => !savedInvoices.some((i) => i.id === `legacy-${p.id}`))
      .map((p) => ({
        id: `legacy-${p.id}`,
        monthKey: "legacy",
        createdAt: p.resetDate,
        totalHours: Number(p.totalHours || 0),
        totalKilometers: Number(p.totalKilometers || 0),
        entries: [],
        legacy: true,
        legacyStartDate: p.startDate,
        legacyEndDate: p.endDate,
      }))

    setInvoices([...savedInvoices, ...migratedLegacy])
    setLoaded(true)

    const installHandler = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setIsInstallable(true)
    }
    window.addEventListener("beforeinstallprompt", installHandler)
    return () => window.removeEventListener("beforeinstallprompt", installHandler)
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(ENTRY_KEY, JSON.stringify(entries))
  }, [entries, loaded])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(INVOICE_KEY, JSON.stringify(invoices))
  }, [invoices, loaded])

  const monthEntries = useMemo(
    () => entries.filter((entry) => monthKeyFromDate(entry.date) === selectedMonth),
    [entries, selectedMonth],
  )

  const uninvoicedMonthEntries = monthEntries.filter((entry) => !entry.invoiceId)
  const monthHours = monthEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0)
  const monthKm = monthEntries.reduce((sum, entry) => sum + entry.kilometers, 0)
  const uninvoicedHours = uninvoicedMonthEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0)
  const uninvoicedKm = uninvoicedMonthEntries.reduce((sum, entry) => sum + entry.kilometers, 0)

  function calculateHours(start: string, end: string) {
    const [startHour, startMinute] = start.split(":").map(Number)
    const [endHour, endMinute] = end.split(":").map(Number)
    const startMinutes = startHour * 60 + startMinute
    let endMinutes = endHour * 60 + endMinute
    if (endMinutes < startMinutes) endMinutes += 24 * 60
    return Number(((endMinutes - startMinutes) / 60).toFixed(2))
  }

  function getKilometers(loc: string) {
    return loc.includes("Brakel") ? 18 : 50
  }

  function handleAddEntry() {
    if (!date) return setError("Please select a date")

    const hoursWorked = calculateHours(startTime, endTime)
    if (hoursWorked <= 0) return setError("End time must be after start time")

    const dayKey = format(date, "yyyy-MM-dd")
    const existingIndex = entries.findIndex((entry) => format(new Date(entry.date), "yyyy-MM-dd") === dayKey)

    if (existingIndex >= 0 && entries[existingIndex].invoiceId) {
      setError("This shift is already part of a saved invoice and is locked. Add a separate correction shift instead.")
      return
    }

    const kilometers = getKilometers(location)
    const now = new Date().toISOString()

    if (existingIndex >= 0) {
      const updated = [...entries]
      updated[existingIndex] = {
        ...updated[existingIndex],
        date: date.toISOString(),
        startTime,
        endTime,
        hoursWorked,
        location,
        kilometers,
      }
      setEntries(updated)
      toast({ title: "Shift updated", description: format(date, "EEEE, MMMM d, yyyy") })
    } else {
      setEntries((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          date: date.toISOString(),
          startTime,
          endTime,
          hoursWorked,
          location,
          kilometers,
          addedAt: now,
          invoiceId: null,
        },
      ])
      toast({ title: "Shift saved", description: format(date, "EEEE, MMMM d, yyyy") })
    }
    setError("")
  }

  function handleDeleteEntry(entry: WorkEntry) {
    if (entry.invoiceId) {
      toast({
        title: "Shift is locked",
        description: "This shift belongs to a saved invoice and cannot be deleted.",
        variant: "destructive",
      })
      return
    }
    if (!confirm("Delete this shift?")) return
    setEntries((current) => current.filter((item) => item.id !== entry.id))
  }

  function createInvoice() {
    if (uninvoicedMonthEntries.length === 0) {
      toast({ title: "Nothing to invoice", description: `No uninvoiced shifts in ${monthLabel(selectedMonth)}.` })
      return
    }

    if (!confirm(`Save an invoice snapshot for ${monthLabel(selectedMonth)} with ${uninvoicedMonthEntries.length} shift(s)?`)) {
      return
    }

    const invoiceId = `invoice-${selectedMonth}-${Date.now()}`
    const snapshotEntries = uninvoicedMonthEntries.map((entry) => ({ ...entry, invoiceId }))
    const invoice: InvoiceSnapshot = {
      id: invoiceId,
      monthKey: selectedMonth,
      createdAt: new Date().toISOString(),
      totalHours: uninvoicedHours,
      totalKilometers: uninvoicedKm,
      entries: snapshotEntries,
    }

    setInvoices((current) => [invoice, ...current])
    setEntries((current) =>
      current.map((entry) => (snapshotEntries.some((snap) => snap.id === entry.id) ? { ...entry, invoiceId } : entry)),
    )

    toast({
      title: "Invoice snapshot saved",
      description: `${uninvoicedHours.toFixed(2)}h · ${uninvoicedKm} km · ${snapshotEntries.length} shifts locked`,
    })
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  const selectedEntry = date
    ? entries.find((entry) => format(new Date(entry.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd"))
    : undefined

  useEffect(() => {
    if (!selectedEntry) return
    setStartTime(selectedEntry.startTime)
    setEndTime(selectedEntry.endTime)
    setLocation(selectedEntry.location)
  }, [selectedEntry?.id])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {isInstallable && (
        <Alert className="col-span-1 md:col-span-2">
          <Download className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Install this app on your device for quicker access.</span>
            <Button size="sm" onClick={handleInstallClick}>Install</Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add or update a shift</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select date</Label>
            <div className="mt-2">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start time</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="endTime">End time</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Brakel 18km">Brakel 18km</SelectItem>
                <SelectItem value="Gent 50km">Gent 50km</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedEntry?.invoiceId && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>This day is already included in a saved invoice and is locked.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAddEntry} className="w-full" disabled={Boolean(selectedEntry?.invoiceId)}>
            {selectedEntry ? "Update shift" : "Save shift"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><span>Total hours</span></div>
              <span className="text-xl font-bold">{monthHours.toFixed(2)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-muted-foreground" /><span>Total kilometers</span></div>
              <span className="text-xl font-bold">{monthKm} km</span>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Uninvoiced shifts</span><strong>{uninvoicedMonthEntries.length}</strong></div>
              <div className="mt-1 flex justify-between"><span>Ready to invoice</span><strong>{uninvoicedHours.toFixed(2)}h · {uninvoicedKm} km</strong></div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={createInvoice} disabled={uninvoicedMonthEntries.length === 0}>
              <FileText className="mr-2 h-4 w-4" />
              Save invoice snapshot
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader><CardTitle>Shifts in {monthLabel(selectedMonth)}</CardTitle></CardHeader>
          <CardContent className="max-h-[420px] space-y-3 overflow-y-auto">
            {monthEntries.length === 0 ? (
              <p className="text-center text-muted-foreground">No shifts for this month.</p>
            ) : (
              [...monthEntries]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{format(new Date(entry.date), "EEEE, MMMM d, yyyy")}</p>
                          {entry.invoiceId && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Invoiced</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.startTime} - {entry.endTime} · {entry.hoursWorked.toFixed(2)}h</p>
                        <p className="text-sm text-muted-foreground">{entry.location} · {entry.kilometers} km</p>
                      </div>
                      <Button variant="ghost" size="sm" disabled={Boolean(entry.invoiceId)} onClick={() => handleDeleteEntry(entry)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Invoice history</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved invoices yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {invoices.map((invoice) => (
                <AccordionItem key={invoice.id} value={invoice.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 pr-3 text-left">
                      <span className="font-semibold">
                        {invoice.legacy ? `${invoice.legacyStartDate} to ${invoice.legacyEndDate}` : monthLabel(invoice.monthKey)}
                      </span>
                      <span className="text-sm text-muted-foreground">{invoice.totalHours.toFixed(2)}h · {invoice.totalKilometers} km</span>
                      <span className="ml-auto text-xs text-muted-foreground">{invoice.entries.length ? `${invoice.entries.length} shifts` : "legacy summary"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 rounded-md bg-muted/30 p-3">
                      {invoice.legacy ? (
                        <p className="text-sm text-muted-foreground">
                          This summary came from the old version of the app. The old version did not save the individual shifts inside the invoice itself, so only the totals can be preserved here.
                        </p>
                      ) : (
                        invoice.entries
                          .slice()
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((entry) => (
                            <div key={entry.id} className="grid grid-cols-1 gap-1 rounded-md border bg-background p-3 text-sm sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                              <strong>{format(new Date(entry.date), "EEE, MMM d, yyyy")}</strong>
                              <span>{entry.startTime} - {entry.endTime}</span>
                              <span>{entry.hoursWorked.toFixed(2)}h</span>
                              <span>{entry.kilometers} km · {entry.location.replace(/\s\d+km$/, "")}</span>
                            </div>
                          ))
                      )}
                      <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                        <span>Saved {invoice.legacy ? invoice.createdAt : format(new Date(invoice.createdAt), "PPP p")}</span>
                        <strong>{invoice.totalHours.toFixed(2)}h · {invoice.totalKilometers} km</strong>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
