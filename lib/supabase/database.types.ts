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
      activity_log: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          game_session_id: number
          house_id: number
          id: number
          note: string | null
          number: number | null
          payment_method: string | null
          player_id: number | null
          request_id: string
          round_id: number | null
          ticket_id: number | null
          type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          game_session_id: number
          house_id: number
          id?: never
          note?: string | null
          number?: number | null
          payment_method?: string | null
          player_id?: number | null
          request_id: string
          round_id?: number | null
          ticket_id?: number | null
          type: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          game_session_id?: number
          house_id?: number
          id?: never
          note?: string | null
          number?: number | null
          payment_method?: string | null
          player_id?: number | null
          request_id?: string
          round_id?: number | null
          ticket_id?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "activity_log_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "activity_log_round_id_house_id_fkey"
            columns: ["round_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_session_rounds"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_house_id_fkey"
            columns: ["ticket_id", "house_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      admin_auth_sessions: {
        Row: {
          claimed_at: string
          last_seen_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          last_seen_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          last_seen_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_session_players: {
        Row: {
          checked_in: boolean
          created_at: string
          game_session_id: number
          house_id: number
          id: number
          negative_balance: number
          pending_carryover: boolean
          player_id: number
          positive_balance: number
          removed_at: string | null
        }
        Insert: {
          checked_in?: boolean
          created_at?: string
          game_session_id: number
          house_id: number
          id?: never
          negative_balance?: number
          pending_carryover?: boolean
          player_id: number
          positive_balance?: number
          removed_at?: string | null
        }
        Update: {
          checked_in?: boolean
          created_at?: string
          game_session_id?: number
          house_id?: number
          id?: never
          negative_balance?: number
          pending_carryover?: boolean
          player_id?: number
          positive_balance?: number
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_session_players_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "game_session_players_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      game_session_rounds: {
        Row: {
          closed_at: string | null
          game_session_id: number
          house_id: number
          id: number
          kind: string
          line_price: number
          margin_adjustment: number | null
          name: string
          round_template_id: number | null
          seq: number
          started_at: string
          status: string
          winning_numbers: number[]
        }
        Insert: {
          closed_at?: string | null
          game_session_id: number
          house_id: number
          id?: never
          kind: string
          line_price: number
          margin_adjustment?: number | null
          name: string
          round_template_id?: number | null
          seq: number
          started_at?: string
          status?: string
          winning_numbers?: number[]
        }
        Update: {
          closed_at?: string | null
          game_session_id?: number
          house_id?: number
          id?: never
          kind?: string
          line_price?: number
          margin_adjustment?: number | null
          name?: string
          round_template_id?: number | null
          seq?: number
          started_at?: string
          status?: string
          winning_numbers?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "game_session_rounds_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "game_session_rounds_round_template_id_fkey"
            columns: ["round_template_id"]
            isOneToOne: false
            referencedRelation: "round_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          house_balance: number
          house_id: number
          id: number
          number: number
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          house_balance?: number
          house_id: number
          id?: never
          number: number
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          house_balance?: number
          house_id?: number
          id?: never
          number?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_members: {
        Row: {
          created_at: string
          house_id: number
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          house_id: number
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          house_id?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_members_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          created_at: string
          id: number
          identifier: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: never
          identifier: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: never
          identifier?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          active: boolean
          created_at: string
          house_id: number
          id: number
          is_vip: boolean
          name: string
          payment_method: string | null
          username: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          house_id: number
          id?: never
          is_vip?: boolean
          name: string
          payment_method?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          house_id?: number
          id?: never
          is_vip?: boolean
          name?: string
          payment_method?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      round_templates: {
        Row: {
          active: boolean
          created_at: string
          house_id: number
          id: number
          kind: string
          line_price: number
          name: string
          prizes: number[]
          winner_count: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          house_id: number
          id?: never
          kind: string
          line_price: number
          name: string
          prizes?: number[]
          winner_count: number
        }
        Update: {
          active?: boolean
          created_at?: string
          house_id?: number
          id?: never
          kind?: string
          line_price?: number
          name?: string
          prizes?: number[]
          winner_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_templates_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      round_winners: {
        Row: {
          created_at: string
          game_session_id: number
          house_id: number
          id: number
          number: number
          player_id: number
          prize: number
          round_id: number
          slot: number
          ticket_id: number
        }
        Insert: {
          created_at?: string
          game_session_id: number
          house_id: number
          id?: never
          number: number
          player_id: number
          prize: number
          round_id: number
          slot: number
          ticket_id: number
        }
        Update: {
          created_at?: string
          game_session_id?: number
          house_id?: number
          id?: never
          number?: number
          player_id?: number
          prize?: number
          round_id?: number
          slot?: number
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_winners_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "round_winners_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "round_winners_round_id_house_id_fkey"
            columns: ["round_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_session_rounds"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "round_winners_ticket_id_house_id_fkey"
            columns: ["ticket_id", "house_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      ticket_numbers: {
        Row: {
          game_session_id: number
          house_id: number
          is_gift: boolean
          number: number
          player_id: number | null
          ticket_id: number
        }
        Insert: {
          game_session_id: number
          house_id: number
          is_gift?: boolean
          number: number
          player_id?: number | null
          ticket_id: number
        }
        Update: {
          game_session_id?: number
          house_id?: number
          is_gift?: boolean
          number?: number
          player_id?: number | null
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_numbers_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "ticket_numbers_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "ticket_numbers_ticket_id_house_id_fkey"
            columns: ["ticket_id", "house_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          game_session_id: number
          house_id: number
          id: number
          index: number
        }
        Insert: {
          created_at?: string
          game_session_id: number
          house_id: number
          id?: never
          index: number
        }
        Update: {
          created_at?: string
          game_session_id?: number
          house_id?: number
          id?: never
          index?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_heartbeat: { Args: never; Returns: undefined }
      admin_session_status: { Args: never; Returns: string }
      claim_admin_session: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
