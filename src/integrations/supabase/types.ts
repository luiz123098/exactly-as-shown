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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          body: string
          category: string
          cover_url: string | null
          created_at: string
          excerpt: string
          featured: boolean
          id: string
          published: boolean
          title: string
          video_url: string | null
        }
        Insert: {
          body?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          featured?: boolean
          id?: string
          published?: boolean
          title: string
          video_url?: string | null
        }
        Update: {
          body?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          featured?: boolean
          id?: string
          published?: boolean
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      benefit_usages: {
        Row: {
          benefit_id: string
          code: string
          created_at: string
          id: string
          saved_amount: number
          sponsor_id: string | null
          status: string
          user_id: string
          validated_at: string | null
        }
        Insert: {
          benefit_id: string
          code: string
          created_at?: string
          id?: string
          saved_amount?: number
          sponsor_id?: string | null
          status?: string
          user_id: string
          validated_at?: string | null
        }
        Update: {
          benefit_id?: string
          code?: string
          created_at?: string
          id?: string
          saved_amount?: number
          sponsor_id?: string | null
          status?: string
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_usages_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          discount_label: string
          expires_at: string | null
          id: string
          min_plan_level: number
          rules: string | null
          sponsor_id: string
          title: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          discount_label?: string
          expires_at?: string | null
          id?: string
          min_plan_level?: number
          rules?: string | null
          sponsor_id: string
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          discount_label?: string
          expires_at?: string | null
          id?: string
          min_plan_level?: number
          rules?: string | null
          sponsor_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefits_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          code: string
          created_at: string
          event_id: string
          guests: number
          id: string
          status: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          event_id: string
          guests?: number
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          event_id?: string
          guests?: number
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          created_at: string
          description: string
          featured: boolean
          gallery: string[]
          id: string
          image_url: string | null
          kind: string
          location: string
          min_plan_level: number
          price: number
          sponsor_ids: string[]
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          description?: string
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          kind?: string
          location?: string
          min_plan_level?: number
          price?: number
          sponsor_ids?: string[]
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          kind?: string
          location?: string
          min_plan_level?: number
          price?: number
          sponsor_ids?: string[]
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          benefit_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          benefit_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          benefit_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_cars: {
        Row: {
          author_name: string
          brand: string
          color: string | null
          created_at: string
          description: string
          id: string
          model: string
          photo_url: string | null
          user_id: string
          video_url: string | null
          year: number | null
        }
        Insert: {
          author_name?: string
          brand: string
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          model: string
          photo_url?: string | null
          user_id: string
          video_url?: string | null
          year?: number | null
        }
        Update: {
          author_name?: string
          brand?: string
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          model?: string
          photo_url?: string | null
          user_id?: string
          video_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      home_config: {
        Row: {
          hero_badge: string
          hero_image: string | null
          hero_link: string | null
          hero_subtitle: string
          hero_title: string
          id: number
          sections: string[]
          updated_at: string
        }
        Insert: {
          hero_badge?: string
          hero_image?: string | null
          hero_link?: string | null
          hero_subtitle?: string
          hero_title?: string
          id?: number
          sections?: string[]
          updated_at?: string
        }
        Update: {
          hero_badge?: string
          hero_image?: string | null
          hero_link?: string | null
          hero_subtitle?: string
          hero_title?: string
          id?: number
          sections?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          description: string | null
          features: string[]
          highlighted: boolean
          id: string
          level: number
          name: string
          price: number
          slug: string
        }
        Insert: {
          description?: string | null
          features?: string[]
          highlighted?: boolean
          id?: string
          level?: number
          name: string
          price: number
          slug: string
        }
        Update: {
          description?: string | null
          features?: string[]
          highlighted?: boolean
          id?: string
          level?: number
          name?: string
          price?: number
          slug?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id?: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string
          garage_public: boolean
          id: string
          interests: string[]
          member_code: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          garage_public?: boolean
          id: string
          interests?: string[]
          member_code?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          garage_public?: boolean
          id?: string
          interests?: string[]
          member_code?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          category: string
          created_at: string
          description: string
          discount_label: string
          ends_at: string | null
          featured: boolean
          id: string
          image_url: string | null
          min_plan_level: number
          sponsor_id: string
          starts_at: string
          status: Database["public"]["Enums"]["approval_status"]
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          discount_label?: string
          ends_at?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          min_plan_level?: number
          sponsor_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          discount_label?: string
          ends_at?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          min_plan_level?: number
          sponsor_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          item_id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsor_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          sponsor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          sponsor_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          sponsor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_events_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          address: string
          category: string
          city: string
          cover_url: string | null
          created_at: string
          description: string
          featured: boolean
          gallery: string[]
          hours: string | null
          id: string
          instagram: string | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["approval_status"]
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string
          category?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          gallery?: string[]
          hours?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string
          category?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          gallery?: string[]
          hours?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          id: string
          plan_id: string
          renews_at: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          id?: string
          plan_id: string
          renews_at?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          id?: string
          plan_id?: string
          renews_at?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      [_ in never]: never
    }
    Functions: {
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      broadcast_notification: {
        Args: { _body: string; _target: string; _title: string }
        Returns: number
      }
      event_taken: { Args: { _event: string }; Returns: number }
      garage_hidden: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_sponsor_owner: { Args: { _sponsor: string }; Returns: boolean }
      member_level: { Args: { _uid: string }; Returns: number }
      sponsor_approved: { Args: { _sponsor: string }; Returns: boolean }
      validate_usage: {
        Args: { _amount: number; _code: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "sponsor" | "member"
      approval_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["admin", "sponsor", "member"],
      approval_status: ["pending", "approved", "rejected"],
    },
  },
} as const
