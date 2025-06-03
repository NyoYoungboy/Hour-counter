"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { supabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("login")
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking")
  const router = useRouter()

  // Check Supabase connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log("Checking Supabase connection...")
        console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log("Supabase Key exists:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

        // Test the connection
        const { data, error } = await supabaseClient.auth.getSession()

        if (error) {
          console.error("Connection test error:", error)
          setConnectionStatus("error")
          setError(`Connection error: ${error.message}`)
        } else {
          console.log("Supabase connection successful")
          setConnectionStatus("connected")
        }
      } catch (error) {
        console.error("Failed to connect to Supabase:", error)
        setConnectionStatus("error")
        setError("Failed to connect to authentication service. Please check your configuration.")
      }
    }

    checkConnection()
  }, [])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    // Form validation
    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (connectionStatus !== "connected") {
      setError("Cannot connect to authentication service. Please try again later.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("Attempting to sign up with email:", email)

      const { data, error: signUpError } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log("Sign up response:", { data: !!data, error: signUpError })

      if (signUpError) {
        console.error("Sign up error:", signUpError)
        setError(signUpError.message)
      } else if (data?.user) {
        setError("Check your email for the confirmation link.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } catch (error) {
      console.error("Unexpected sign up error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    // Form validation
    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    if (connectionStatus !== "connected") {
      setError("Cannot connect to authentication service. Please try again later.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("Attempting to sign in with email:", email)

      const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      console.log("Sign in response:", { data: !!data, error: signInError })

      if (signInError) {
        console.error("Sign in error:", signInError)
        setError(signInError.message || "Invalid login credentials")
      } else if (data?.user) {
        console.log("Sign in successful, redirecting...")
        router.push("/")
        router.refresh()
      } else {
        setError("Something went wrong. Please try again.")
      }
    } catch (error) {
      console.error("Unexpected sign in error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (connectionStatus === "checking") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Connecting to authentication service...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Work Hours Tracker</CardTitle>
        <CardDescription>Sign in to track your work hours and travel distances</CardDescription>
        {connectionStatus === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connection to authentication service failed. Please check your configuration.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" disabled={connectionStatus !== "connected"}>
              Login
            </TabsTrigger>
            <TabsTrigger value="register" disabled={connectionStatus !== "connected"}>
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={connectionStatus !== "connected"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={connectionStatus !== "connected"}
                />
              </div>
              {error && (
                <Alert variant={error.includes("Check your email") ? "default" : "destructive"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || connectionStatus !== "connected"}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleSignUp} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={connectionStatus !== "connected"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={connectionStatus !== "connected"}
                />
                <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
              </div>
              {error && (
                <Alert variant={error.includes("Check your email") ? "default" : "destructive"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || connectionStatus !== "connected"}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {activeTab === "login" ? "Don't have an account? " : "Already have an account? "}
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => setActiveTab(activeTab === "login" ? "register" : "login")}
            disabled={connectionStatus !== "connected"}
          >
            {activeTab === "login" ? "Register" : "Login"}
          </Button>
        </p>
      </CardFooter>
    </Card>
  )
}
