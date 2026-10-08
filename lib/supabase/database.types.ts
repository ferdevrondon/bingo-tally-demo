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
          bank: string | null
          created_at: string
          created_by: string | null
          game_session_id: number | null
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
          bank?: string | null
          created_at?: string
          created_by?: string | null
          game_session_id?: number | null
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
          bank?: string | null
          created_at?: string
          created_by?: string | null
          game_session_id?: number | null
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
          balance: number
          checked_in: boolean
          created_at: string
          game_session_id: number
          house_id: number
          id: number
          opening_balance: number
          pending_carryover: boolean
          player_id: number
          removed_at: string | null
        }
        Insert: {
          balance?: number
          checked_in?: boolean
          created_at?: string
          game_session_id: number
          house_id: number
          id?: never
          opening_balance?: number
          pending_carryover?: boolean
          player_id: number
          removed_at?: string | null
        }
        Update: {
          balance?: number
          checked_in?: boolean
          created_at?: string
          game_session_id?: number
          house_id?: number
          id?: never
          opening_balance?: number
          pending_carryover?: boolean
          player_id?: number
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
          line_price: number
          margin_adjustment: number | null
          margin_gifts: number | null
          margin_unsold_losing: number | null
          margin_unsold_winning: number | null
          name: string
          prizes: number[]
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
          line_price: number
          margin_adjustment?: number | null
          margin_gifts?: number | null
          margin_unsold_losing?: number | null
          margin_unsold_winning?: number | null
          name: string
          prizes: number[]
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
          line_price?: number
          margin_adjustment?: number | null
          margin_gifts?: number | null
          margin_unsold_losing?: number | null
          margin_unsold_winning?: number | null
          name?: string
          prizes?: number[]
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
          logo_path: string | null
          name: string
          phone: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: never
          identifier: string
          logo_path?: string | null
          name: string
          phone?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: never
          identifier?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          timezone?: string
        }
        Relationships: []
      }
      player_accounts: {
        Row: {
          balance: number
          balance_note: string | null
          balance_status: string | null
          house_id: number
          player_id: number
          updated_at: string
        }
        Insert: {
          balance?: number
          balance_note?: string | null
          balance_status?: string | null
          house_id: number
          player_id: number
          updated_at?: string
        }
        Update: {
          balance?: number
          balance_note?: string | null
          balance_status?: string | null
          house_id?: number
          player_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_accounts_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          bank: string | null
          created_at: string
          email: string | null
          house_id: number
          id: number
          is_vip: boolean
          name: string
          payment_method: string | null
          nickname: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          bank?: string | null
          created_at?: string
          email?: string | null
          house_id: number
          id?: never
          is_vip?: boolean
          name: string
          payment_method?: string | null
          nickname?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          bank?: string | null
          created_at?: string
          email?: string | null
          house_id?: number
          id?: never
          is_vip?: boolean
          name?: string
          payment_method?: string | null
          nickname?: string | null
          phone?: string | null
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
          line_price: number
          name: string
          prizes: number[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          house_id: number
          id?: never
          line_price: number
          name: string
          prizes?: number[]
        }
        Update: {
          active?: boolean
          created_at?: string
          house_id?: number
          id?: never
          line_price?: number
          name?: string
          prizes?: number[]
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
      settlement_players: {
        Row: {
          closing_balance: number
          final_balance: number | null
          game_session_id: number
          house_id: number
          note: string | null
          paid: number
          player_id: number
          received: number
          resolution: string | null
          resolved_at: string | null
        }
        Insert: {
          closing_balance: number
          final_balance?: number | null
          game_session_id: number
          house_id: number
          note?: string | null
          paid?: number
          player_id: number
          received?: number
          resolution?: string | null
          resolved_at?: string | null
        }
        Update: {
          closing_balance?: number
          final_balance?: number | null
          game_session_id?: number
          house_id?: number
          note?: string | null
          paid?: number
          player_id?: number
          received?: number
          resolution?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_players_game_session_id_fkey"
            columns: ["game_session_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["game_session_id"]
          },
          {
            foreignKeyName: "settlement_players_player_id_house_id_fkey"
            columns: ["player_id", "house_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "house_id"]
          },
        ]
      }
      settlements: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          game_session_id: number
          house_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          game_session_id: number
          house_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          game_session_id?: number
          house_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_game_session_id_house_id_fkey"
            columns: ["game_session_id", "house_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
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
      add_session_player: {
        Args: {
          p_game_session_id: number
          p_player_id: number
          p_request_id: string
        }
        Returns: number
      }
      add_ticket: {
        Args: { p_game_session_id: number; p_request_id: string }
        Returns: number
      }
      admin_heartbeat: { Args: never; Returns: undefined }
      admin_session_status: { Args: never; Returns: string }
      award_prize: {
        Args: {
          p_number: number
          p_request_id: string
          p_round_id: number
          p_slot: number
        }
        Returns: undefined
      }
      claim_admin_session: { Args: never; Returns: undefined }
      close_round: {
        Args: {
          p_next_round_template_id: number
          p_request_id: string
          p_round_id: number
        }
        Returns: number
      }
      close_settlement: {
        Args: { p_game_session_id: number; p_request_id: string }
        Returns: undefined
      }
      discard_game_session: {
        Args: { p_game_session_id: number; p_request_id: string }
        Returns: undefined
      }
      edit_player_numbers: {
        Args: {
          p_changes: Json
          p_game_session_id: number
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      end_game_session: {
        Args: { p_game_session_id: number; p_request_id: string }
        Returns: undefined
      }
      reassign_number: {
        Args: {
          p_expected_owner_id: number
          p_new_owner_id: number
          p_number: number
          p_request_id: string
          p_ticket_id: number
        }
        Returns: undefined
      }
      record_account_payout: {
        Args: {
          p_amount: number
          p_bank?: string
          p_note: string
          p_payment_method: string
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      record_account_recharge: {
        Args: {
          p_amount: number
          p_bank?: string
          p_note: string
          p_payment_method: string
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      record_check_in: {
        Args: {
          p_game_session_id: number
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      record_purchase: {
        Args: {
          p_game_session_id: number
          p_number: number
          p_player_id: number
          p_request_id: string
        }
        Returns: number
      }
      record_recharge: {
        Args: {
          p_amount: number
          p_bank?: string
          p_game_session_id: number
          p_note: string
          p_payment_method: string
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      release_number: {
        Args: {
          p_number: number
          p_player_id: number
          p_request_id: string
          p_ticket_id: number
        }
        Returns: undefined
      }
      remove_player: {
        Args: {
          p_game_session_id: number
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      resolve_carryover: {
        Args: {
          p_game_session_id: number
          p_player_id: number
          p_release: Json
          p_request_id: string
        }
        Returns: undefined
      }
      set_balance_status: {
        Args: {
          p_note: string
          p_player_id: number
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      settlement_mark: {
        Args: {
          p_game_session_id: number
          p_note: string
          p_player_id: number
          p_request_id: string
          p_resolution: string
        }
        Returns: undefined
      }
      set_house_logo: {
        Args: { p_house_id: number; p_logo_path: string; p_request_id: string }
        Returns: undefined
      }
      settlement_payout: {
        Args: {
          p_amount: number
          p_bank?: string
          p_game_session_id: number
          p_note: string
          p_payment_method: string
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      settlement_receive: {
        Args: {
          p_amount: number
          p_bank?: string
          p_game_session_id: number
          p_note: string
          p_payment_method: string
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      start_game_session: {
        Args: { p_house_id: number; p_request_id: string }
        Returns: number
      }
      start_round: {
        Args: {
          p_game_session_id: number
          p_request_id: string
          p_round_template_id: number
        }
        Returns: number
      }
      toggle_gift: {
        Args: {
          p_number: number
          p_player_id: number
          p_request_id: string
          p_ticket_id: number
        }
        Returns: undefined
      }
      undo_check_in: {
        Args: {
          p_game_session_id: number
          p_player_id: number
          p_request_id: string
        }
        Returns: undefined
      }
      update_house: {
        Args: {
          p_house_id: number
          p_identifier: string
          p_name: string
          p_phone: string
          p_request_id: string
          p_timezone: string
        }
        Returns: undefined
      }
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
