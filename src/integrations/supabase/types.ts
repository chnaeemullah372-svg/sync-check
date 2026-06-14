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
      ai_provider_keys: {
        Row: {
          api_key: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          id: number
          mode: string
          provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          mode?: string
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          mode?: string
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          entry_id: string | null
          estimated_cost: number
          estimated_tokens: number
          id: string
          input_type: string
          mode: string
          provider: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          estimated_cost?: number
          estimated_tokens?: number
          id?: string
          input_type: string
          mode: string
          provider?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          estimated_cost?: number
          estimated_tokens?: number
          id?: string
          input_type?: string
          mode?: string
          provider?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          created_at: string
          entry_no: number
          id: string
          status: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_no?: number
          id?: string
          status?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_no?: number
          id?: string
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_auto_saves: {
        Row: {
          entry_id: string | null
          form_data: Json
          id: string
          images_meta: Json | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          entry_id?: string | null
          form_data?: Json
          id?: string
          images_meta?: Json | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          entry_id?: string | null
          form_data?: Json
          id?: string
          images_meta?: Json | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_auto_saves_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_auto_saves_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_files: {
        Row: {
          created_at: string
          entry_id: string
          file_type: string
          file_url: string
          id: string
          member_id: string | null
          meta: Json | null
        }
        Insert: {
          created_at?: string
          entry_id: string
          file_type: string
          file_url: string
          id?: string
          member_id?: string | null
          meta?: Json | null
        }
        Update: {
          created_at?: string
          entry_id?: string
          file_type?: string
          file_url?: string
          id?: string
          member_id?: string | null
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_files_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_files_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "entry_members"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_members: {
        Row: {
          created_at: string
          data: Json
          entry_id: string
          id: string
          member_no: number
        }
        Insert: {
          created_at?: string
          data?: Json
          entry_id: string
          id?: string
          member_no?: number
        }
        Update: {
          created_at?: string
          data?: Json
          entry_id?: string
          id?: string
          member_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          entry_id: string
          export_type: string
          file_url: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          export_type: string
          file_url?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          export_type?: string
          file_url?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_slots: {
        Row: {
          group_json: Json
          id: string
          slot_index: number
          slot_name: string | null
          template_id: string
        }
        Insert: {
          group_json?: Json
          id?: string
          slot_index: number
          slot_name?: string | null
          template_id: string
        }
        Update: {
          group_json?: Json
          id?: string
          slot_index?: number
          slot_name?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_objects: {
        Row: {
          id: string
          objects: Json
          template_id: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          objects?: Json
          template_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          objects?: Json
          template_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_objects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          ai_fields: Json
          ai_instructions: string | null
          archived_at: string | null
          background_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          height: number
          id: string
          members_per_page: number | null
          name: string
          page_size: string
          status: string
          updated_at: string
          width: number
        }
        Insert: {
          ai_fields?: Json
          ai_instructions?: string | null
          archived_at?: string | null
          background_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          members_per_page?: number | null
          name: string
          page_size?: string
          status?: string
          updated_at?: string
          width?: number
        }
        Update: {
          ai_fields?: Json
          ai_instructions?: string | null
          archived_at?: string | null
          background_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          members_per_page?: number | null
          name?: string
          page_size?: string
          status?: string
          updated_at?: string
          width?: number
        }
        Relationships: []
      }
      user_adjustments: {
        Row: {
          action_type: string
          created_at: string
          entry_id: string
          id: string
          new_value: Json | null
          object_key: string | null
          old_value: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          entry_id: string
          id?: string
          new_value?: Json | null
          object_key?: string | null
          old_value?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          entry_id?: string
          id?: string
          new_value?: Json | null
          object_key?: string | null
          old_value?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_adjustments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_access: {
        Row: {
          access: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access?: string
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
      user_templates: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
