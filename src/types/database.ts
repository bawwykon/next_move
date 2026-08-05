export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          hint: string | null;
          id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          hint?: string | null;
          id?: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          hint?: string | null;
          id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cosmetics: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          type: string;
          unlock_rule: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          type: string;
          unlock_rule?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          type?: string;
          unlock_rule?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_library: {
        Row: {
          beginner_variation: string | null;
          categories: string[];
          created_at: string;
          id: string;
          instruction: string | null;
          name: string;
          safety_note: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          beginner_variation?: string | null;
          categories?: string[];
          created_at?: string;
          id?: string;
          instruction?: string | null;
          name: string;
          safety_note?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          beginner_variation?: string | null;
          categories?: string[];
          created_at?: string;
          id?: string;
          instruction?: string | null;
          name?: string;
          safety_note?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mastery: {
        Row: {
          created_at: string;
          points: number;
          profile_id: string;
          track: string;
        };
        Insert: {
          created_at?: string;
          points?: number;
          profile_id: string;
          track: string;
        };
        Update: {
          created_at?: string;
          points?: number;
          profile_id?: string;
          track?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mastery_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      onboarding: {
        Row: {
          activity_level: number;
          completed_at: string | null;
          experience: number;
          goals: string[];
          profile_id: string;
          workout_time: string | null;
        };
        Insert: {
          activity_level: number;
          completed_at?: string | null;
          experience: number;
          goals?: string[];
          profile_id: string;
          workout_time?: string | null;
        };
        Update: {
          activity_level?: number;
          completed_at?: string | null;
          experience?: number;
          goals?: string[];
          profile_id?: string;
          workout_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'onboarding_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_achievements: {
        Row: {
          achievement_id: string;
          created_at: string;
          profile_id: string;
          unlocked_at: string | null;
        };
        Insert: {
          achievement_id: string;
          created_at?: string;
          profile_id: string;
          unlocked_at?: string | null;
        };
        Update: {
          achievement_id?: string;
          created_at?: string;
          profile_id?: string;
          unlocked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_achievements_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_cosmetics: {
        Row: {
          cosmetic_id: string;
          created_at: string;
          profile_id: string;
          unlocked_at: string | null;
        };
        Insert: {
          cosmetic_id: string;
          created_at?: string;
          profile_id: string;
          unlocked_at?: string | null;
        };
        Update: {
          cosmetic_id?: string;
          created_at?: string;
          profile_id?: string;
          unlocked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_cosmetics_cosmetic_id_fkey';
            columns: ['cosmetic_id'];
            isOneToOne: false;
            referencedRelation: 'cosmetics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_cosmetics_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          onboarded: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          onboarded?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          onboarded?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      quest_completions: {
        Row: {
          bonus_breakdown: Json;
          completed_at: string | null;
          created_at: string;
          duration_sec: number | null;
          id: string;
          idempotency_key: string;
          mastered: string[];
          profile_id: string;
          quest_id: string;
          started_at: string | null;
          xp_awarded: number | null;
        };
        Insert: {
          bonus_breakdown?: Json;
          completed_at?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          id?: string;
          idempotency_key: string;
          mastered?: string[];
          profile_id: string;
          quest_id: string;
          started_at?: string | null;
          xp_awarded?: number | null;
        };
        Update: {
          bonus_breakdown?: Json;
          completed_at?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          id?: string;
          idempotency_key?: string;
          mastered?: string[];
          profile_id?: string;
          quest_id?: string;
          started_at?: string | null;
          xp_awarded?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'quest_completions_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quest_completions_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
        ];
      };
      quest_segments: {
        Row: {
          created_at: string;
          duration_sec: number;
          exercise_id: string | null;
          id: string;
          kind: string;
          position: number;
          quest_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_sec: number;
          exercise_id?: string | null;
          id?: string;
          kind: string;
          position: number;
          quest_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_sec?: number;
          exercise_id?: string | null;
          id?: string;
          kind?: string;
          position?: number;
          quest_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quest_segments_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quest_segments_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
        ];
      };
      quests: {
        Row: {
          active: boolean;
          categories: string[];
          created_at: string;
          description: string | null;
          difficulty: string;
          duration_sec: number;
          id: string;
          slug: string;
          title: string;
          updated_at: string;
          xp_reward: number;
        };
        Insert: {
          active?: boolean;
          categories?: string[];
          created_at?: string;
          description?: string | null;
          difficulty: string;
          duration_sec: number;
          id?: string;
          slug: string;
          title: string;
          updated_at?: string;
          xp_reward: number;
        };
        Update: {
          active?: boolean;
          categories?: string[];
          created_at?: string;
          description?: string | null;
          difficulty?: string;
          duration_sec?: number;
          id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      streaks_rewards: {
        Row: {
          awarded_at: string | null;
          created_at: string;
          profile_id: string;
          reward_day: number;
        };
        Insert: {
          awarded_at?: string | null;
          created_at?: string;
          profile_id: string;
          reward_day: number;
        };
        Update: {
          awarded_at?: string | null;
          created_at?: string;
          profile_id?: string;
          reward_day?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'streaks_rewards_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
