export type UserRole = "ace" | "acem";

export interface CurrentUser {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  team_id: string | null;
  is_admin: boolean;
}

export interface AuthMode {
  spcs_mode: boolean;
  mock_data: boolean;
}
