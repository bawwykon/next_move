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
          condition: Json;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          slug: string;
          tier: string | null;
          title: string;
          updated_at: string;
          xp_reward: number;
        };
        Insert: {
          condition?: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          slug: string;
          tier?: string | null;
          title: string;
          updated_at?: string;
          xp_reward?: number;
        };
        Update: {
          condition?: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          slug?: string;
          tier?: string | null;
          title?: string;
          updated_at?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      cosmetics: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          metadata: Json;
          name: string;
          price_xp: number;
          rarity: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          metadata?: Json;
          name: string;
          price_xp?: number;
          rarity?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          metadata?: Json;
          name?: string;
          price_xp?: number;
          rarity?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          equipment: string | null;
          id: string;
          instructions: Json;
          metadata: Json;
          muscle_group: string | null;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          equipment?: string | null;
          id?: string;
          instructions?: Json;
          metadata?: Json;
          muscle_group?: string | null;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          equipment?: string | null;
          id?: string;
          instructions?: Json;
          metadata?: Json;
          muscle_group?: string | null;
          name?: string;
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
      quests: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          description: string | null;
          difficulty: string | null;
          duration_minutes: number | null;
          id: string;
          metadata: Json;
          requirement: Json;
          slug: string;
          target_value: number | null;
          title: string;
          type: string | null;
          updated_at: string;
          xp_reward: number;
        };
        Insert: {
          active?: boolean;
          category: string;
          created_at?: string;
          description?: string | null;
          difficulty?: string | null;
          duration_minutes?: number | null;
          id?: string;
          metadata?: Json;
          requirement?: Json;
          slug: string;
          target_value?: number | null;
          title: string;
          type?: string | null;
          updated_at?: string;
          xp_reward?: number;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          description?: string | null;
          difficulty?: string | null;
          duration_minutes?: number | null;
          id?: string;
          metadata?: Json;
          requirement?: Json;
          slug?: string;
          target_value?: number | null;
          title?: string;
          type?: string | null;
          updated_at?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      segments: {
        Row: {
          active: boolean;
          config: Json;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          type: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          config?: Json;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          type: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          config?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          type?: string;
          updated_at?: string;
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
