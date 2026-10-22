export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'administrator' | 'owner' | 'viewer'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'administrator' | 'owner' | 'viewer'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'administrator' | 'owner' | 'viewer'
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          version: number
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string | null
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          version?: number
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          tags?: string[] | null
          version?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_grants: {
        Row: {
          id: string
          document_id: string
          granted_to: string
          granted_by: string
          permission: 'read' | 'edit'
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          document_id: string
          granted_to: string
          granted_by: string
          permission: 'read' | 'edit'
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          permission?: 'read' | 'edit'
          expires_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          metadata: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lookup_user_by_email: {
        Args: {
          target_email: string
        }
        Returns: {
          id: string
          email: string
          full_name: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentGrant = Database['public']['Tables']['document_grants']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type UserRole = 'administrator' | 'owner' | 'viewer'
export type Permission = 'read' | 'edit'
