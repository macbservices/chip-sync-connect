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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chip_activations: {
        Row: {
          activation_count: number
          chip_id: string
          id: string
          is_exhausted: boolean
          max_activations: number
          service_type: string
          updated_at: string
        }
        Insert: {
          activation_count?: number
          chip_id: string
          id?: string
          is_exhausted?: boolean
          max_activations?: number
          service_type: string
          updated_at?: string
        }
        Update: {
          activation_count?: number
          chip_id?: string
          id?: string
          is_exhausted?: boolean
          max_activations?: number
          service_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_activations_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      chips: {
        Row: {
          created_at: string
          detected_at: string
          iccid: string | null
          id: string
          modem_id: string
          operator: string | null
          phone_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          iccid?: string | null
          id?: string
          modem_id: string
          operator?: string | null
          phone_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          iccid?: string | null
          id?: string
          modem_id?: string
          operator?: string | null
          phone_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chips_modem_id_fkey"
            columns: ["modem_id"]
            isOneToOne: false
            referencedRelation: "modems"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          api_key: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      modems: {
        Row: {
          created_at: string
          id: string
          imei: string | null
          last_seen_at: string | null
          location_id: string
          operator: string | null
          port_name: string
          signal_strength: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imei?: string | null
          last_seen_at?: string | null
          location_id: string
          operator?: string | null
          port_name: string
          signal_strength?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imei?: string | null
          last_seen_at?: string | null
          location_id?: string
          operator?: string | null
          port_name?: string
          signal_strength?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modems_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          amount_cents: number
          chip_id: string | null
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          phone_number: string | null
          pix_proof_url: string | null
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_cents?: number
          chip_id?: string | null
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          pix_proof_url?: string | null
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_cents?: number
          chip_id?: string | null
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          pix_proof_url?: string | null
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance_cents: number
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recharge_requests: {
        Row: {
          admin_notes: string | null
          amount_cents: number
          created_at: string
          id: string
          pix_proof_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_cents: number
          created_at?: string
          id?: string
          pix_proof_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          pix_proof_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          chip_id: string
          created_at: string
          direction: string
          id: string
          message: string | null
          received_at: string
          recipient: string | null
          sender: string | null
        }
        Insert: {
          chip_id: string
          created_at?: string
          direction: string
          id?: string
          message?: string | null
          received_at?: string
          recipient?: string | null
          sender?: string | null
        }
        Update: {
          chip_id?: string
          created_at?: string
          direction?: string
          id?: string
          message?: string | null
          received_at?: string
          recipient?: string | null
          sender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      weekly_sales_report: {
        Row: {
          collaborator_id: string | null
          commission_cents: number | null
          location_name: string | null
          service_id: string | null
          service_name: string | null
          service_type: string | null
          total_orders: number | null
          total_revenue_cents: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "collaborator" | "customer"
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
      app_role: ["admin", "collaborator", "customer"],
    },
  },
} as const
