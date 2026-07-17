export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          role: 'admin' | 'member' | 'viewer';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          avatar_url?: string | null;
          role?: 'admin' | 'member' | 'viewer';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          avatar_url?: string | null;
          role?: 'admin' | 'member' | 'viewer';
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          is_live: boolean;
          is_active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_live?: boolean;
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          is_live?: boolean;
          is_active?: boolean;
          position?: number;
          updated_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          name: string;
          project_id: string;
          is_active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          project_id: string;
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          project_id?: string;
          is_active?: boolean;
          position?: number;
          updated_at?: string;
        };
      };
      master_task_types: {
        Row: {
          id: string;
          name: string;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          position?: number;
          is_active?: boolean;
        };
      };
      master_task_categories: {
        Row: {
          id: string;
          name: string;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          position?: number;
          is_active?: boolean;
        };
      };
      master_priorities: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_weight: number;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          sort_weight: number;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          sort_weight?: number;
          position?: number;
          is_active?: boolean;
        };
      };
      master_statuses: {
        Row: {
          id: string;
          name: string;
          color: string;
          position: number;
          is_closed: boolean;
          is_done: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          position?: number;
          is_closed?: boolean;
          is_done?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          position?: number;
          is_closed?: boolean;
          is_done?: boolean;
          is_active?: boolean;
        };
      };
      tasks: {
        Row: {
          id: string;
          task_no: string;
          parent_id: string | null;
          department_id: string;
          project_id: string;
          task_type_id: string | null;
          category_id: string | null;
          priority_id: string | null;
          assignee_id: string | null;
          status_id: string;
          title: string;
          description: string | null;
          planned_start_date: string | null;
          planned_end_date: string | null;
          planned_mins: number | null;
          actual_start_date: string | null;
          actual_end_date: string | null;
          actual_mins: number | null;
          position: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_no?: string;
          parent_id?: string | null;
          department_id: string;
          project_id: string;
          task_type_id?: string | null;
          category_id?: string | null;
          priority_id?: string | null;
          assignee_id?: string | null;
          status_id: string;
          title: string;
          description?: string | null;
          planned_start_date?: string | null;
          planned_end_date?: string | null;
          planned_mins?: number | null;
          actual_start_date?: string | null;
          actual_end_date?: string | null;
          actual_mins?: number | null;
          position?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_id?: string | null;
          department_id?: string;
          project_id?: string;
          task_type_id?: string | null;
          category_id?: string | null;
          priority_id?: string | null;
          assignee_id?: string | null;
          status_id?: string;
          title?: string;
          description?: string | null;
          planned_start_date?: string | null;
          planned_end_date?: string | null;
          planned_mins?: number | null;
          actual_start_date?: string | null;
          actual_end_date?: string | null;
          actual_mins?: number | null;
          position?: number;
          updated_at?: string;
        };
      };
      task_status_history: {
        Row: {
          id: string;
          task_id: string;
          task_no: string;
          from_status_id: string | null;
          to_status_id: string;
          changed_by: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          task_no: string;
          from_status_id?: string | null;
          to_status_id: string;
          changed_by: string;
          changed_at?: string;
        };
        Update: never;
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          task_id: string;
          file_name: string;
          storage_path: string | null;
          external_url: string | null;
          size_bytes: number | null;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          file_name: string;
          storage_path?: string | null;
          external_url?: string | null;
          size_bytes?: number | null;
          uploaded_by: string;
          created_at?: string;
        };
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          type: string;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          type: string;
          message: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
      };
      alert_rules: {
        Row: {
          id: string;
          name: string;
          rule_type: string;
          config: Record<string, unknown>;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          rule_type: string;
          config: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          rule_type?: string;
          config?: Record<string, unknown>;
          is_active?: boolean;
        };
      };
      saved_views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          view_type: 'list' | 'board' | 'calendar';
          filters: Record<string, unknown>;
          sort_config: Record<string, unknown>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          view_type: 'list' | 'board' | 'calendar';
          filters?: Record<string, unknown>;
          sort_config?: Record<string, unknown>[];
          created_at?: string;
        };
        Update: {
          name?: string;
          view_type?: 'list' | 'board' | 'calendar';
          filters?: Record<string, unknown>;
          sort_config?: Record<string, unknown>[];
        };
      };
    };
  };
};

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Department = Database['public']['Tables']['departments']['Row'];
export type MasterTaskType = Database['public']['Tables']['master_task_types']['Row'];
export type MasterTaskCategory = Database['public']['Tables']['master_task_categories']['Row'];
export type MasterPriority = Database['public']['Tables']['master_priorities']['Row'];
export type MasterStatus = Database['public']['Tables']['master_statuses']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskStatusHistory = Database['public']['Tables']['task_status_history']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AlertRule = Database['public']['Tables']['alert_rules']['Row'];
export type SavedView = Database['public']['Tables']['saved_views']['Row'];
