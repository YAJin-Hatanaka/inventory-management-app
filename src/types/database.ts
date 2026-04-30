export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          username: string;
          role: "admin" | "manager" | "general";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role?: "admin" | "manager" | "general";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: never;
          username?: string;
          role?: "admin" | "manager" | "general";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_role_audit_logs: {
        Row: {
          id: string;
          target_user_id: string;
          actor_user_id: string;
          previous_role: "admin" | "manager" | "general";
          new_role: "admin" | "manager" | "general";
          created_at: string;
        };
        Insert: {
          id?: string;
          target_user_id: string;
          actor_user_id: string;
          previous_role: "admin" | "manager" | "general";
          new_role: "admin" | "manager" | "general";
          created_at?: string;
        };
        Update: {
          id?: never;
          target_user_id?: string;
          actor_user_id?: string;
          previous_role?: "admin" | "manager" | "general";
          new_role?: "admin" | "manager" | "general";
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          item_code: number;
          name: string;
          category: string | null;
          unit: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_code?: never;
          name: string;
          category?: string | null;
          unit: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: never;
          item_code?: never;
          name?: string;
          category?: string | null;
          unit?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          id: string;
          item_id: string;
          transaction_type: "inbound" | "outbound";
          quantity: number;
          transaction_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          transaction_type: "inbound" | "outbound";
          quantity: number;
          transaction_date?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          item_id?: string;
          transaction_type?: "inbound" | "outbound";
          quantity?: number;
          transaction_date?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      inventory_stock_summary: {
        Row: {
          item_id: string;
          item_code: number;
          name: string;
          category: string | null;
          unit: string;
          inbound_quantity: number;
          outbound_quantity: number;
          current_quantity: number;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      create_inventory_item: {
        Args: {
          p_name: string;
          p_category?: string | null;
          p_unit: string;
        };
        Returns: string;
      };
      delete_inventory_item: {
        Args: {
          p_item_id: string;
        };
        Returns: string;
      };
      register_inbound_transaction: {
        Args: {
          p_item_name: string;
          p_category: string;
          p_quantity: number;
          p_transaction_date: string;
          p_note?: string | null;
          p_unit: string;
        };
        Returns: string;
      };
      register_outbound_transaction: {
        Args: {
          p_item_id: string;
          p_quantity: number;
          p_transaction_date: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      update_inventory_item: {
        Args: {
          p_item_id: string;
          p_name: string;
          p_category?: string | null;
          p_unit: string;
        };
        Returns: string;
      };
      update_user_profile_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: "admin" | "manager" | "general";
          p_actor_user_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
