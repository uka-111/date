export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availabilities: {
        Row: {
          couple_id: string
          date: string
          id: string
          note: string
          owner_id: string
          periods: string[]
          updated_at: string
        }
        Insert: {
          couple_id: string
          date: string
          id?: string
          note?: string
          owner_id: string
          periods: string[]
          updated_at?: string
        }
        Update: {
          couple_id?: string
          date?: string
          id?: string
          note?: string
          owner_id?: string
          periods?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_invites: {
        Row: {
          code_hash: string
          couple_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code_hash: string
          couple_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          couple_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_invites_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_members: {
        Row: {
          couple_id: string
          identity: Database["public"]["Enums"]["partner_identity"]
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          couple_id: string
          identity: Database["public"]["Enums"]["partner_identity"]
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          couple_id?: string
          identity?: Database["public"]["Enums"]["partner_identity"]
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_members_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couples_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          body: string
          couple_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          couple_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          couple_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_photos: {
        Row: {
          couple_id: string
          created_at: string
          date: string
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          date: string
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          date?: string
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_photos_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_events: {
        Row: {
          action: Database["public"]["Enums"]["invitation_action"]
          actor_id: string
          couple_id: string
          created_at: string
          id: string
          invitation_id: string
          note: string | null
          proposed_activities: string[] | null
          proposed_date: string | null
          proposed_periods: string[] | null
        }
        Insert: {
          action: Database["public"]["Enums"]["invitation_action"]
          actor_id: string
          couple_id: string
          created_at?: string
          id?: string
          invitation_id: string
          note?: string | null
          proposed_activities?: string[] | null
          proposed_date?: string | null
          proposed_periods?: string[] | null
        }
        Update: {
          action?: Database["public"]["Enums"]["invitation_action"]
          actor_id?: string
          couple_id?: string
          created_at?: string
          id?: string
          invitation_id?: string
          note?: string | null
          proposed_activities?: string[] | null
          proposed_date?: string | null
          proposed_periods?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          activities: string[]
          couple_id: string
          created_at: string
          date: string
          id: string
          note: string
          periods: string[]
          recipient_id: string
          sender_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          activities: string[]
          couple_id: string
          created_at?: string
          date: string
          id?: string
          note?: string
          periods: string[]
          recipient_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          activities?: string[]
          couple_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string
          periods?: string[]
          recipient_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          invitation_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          invitation_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          invitation_id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          calendar_scale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_scale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_scale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_pairing_invite: {
        Args: { p_identity: Database["public"]["Enums"]["partner_identity"] }
        Returns: {
          expires_at: string
          invite_code: string
        }[]
      }
      create_couple_with_invite: {
        Args: { p_identity: Database["public"]["Enums"]["partner_identity"] }
        Returns: {
          couple_id: string
          expires_at: string
          invite_code: string
        }[]
      }
      create_daily_photo: {
        Args: { p_date: string; p_mime_type: string; p_storage_path: string }
        Returns: {
          couple_id: string
          created_at: string
          date: string
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_photos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invitation: {
        Args: {
          p_activities: string[]
          p_date: string
          p_note: string
          p_periods: string[]
        }
        Returns: string
      }
      current_couple_id: { Args: never; Returns: string }
      delete_daily_note: { Args: { p_date: string }; Returns: undefined }
      delete_daily_photo: { Args: { p_photo_id: string }; Returns: string }
      is_couple_member: { Args: { p_couple_id: string }; Returns: boolean }
      leave_current_couple: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      redeem_pairing_invite: {
        Args: { p_invite_code: string }
        Returns: {
          couple_id: string
          identity: Database["public"]["Enums"]["partner_identity"]
        }[]
      }
      redeem_couple_invite: {
        Args: { p_invite_code: string }
        Returns: {
          couple_id: string
          identity: Database["public"]["Enums"]["partner_identity"]
        }[]
      }
      regenerate_couple_invite: {
        Args: never
        Returns: {
          expires_at: string
          invite_code: string
        }[]
      }
      respond_to_invitation: {
        Args: {
          p_action: string
          p_activities?: string[]
          p_date?: string
          p_invitation_id: string
          p_note?: string
          p_periods?: string[]
        }
        Returns: undefined
      }
      save_availability: {
        Args: { p_date: string; p_note: string; p_periods: string[] }
        Returns: {
          couple_id: string
          date: string
          id: string
          note: string
          owner_id: string
          periods: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "availabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_daily_note: {
        Args: { p_body: string; p_date: string; p_title: string }
        Returns: {
          body: string
          couple_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_user_preference: {
        Args: { p_calendar_scale: string }
        Returns: undefined
      }
      update_my_display_name: {
        Args: { p_display_name: string }
        Returns: string
      }
    }
    Enums: {
      invitation_action:
        | "created"
        | "confirmed"
        | "rejected"
        | "cancelled"
        | "adjustment_suggested"
        | "adjustment_accepted"
      invitation_status:
        | "pending"
        | "adjustment_pending"
        | "confirmed"
        | "rejected"
        | "cancelled"
      notification_kind:
        | "created"
        | "adjusted"
        | "confirmed"
        | "rejected"
        | "cancelled"
      partner_identity: "him" | "her"
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
      invitation_action: [
        "created",
        "confirmed",
        "rejected",
        "cancelled",
        "adjustment_suggested",
        "adjustment_accepted",
      ],
      invitation_status: [
        "pending",
        "adjustment_pending",
        "confirmed",
        "rejected",
        "cancelled",
      ],
      notification_kind: [
        "created",
        "adjusted",
        "confirmed",
        "rejected",
        "cancelled",
      ],
      partner_identity: ["him", "her"],
    },
  },
} as const

