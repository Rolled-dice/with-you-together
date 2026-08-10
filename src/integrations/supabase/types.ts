export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_events: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          environment: string
          event_type: string
          id: string
          metadata: Json | null
          new_tier: string | null
          previous_price_id: string | null
          previous_tier: string | null
          price_id: string | null
          status: string | null
          stripe_event_id: string | null
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_tier?: string | null
          previous_price_id?: string | null
          previous_tier?: string | null
          price_id?: string | null
          status?: string | null
          stripe_event_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_tier?: string | null
          previous_price_id?: string | null
          previous_tier?: string | null
          price_id?: string | null
          status?: string | null
          stripe_event_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      companion_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dose_logs: {
        Row: {
          created_at: string
          for_user_id: string
          id: string
          logged_at: string | null
          logged_by: string | null
          medication_id: string
          note: string | null
          schedule_id: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          created_at?: string
          for_user_id: string
          id?: string
          logged_at?: string | null
          logged_by?: string | null
          medication_id: string
          note?: string | null
          schedule_id?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          created_at?: string
          for_user_id?: string
          id?: string
          logged_at?: string | null
          logged_by?: string | null
          medication_id?: string
          note?: string | null
          schedule_id?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["family_role"]
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_session_allocations: {
        Row: {
          allocated: number
          created_at: string
          family_id: string
          id: string
          member_user_id: string
          period_start: string
          updated_at: string
          used: number
        }
        Insert: {
          allocated?: number
          created_at?: string
          family_id: string
          id?: string
          member_user_id: string
          period_start: string
          updated_at?: string
          used?: number
        }
        Update: {
          allocated?: number
          created_at?: string
          family_id?: string
          id?: string
          member_user_id?: string
          period_start?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_session_allocations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_session_pool: {
        Row: {
          created_at: string
          family_id: string
          period_start: string
          reschedules_total: number
          reschedules_used: number
          total_sessions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          period_start: string
          reschedules_total?: number
          reschedules_used?: number
          total_sessions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          period_start?: string
          reschedules_total?: number
          reschedules_used?: number
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_session_pool_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          email: string | null
          id: string
          message: string
          page: string | null
          priority: Database["public"]["Enums"]["feedback_priority"]
          status: string
          subject: string | null
          triage_status: Database["public"]["Enums"]["feedback_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          email?: string | null
          id?: string
          message: string
          page?: string | null
          priority?: Database["public"]["Enums"]["feedback_priority"]
          status?: string
          subject?: string | null
          triage_status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          page?: string | null
          priority?: Database["public"]["Enums"]["feedback_priority"]
          status?: string
          subject?: string | null
          triage_status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          id: string
          mood: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          mood?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mood?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listener_bookings: {
        Row: {
          call_ended_at: string | null
          call_started_at: string | null
          created_at: string
          duration_minutes: number
          feedback_at: string | null
          feedback_note: string | null
          follow_up_wanted: boolean
          id: string
          listener_id: string
          note: string
          rating: number | null
          ready_listener: boolean
          ready_user: boolean
          recording_consent_listener: boolean
          recording_consent_user: boolean
          requested_at: string
          room_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_ended_at?: string | null
          call_started_at?: string | null
          created_at?: string
          duration_minutes?: number
          feedback_at?: string | null
          feedback_note?: string | null
          follow_up_wanted?: boolean
          id?: string
          listener_id: string
          note?: string
          rating?: number | null
          ready_listener?: boolean
          ready_user?: boolean
          recording_consent_listener?: boolean
          recording_consent_user?: boolean
          requested_at: string
          room_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_ended_at?: string | null
          call_started_at?: string | null
          created_at?: string
          duration_minutes?: number
          feedback_at?: string | null
          feedback_note?: string | null
          follow_up_wanted?: boolean
          id?: string
          listener_id?: string
          note?: string
          rating?: number | null
          ready_listener?: boolean
          ready_user?: boolean
          recording_consent_listener?: boolean
          recording_consent_user?: boolean
          requested_at?: string
          room_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listener_bookings_listener_id_fkey"
            columns: ["listener_id"]
            isOneToOne: false
            referencedRelation: "listeners"
            referencedColumns: ["id"]
          },
        ]
      }
      listeners: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          focus_areas: string[]
          headline: string
          hourly_rate_cents: number
          id: string
          is_active: boolean
          name: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          focus_areas?: string[]
          headline: string
          hourly_rate_cents?: number
          id?: string
          is_active?: boolean
          name: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          focus_areas?: string[]
          headline?: string
          hourly_rate_cents?: number
          id?: string
          is_active?: boolean
          name?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medication_schedules: {
        Row: {
          created_at: string
          days_of_week: number[]
          id: string
          medication_id: string
          time_of_day: string
          with_food: boolean
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          id?: string
          medication_id: string
          time_of_day: string
          with_food?: boolean
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          id?: string
          medication_id?: string
          time_of_day?: string
          with_food?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          added_by: string
          created_at: string
          dosage: string | null
          end_date: string | null
          for_user_id: string
          form: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          notes: string | null
          parsed_data: Json | null
          prescribed_by: string | null
          prescription_image_path: string | null
          refill_date: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          added_by: string
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          for_user_id: string
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          parsed_data?: Json | null
          prescribed_by?: string | null
          prescription_image_path?: string | null
          refill_date?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          added_by?: string
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          for_user_id?: string
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          parsed_data?: Json | null
          prescribed_by?: string | null
          prescription_image_path?: string | null
          refill_date?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          care_intent: string | null
          care_since: string
          care_status: string
          care_tier: string
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          phone_country: string | null
          phone_verified: boolean
          preferred_currency: string | null
          preferred_language: string
          pronouns: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          care_intent?: string | null
          care_since?: string
          care_status?: string
          care_tier?: string
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          phone_country?: string | null
          phone_verified?: boolean
          preferred_currency?: string | null
          preferred_language?: string
          pronouns?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          care_intent?: string | null
          care_since?: string
          care_status?: string
          care_tier?: string
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          phone_country?: string | null
          phone_verified?: boolean
          preferred_currency?: string | null
          preferred_language?: string
          pronouns?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string
          for_user_id: string
          id: string
          recurrence: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at: string
          for_user_id: string
          id?: string
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string
          for_user_id?: string
          id?: string
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          environment: string
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          received_at: string
          stripe_customer_id: string | null
          stripe_event_id: string
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          environment: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          stripe_customer_id?: string | null
          stripe_event_id: string
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          environment?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_stats: { Args: never; Returns: Json }
      get_user_family_id: { Args: { _uid: string }; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_family_admin: {
        Args: { _family: string; _uid: string }
        Returns: boolean
      }
      is_family_adult_of: { Args: { _for_user: string }; Returns: boolean }
      same_family_as: { Args: { _for_user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      family_role: "owner" | "adult" | "teen"
      feedback_category:
        | "feature_request"
        | "bug_report"
        | "product_feedback"
        | "ai_feedback"
        | "listener_feedback"
        | "support"
      feedback_priority: "low" | "normal" | "high" | "urgent"
      feedback_status: "new" | "in_review" | "planned" | "resolved" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      family_role: ["owner", "adult", "teen"],
      feedback_category: [
        "feature_request",
        "bug_report",
        "product_feedback",
        "ai_feedback",
        "listener_feedback",
        "support",
      ],
      feedback_priority: ["low", "normal", "high", "urgent"],
      feedback_status: ["new", "in_review", "planned", "resolved", "archived"],
    },
  },
} as const
