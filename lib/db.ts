import { openDB, type DBSchema } from "idb"

interface WorkTrackerDB extends DBSchema {
  entries: {
    key: string
    value: WorkEntry
    indexes: { "by-date": Date }
  }
  periods: {
    key: string
    value: PeriodSummary
  }
  sync: {
    key: string
    value: {
      action: "add" | "update" | "delete"
      data: any
      timestamp: number
    }
  }
  settings: {
    key: string
    value: any
  }
}

export interface WorkEntry {
  id?: string
  date: Date
  startTime: string
  endTime: string
  hoursWorked: number
  location: string
  kilometers: number
  addedAt: string
}

export interface PeriodSummary {
  id: string
  startDate: string
  endDate: string
  resetDate: string
  totalHours: number
  totalKilometers: number
}

// Initialize the database
export const initDB = async () => {
  return openDB<WorkTrackerDB>("work-tracker-db", 1, {
    upgrade(db) {
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains("entries")) {
        const entriesStore = db.createObjectStore("entries", { keyPath: "id" })
        entriesStore.createIndex("by-date", "date")
      }

      if (!db.objectStoreNames.contains("periods")) {
        db.createObjectStore("periods", { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains("sync")) {
        db.createObjectStore("sync", { keyPath: "id", autoIncrement: true })
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" })
      }
    },
  })
}

// Save last reset time
export const saveLastResetTime = async (timestamp: string) => {
  const db = await initDB()
  await db.put("settings", { id: "lastReset", value: timestamp })
}

// Get last reset time
export const getLastResetTime = async (): Promise<string | null> => {
  try {
    const db = await initDB()
    const result = await db.get("settings", "lastReset")
    return result ? result.value : null
  } catch (error) {
    console.error("Error getting last reset time:", error)
    return null
  }
}

// Save an entry
export const saveEntry = async (entry: WorkEntry): Promise<WorkEntry> => {
  const db = await initDB()

  // Generate ID if it doesn't exist
  if (!entry.id) {
    entry.id = Date.now().toString()
  }

  await db.put("entries", entry)

  // Add to sync queue if online
  if (navigator.onLine) {
    await db.add("sync", {
      action: entry.id ? "update" : "add",
      data: entry,
      timestamp: Date.now(),
    })

    // Try to sync immediately
    syncData()
  }

  return entry
}

// Get all entries
export const getAllEntries = async (): Promise<WorkEntry[]> => {
  const db = await initDB()
  return db.getAll("entries")
}

// Delete an entry
export const deleteEntry = async (id: string): Promise<void> => {
  const db = await initDB()
  await db.delete("entries", id)

  // Add to sync queue if online
  if (navigator.onLine) {
    await db.add("sync", {
      action: "delete",
      data: { id },
      timestamp: Date.now(),
    })

    // Try to sync immediately
    syncData()
  }
}

// Save a period summary
export const savePeriodSummary = async (period: PeriodSummary): Promise<void> => {
  const db = await initDB()
  await db.put("periods", period)
}

// Get all period summaries
export const getAllPeriodSummaries = async (): Promise<PeriodSummary[]> => {
  const db = await initDB()
  return db.getAll("periods")
}

// Delete a period summary
export const deletePeriodSummary = async (id: string): Promise<void> => {
  const db = await initDB()
  await db.delete("periods", id)
}

// Sync data with server when online
export const syncData = async (): Promise<void> => {
  // Only proceed if online
  if (!navigator.onLine) return

  try {
    const db = await initDB()
    const syncItems = await db.getAll("sync")

    if (syncItems.length === 0) return

    // In a real app, you would send these to your server
    console.log("Syncing data with server:", syncItems)

    // For this demo, we'll just clear the sync queue
    // In a real app, you would only clear after successful server sync
    const tx = db.transaction("sync", "readwrite")
    await Promise.all(syncItems.map((item) => tx.store.delete(item.id)))
    await tx.done

    console.log("Sync completed successfully")
  } catch (error) {
    console.error("Error syncing data:", error)
  }
}

// Register event listeners for online/offline status
export const registerNetworkListeners = () => {
  window.addEventListener("online", () => {
    console.log("App is online. Syncing data...")
    syncData()
  })

  window.addEventListener("offline", () => {
    console.log("App is offline. Changes will be synced when online.")
  })
}
