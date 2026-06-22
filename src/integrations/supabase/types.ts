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
      activity_days: {
        Row: {
          created_at: string | null
          date: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          auto_added: boolean
          calendar_id: string | null
          created_at: string
          date: string
          description: string
          end_date: string
          end_time: string
          exception_dates: string[]
          id: string
          location: string
          name: string
          note: string
          repeat_end: string
          repeat_type: string
          series_id: string | null
          source: string | null
          source_title: string | null
          subject: string
          time: string
          type: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          auto_added?: boolean
          calendar_id?: string | null
          created_at?: string
          date: string
          description?: string
          end_date?: string
          end_time?: string
          exception_dates?: string[]
          id?: string
          location?: string
          name: string
          note?: string
          repeat_end?: string
          repeat_type?: string
          series_id?: string | null
          source?: string | null
          source_title?: string | null
          subject?: string
          time?: string
          type?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          auto_added?: boolean
          calendar_id?: string | null
          created_at?: string
          date?: string
          description?: string
          end_date?: string
          end_time?: string
          exception_dates?: string[]
          id?: string
          location?: string
          name?: string
          note?: string
          repeat_end?: string
          repeat_type?: string
          series_id?: string | null
          source?: string | null
          source_title?: string | null
          subject?: string
          time?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "user_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          color: string
          created_at: string
          id: string
          is_builtin: boolean
          label: string | null
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          label?: string | null
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          label?: string | null
          name?: string
        }
        Relationships: []
      }
      flashcard_sessions: {
        Row: {
          created_at: string | null
          current_index: number
          id: string
          learned_count: number
          list_id: string
          mode: string
          remaining_word_ids: string[]
          unknown_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_index?: number
          id?: string
          learned_count?: number
          list_id: string
          mode?: string
          remaining_word_ids?: string[]
          unknown_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_index?: number
          id?: string
          learned_count?: number
          list_id?: string
          mode?: string
          remaining_word_ids?: string[]
          unknown_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sessions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "word_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_sentences: {
        Row: {
          created_at: string | null
          definition: string | null
          hint: string | null
          id: string
          list_id: string
          sentence: string
          word: string
          word_id: string
        }
        Insert: {
          created_at?: string | null
          definition?: string | null
          hint?: string | null
          id?: string
          list_id: string
          sentence?: string
          word: string
          word_id: string
        }
        Update: {
          created_at?: string | null
          definition?: string | null
          hint?: string | null
          id?: string
          list_id?: string
          sentence?: string
          word?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_sentences_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "word_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_sentences_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_for: string[]
          id: string
          image_url: string | null
          reactions: Json
          read: boolean | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          reactions?: Json
          read?: boolean | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          reactions?: Json
          read?: boolean | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          modified_at: string
          section_id: string
          sort_order: number
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          modified_at?: string
          section_id: string
          sort_order?: number
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          modified_at?: string
          section_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_pages_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_sections: {
        Row: {
          created_at: string
          id: string
          name: string
          notebook_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notebook_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notebook_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebook_sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          subject: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          subject?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_progress: {
        Row: {
          attempts: number
          created_at: string
          id: string
          list_id: string
          mastered: boolean
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          list_id: string
          mastered?: boolean
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          list_id?: string
          mastered?: boolean
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_progress_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "word_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      reminder_lists: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          quadrant: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          quadrant: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          quadrant?: number
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          list_id: string
          notes: string
          priority: number
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          list_id: string
          notes?: string
          priority?: number
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          list_id?: string
          notes?: string
          priority?: number
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "reminder_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      test_saves: {
        Row: {
          created_at: string | null
          id: string
          test_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          test_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_saves_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          author_id: string
          author_name: string
          created_at: string | null
          description: string
          id: string
          images: string[]
          klasa: string
          likes: string[]
          questions: Json
          school_name: string
          scope: string
          solutions: Json
          subject: string
          teacher: string
          title: string
          user_id: string
          uses: number
        }
        Insert: {
          author_id?: string
          author_name?: string
          created_at?: string | null
          description?: string
          id?: string
          images?: string[]
          klasa?: string
          likes?: string[]
          questions?: Json
          school_name?: string
          scope?: string
          solutions?: Json
          subject?: string
          teacher?: string
          title: string
          user_id: string
          uses?: number
        }
        Update: {
          author_id?: string
          author_name?: string
          created_at?: string | null
          description?: string
          id?: string
          images?: string[]
          klasa?: string
          likes?: string[]
          questions?: Json
          school_name?: string
          scope?: string
          solutions?: Json
          subject?: string
          teacher?: string
          title?: string
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      tips: {
        Row: {
          approved: boolean
          created_at: string
          description: string
          id: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          description?: string
          id?: string
          title: string
          url?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          description?: string
          id?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          email: string
          fee_exempt: boolean
          id: string
          name: string
          payment_date: string | null
          payment_method: string | null
          role: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_status: string
          username: string
          webhook_suspended_at: string | null
          webhook_suspended_reason: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          email: string
          fee_exempt?: boolean
          id?: string
          name: string
          payment_date?: string | null
          payment_method?: string | null
          role?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          username: string
          webhook_suspended_at?: string | null
          webhook_suspended_reason?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          email?: string
          fee_exempt?: boolean
          id?: string
          name?: string
          payment_date?: string | null
          payment_method?: string | null
          role?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          username?: string
          webhook_suspended_at?: string | null
          webhook_suspended_reason?: string | null
        }
        Relationships: []
      }
      user_calendar_feeds: {
        Row: {
          created_at: string
          token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_calendars: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
          visible: boolean
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
          visible?: boolean
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_profile_private: {
        Row: {
          created_at: string
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          banner_color: string | null
          bio: string | null
          created_at: string | null
          id: string
          interests: string[] | null
          location: string | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      webhook_usage: {
        Row: {
          count: number
          id: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          count?: number
          id?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      word_lists: {
        Row: {
          created_at: string
          definition_language: string
          id: string
          is_draft: boolean
          language: string
          name: string
          sentences_generating: boolean
          share_slug: string | null
          special_instructions: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          definition_language?: string
          id?: string
          is_draft?: boolean
          language?: string
          name: string
          sentences_generating?: boolean
          share_slug?: string | null
          special_instructions?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          definition_language?: string
          id?: string
          is_draft?: boolean
          language?: string
          name?: string
          sentences_generating?: boolean
          share_slug?: string | null
          special_instructions?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: string
          definition: string | null
          id: string
          list_id: string
          word: string
        }
        Insert: {
          created_at?: string
          definition?: string | null
          id?: string
          list_id: string
          word: string
        }
        Update: {
          created_at?: string
          definition?: string | null
          id?: string
          list_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "word_lists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_settings_public: {
        Row: {
          key: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      user_accounts_public: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          role: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_test_solution: {
        Args: {
          p_author_name: string
          p_content: string
          p_images: string[]
          p_test_id: string
        }
        Returns: undefined
      }
      create_default_calendars: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_default_notebooks: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_default_reminder_lists: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      delete_test_solution: {
        Args: { p_solution_id: string; p_test_id: string }
        Returns: undefined
      }
      get_user_role: { Args: { uid: string }; Returns: string }
      increment_test_uses: { Args: { p_test_id: string }; Returns: undefined }
      toggle_test_like: { Args: { p_test_id: string }; Returns: undefined }
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
    Enums: {},
  },
} as const
