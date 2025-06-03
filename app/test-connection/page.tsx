"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestConnection() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState<string | null>(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Try to get the Supabase URL from the environment
        setSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "Not available")

        // Test the connection by getting the session
        const { data, error } = await supabase().auth.getSession()

        if (error) {
          throw error
        }

        setStatus("success")
      } catch (error) {
        console.error("Connection test error:", error)
        setStatus("error")
        setErrorMessage(error instanceof Error ? error.message : String(error))
      }
    }

    testConnection()
  }, [])

  return (
    <div className="container mx-auto p-4 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Connection Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">Status:</p>
              <p
                className={
                  status === "loading" ? "text-blue-500" : status === "success" ? "text-green-500" : "text-red-500"
                }
              >
                {status === "loading"
                  ? "Testing connection..."
                  : status === "success"
                    ? "Connection successful"
                    : "Connection failed"}
              </p>
            </div>

            {errorMessage && (
              <div>
                <p className="font-semibold">Error:</p>
                <p className="text-red-500">{errorMessage}</p>
              </div>
            )}

            <div>
              <p className="font-semibold">Supabase URL:</p>
              <p>{supabaseUrl}</p>
            </div>

            <div>
              <p className="font-semibold">Environment:</p>
              <p>{process.env.NODE_ENV}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
