export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      work_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          start_time: string
          end_time: string
          hours_worked: number
          location: string
          kilometers: number
          added_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          start_time: string
          end_time: string
          hours_worked: number
          location: string
          kilometers: number
          added_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: string
          end_time?: string
          hours_worked?: number
          location?: string
          kilometers?: number
          added_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      period_summaries: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          reset_date: string
          total_hours: number
          total_kilometers: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_date: string
          end_date: string
          reset_date: string
          total_hours: number
          total_kilometers: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          end_date?: string
          reset_date?: string
          total_hours?: number
          total_kilometers?: number
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          last_reset_time: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          last_reset_time?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          last_reset_time?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
