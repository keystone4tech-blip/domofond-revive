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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          address: string
          apartment: string | null
          created_at: string | null
          debt_amount: number
          id: string
          period: string
          updated_at: string | null
        }
        Insert: {
          account_number: string
          address: string
          apartment?: string | null
          created_at?: string | null
          debt_amount?: number
          id?: string
          period: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          address?: string
          apartment?: string | null
          created_at?: string | null
          debt_amount?: number
          id?: string
          period?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      calculations: {
        Row: {
          additional_cameras: number
          created_at: string | null
          elevator_cameras: number
          entrances: number
          gates: number
          id: string
          is_individual: boolean | null
          name: string
          phone: string
          smart_intercoms: number
          tariff_details: Json | null
          tariff_per_apt: number | null
          total_apartments: number
          updated_at: string | null
        }
        Insert: {
          additional_cameras?: number
          created_at?: string | null
          elevator_cameras?: number
          entrances?: number
          gates?: number
          id?: string
          is_individual?: boolean | null
          name: string
          phone: string
          smart_intercoms?: number
          tariff_details?: Json | null
          tariff_per_apt?: number | null
          total_apartments?: number
          updated_at?: string | null
        }
        Update: {
          additional_cameras?: number
          created_at?: string | null
          elevator_cameras?: number
          entrances?: number
          gates?: number
          id?: string
          is_individual?: boolean | null
          name?: string
          phone?: string
          smart_intercoms?: number
          tariff_details?: Json | null
          tariff_per_apt?: number | null
          total_apartments?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          id: string
          last_message_at: string
          messages_count: number
          session_id: string
          started_at: string
          status: string
        }
        Insert: {
          id?: string
          last_message_at?: string
          messages_count?: number
          session_id: string
          started_at?: string
          status?: string
        }
        Update: {
          id?: string
          last_message_at?: string
          messages_count?: number
          session_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_widget_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          knowledge_base: string | null
          system_prompt: string
          updated_at: string | null
          welcome_message: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: string | null
          system_prompt?: string
          updated_at?: string | null
          welcome_message?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: string | null
          system_prompt?: string
          updated_at?: string | null
          welcome_message?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          id: string
          location: Json | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          is_approved: boolean | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_location: Json | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          position: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_location?: Json | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_location?: Json | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      location_history: {
        Row: {
          employee_id: string
          id: string
          location: Json
          recorded_at: string | null
        }
        Insert: {
          employee_id: string
          id?: string
          location: Json
          recorded_at?: string | null
        }
        Update: {
          employee_id?: string
          id?: string
          location?: Json
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          id: string
          image_url: string | null
          is_auto_generated: boolean
          is_published: boolean | null
          published_at: string | null
          segment_slug: string | null
          seo_keywords: string[] | null
          source_urls: string[] | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_auto_generated?: boolean
          is_published?: boolean | null
          published_at?: string | null
          segment_slug?: string | null
          seo_keywords?: string[] | null
          source_urls?: string[] | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_auto_generated?: boolean
          is_published?: boolean | null
          published_at?: string | null
          segment_slug?: string | null
          seo_keywords?: string[] | null
          source_urls?: string[] | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      news_automation_settings: {
        Row: {
          ai_model: string
          auto_publish_without_review: boolean
          brand_pitch: string | null
          created_at: string
          freshness_days: number
          id: string
          image_strategy: string
          is_enabled: boolean
          last_run_at: string | null
          news_source: string
          next_run_at: string | null
          photo_source: string
          posts_per_run: number
          publish_mode: string
          region: string
          schedule_cron: string | null
          schedule_days: number[]
          schedule_time: string
          topics: string[] | null
          updated_at: string
        }
        Insert: {
          ai_model?: string
          auto_publish_without_review?: boolean
          brand_pitch?: string | null
          created_at?: string
          freshness_days?: number
          id?: string
          image_strategy?: string
          is_enabled?: boolean
          last_run_at?: string | null
          news_source?: string
          next_run_at?: string | null
          photo_source?: string
          posts_per_run?: number
          publish_mode?: string
          region?: string
          schedule_cron?: string | null
          schedule_days?: number[]
          schedule_time?: string
          topics?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_model?: string
          auto_publish_without_review?: boolean
          brand_pitch?: string | null
          created_at?: string
          freshness_days?: number
          id?: string
          image_strategy?: string
          is_enabled?: boolean
          last_run_at?: string | null
          news_source?: string
          next_run_at?: string | null
          photo_source?: string
          posts_per_run?: number
          publish_mode?: string
          region?: string
          schedule_cron?: string | null
          schedule_days?: number[]
          schedule_time?: string
          topics?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      news_drafts: {
        Row: {
          ai_model: string | null
          content: string
          created_at: string
          error_message: string | null
          excerpt: string | null
          id: string
          image_prompt: string | null
          image_url: string | null
          published_news_id: string | null
          raw_research: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string | null
          segment_slug: string | null
          source_urls: string[] | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          content: string
          created_at?: string
          error_message?: string | null
          excerpt?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          published_news_id?: string | null
          raw_research?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          segment_slug?: string | null
          source_urls?: string[] | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          content?: string
          created_at?: string
          error_message?: string | null
          excerpt?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          published_news_id?: string | null
          raw_research?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          segment_slug?: string | null
          source_urls?: string[] | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_drafts_published_news_id_fkey"
            columns: ["published_news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_segments: {
        Row: {
          created_at: string
          cta_style: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          pain_points: string | null
          publish_mode: string | null
          slug: string
          tone: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          cta_style?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pain_points?: string | null
          publish_mode?: string | null
          slug: string
          tone: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          cta_style?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pain_points?: string | null
          publish_mode?: string | null
          slug?: string
          tone?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          apartment: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          apartment?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          apartment?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          start_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_checklists: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          item_text: string
          order_index: number | null
          request_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_text: string
          order_index?: number | null
          request_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_text?: string
          order_index?: number | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_checklists_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_history: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          performed_by: string | null
          performed_by_name: string | null
          request_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          request_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_items: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          quantity: number
          request_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          product_id: string
          quantity?: number
          request_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          address: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          message: string
          name: string
          notes: string | null
          phone: string
          priority: string
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          address: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message: string
          name: string
          notes?: string | null
          phone: string
          priority?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          address?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message?: string
          name?: string
          notes?: string | null
          phone?: string
          priority?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_history: {
        Row: {
          applied_by: string | null
          created_at: string
          field_name: string
          id: string
          is_rolled_back: boolean
          new_value: string | null
          page_path: string
          previous_value: string | null
          rolled_back_at: string | null
          suggestion_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          is_rolled_back?: boolean
          new_value?: string | null
          page_path: string
          previous_value?: string | null
          rolled_back_at?: string | null
          suggestion_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          is_rolled_back?: boolean
          new_value?: string | null
          page_path?: string
          previous_value?: string | null
          rolled_back_at?: string | null
          suggestion_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_history_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "seo_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          page_path: string
          priority: number
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          page_path: string
          priority?: number
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          page_path?: string
          priority?: number
          source?: string
        }
        Relationships: []
      }
      seo_page_meta: {
        Row: {
          canonical_url: string | null
          created_at: string
          description: string | null
          h1: string | null
          id: string
          is_auto_managed: boolean
          json_ld: Json | null
          keywords: string | null
          last_optimized_at: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          page_path: string
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          h1?: string | null
          id?: string
          is_auto_managed?: boolean
          json_ld?: Json | null
          keywords?: string | null
          last_optimized_at?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_path: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          h1?: string | null
          id?: string
          is_auto_managed?: boolean
          json_ld?: Json | null
          keywords?: string | null
          last_optimized_at?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_path?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          ai_model: string
          auto_apply: boolean
          brand_context: string | null
          created_at: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          optimize_alt: boolean
          optimize_content: boolean
          optimize_jsonld: boolean
          optimize_meta: boolean
          schedule_cron: string | null
          updated_at: string
        }
        Insert: {
          ai_model?: string
          auto_apply?: boolean
          brand_context?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          optimize_alt?: boolean
          optimize_content?: boolean
          optimize_jsonld?: boolean
          optimize_meta?: boolean
          schedule_cron?: string | null
          updated_at?: string
        }
        Update: {
          ai_model?: string
          auto_apply?: boolean
          brand_context?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          optimize_alt?: boolean
          optimize_content?: boolean
          optimize_jsonld?: boolean
          optimize_meta?: boolean
          schedule_cron?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_suggestions: {
        Row: {
          after_value: string
          ai_model: string | null
          applied_at: string | null
          before_value: string | null
          created_at: string
          field_name: string
          id: string
          keywords_used: string[] | null
          page_path: string
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          after_value: string
          ai_model?: string | null
          applied_at?: string | null
          before_value?: string | null
          created_at?: string
          field_name: string
          id?: string
          keywords_used?: string[] | null
          page_path: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          after_value?: string
          ai_model?: string | null
          applied_at?: string | null
          before_value?: string | null
          created_at?: string
          field_name?: string
          id?: string
          keywords_used?: string[] | null
          page_path?: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      site_blocks: {
        Row: {
          block_name: string
          content: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          page: string
          updated_at: string | null
        }
        Insert: {
          block_name: string
          content: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          page: string
          updated_at?: string | null
        }
        Update: {
          block_name?: string
          content?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          page?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_checklists: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          item_text: string
          order_index: number | null
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_text: string
          order_index?: number | null
          task_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_text?: string
          order_index?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          location: Json | null
          photo_url: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location?: Json | null
          photo_url: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location?: Json | null
          photo_url?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          assigned_by: string | null
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          priority: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_conversations: {
        Row: {
          id: string
          last_message_at: string | null
          messages_count: number | null
          started_at: string | null
          status: string | null
          telegram_user_id: string
        }
        Insert: {
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          started_at?: string | null
          status?: string | null
          telegram_user_id: string
        }
        Update: {
          id?: string
          last_message_at?: string | null
          messages_count?: number | null
          started_at?: string | null
          status?: string | null
          telegram_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_conversations_telegram_user_id_fkey"
            columns: ["telegram_user_id"]
            isOneToOne: false
            referencedRelation: "telegram_users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages_log: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          chat_id: number
          created_at: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          linked_profile_id: string | null
          phone: string | null
          telegram_id: number
          updated_at: string | null
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          linked_profile_id?: string | null
          phone?: string | null
          telegram_id: number
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          linked_profile_id?: string | null
          phone?: string | null
          telegram_id?: number
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_users_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      can_manage_role: {
        Args: {
          _target_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_admin_console_access: { Args: { _user_id: string }; Returns: boolean }
      has_fsm_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_telegram_messages_count: {
        Args: { conv_id: string }
        Returns: undefined
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "director"
        | "dispatcher"
        | "master"
        | "engineer"
        | "manager"
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
      app_role: [
        "admin",
        "user",
        "director",
        "dispatcher",
        "master",
        "engineer",
        "manager",
      ],
    },
  },
} as const
