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
      profiles: {
        Row: {
          activity_level: string | null;
          age_range: string | null;
          created_at: string;
          goal: string | null;
          id: string;
          target_steps: number | null;
          updated_at: string;
          weekly_workouts: number | null;
        };
        Insert: {
          activity_level?: string | null;
          age_range?: string | null;
          created_at?: string;
          goal?: string | null;
          id: string;
          target_steps?: number | null;
          updated_at?: string;
          weekly_workouts?: number | null;
        };
        Update: {
          activity_level?: string | null;
          age_range?: string | null;
          created_at?: string;
          goal?: string | null;
          id?: string;
          target_steps?: number | null;
          updated_at?: string;
          weekly_workouts?: number | null;
        };
        Relationships: [];
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
