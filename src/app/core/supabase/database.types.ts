// Gerado por `supabase gen types typescript --local`. Não editar à mão.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      draw_teams: {
        Row: {
          draw_id: string;
          group_id: string;
          id: string;
          player1_id: string;
          player2_id: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          draw_id: string;
          group_id: string;
          id?: string;
          player1_id: string;
          player2_id: string;
          position: number;
        };
        Update: {
          draw_id?: string;
          group_id?: string;
          id?: string;
          player1_id?: string;
          player2_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'draw_teams_draw_id_group_id_fkey';
            columns: ['draw_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'draws';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'draw_teams_player1_id_group_id_fkey';
            columns: ['player1_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'draw_teams_player1_id_group_id_fkey';
            columns: ['player1_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'draw_teams_player2_id_group_id_fkey';
            columns: ['player2_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'draw_teams_player2_id_group_id_fkey';
            columns: ['player2_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      draws: {
        Row: {
          badges: NonNullable<Json>;
          created_at: string;
          group_id: string;
          id: string;
          score: number;
          selected: boolean;
          session_id: string;
          waiting_player_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          badges?: NonNullable<Json>;
          created_at?: string;
          group_id: string;
          id?: string;
          score?: number;
          selected?: boolean;
          session_id: string;
          waiting_player_id?: string | null;
        };
        Update: {
          badges?: NonNullable<Json>;
          created_at?: string;
          group_id?: string;
          id?: string;
          score?: number;
          selected?: boolean;
          session_id?: string;
          waiting_player_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'draws_session_id_group_id_fkey';
            columns: ['session_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'draws_waiting_player_id_group_id_fkey';
            columns: ['waiting_player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'draws_waiting_player_id_group_id_fkey';
            columns: ['waiting_player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      group_members: {
        Row: {
          created_at: string;
          group_id: string;
          player_id: string | null;
          role: Database['public']['Enums']['group_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          group_id: string;
          player_id?: string | null;
          role?: Database['public']['Enums']['group_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          player_id?: string | null;
          role?: Database['public']['Enums']['group_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id'];
          },
          {
            foreignKeyName: 'group_members_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'group_members_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          id: string;
          initial_birth_date: string;
          name: string;
          owner_player_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          initial_birth_date: string;
          name: string;
          owner_player_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          initial_birth_date?: string;
          name?: string;
          owner_player_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_owner_fk';
            columns: ['owner_player_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id'];
          },
          {
            foreignKeyName: 'groups_owner_fk';
            columns: ['owner_player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_redeem_attempts: {
        Row: {
          attempted_at: string;
          attempted_code: string;
          id: number;
          succeeded: boolean;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string;
          attempted_code: string;
          id?: number;
          succeeded: boolean;
          user_id?: string | null;
        };
        Update: {
          attempted_at?: string;
          attempted_code?: string;
          id?: number;
          succeeded?: boolean;
          user_id?: string | null;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          code: string;
          created_at: string;
          expires_at: string | null;
          group_id: string;
          label: string | null;
          revoked_at: string | null;
          token: string;
          accept_invite: {
            group_id: string;
            group_name: string;
          } | null;
        };
        ComputedFields: 'accept_invite';
        Insert: {
          code?: string;
          created_at?: string;
          expires_at?: string | null;
          group_id: string;
          label?: string | null;
          revoked_at?: string | null;
          token?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          expires_at?: string | null;
          group_id?: string;
          label?: string | null;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invites_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          corrected_at: string | null;
          corrected_by: string | null;
          created_at: string;
          group_id: string;
          id: string;
          loser_id: string | null;
          phase: Database['public']['Enums']['match_phase'];
          played_at: string;
          point_difference: number | null;
          reported_by: string | null;
          score_a: number;
          score_b: number;
          session_id: string;
          team_a_id: string;
          team_b_id: string;
          tournament_id: string;
          winner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          corrected_at?: string | null;
          corrected_by?: string | null;
          created_at?: string;
          group_id: string;
          id?: string;
          loser_id?: never;
          phase: Database['public']['Enums']['match_phase'];
          played_at?: string;
          point_difference?: never;
          reported_by?: string | null;
          score_a: number;
          score_b: number;
          session_id: string;
          team_a_id: string;
          team_b_id: string;
          tournament_id: string;
          winner_id?: never;
        };
        Update: {
          corrected_at?: string | null;
          corrected_by?: string | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          loser_id?: never;
          phase?: Database['public']['Enums']['match_phase'];
          played_at?: string;
          point_difference?: never;
          reported_by?: string | null;
          score_a?: number;
          score_b?: number;
          session_id?: string;
          team_a_id?: string;
          team_b_id?: string;
          tournament_id?: string;
          winner_id?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_corrected_by_group_id_fkey';
            columns: ['corrected_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_corrected_by_group_id_fkey';
            columns: ['corrected_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_reported_by_group_id_fkey';
            columns: ['reported_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_reported_by_group_id_fkey';
            columns: ['reported_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_session_id_group_id_fkey';
            columns: ['session_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_team_a_id_group_id_fkey';
            columns: ['team_a_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_team_b_id_group_id_fkey';
            columns: ['team_b_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      odd_player_placements: {
        Row: {
          created_at: string;
          decided_at: string;
          decided_by: string | null;
          eliminated_player_id: string;
          encaixe_team_id: string;
          group_id: string;
          source_team_id: string;
          surviving_player_id: string;
          tournament_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decided_at?: string;
          decided_by?: string | null;
          eliminated_player_id: string;
          encaixe_team_id: string;
          group_id: string;
          source_team_id: string;
          surviving_player_id: string;
          tournament_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string;
          decided_by?: string | null;
          eliminated_player_id?: string;
          encaixe_team_id?: string;
          group_id?: string;
          source_team_id?: string;
          surviving_player_id?: string;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'odd_player_placements_decided_by_group_id_fkey';
            columns: ['decided_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'odd_player_placements_decided_by_group_id_fkey';
            columns: ['decided_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'odd_player_placements_encaixe_team_id_group_id_fkey';
            columns: ['encaixe_team_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'odd_player_placements_source_team_id_group_id_fkey';
            columns: ['source_team_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'odd_player_placements_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      player_claim_attempts: {
        Row: {
          attempted_at: string;
          attempted_name: string;
          group_id: string;
          id: number;
          succeeded: boolean;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string;
          attempted_name: string;
          group_id: string;
          id?: number;
          succeeded: boolean;
          user_id?: string | null;
        };
        Update: {
          attempted_at?: string;
          attempted_name?: string;
          group_id?: string;
          id?: number;
          succeeded?: boolean;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'player_claim_attempts_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'player_claim_attempts_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      players: {
        Row: {
          active: boolean;
          birth_date: string;
          birth_date_changed: boolean;
          created_at: string;
          gender: string;
          group_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          birth_date: string;
          birth_date_changed?: boolean;
          created_at?: string;
          gender: string;
          group_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          birth_date?: string;
          birth_date_changed?: boolean;
          created_at?: string;
          gender?: string;
          group_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'players_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'players_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      session_players: {
        Row: {
          group_id: string;
          player_id: string;
          session_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          player_id: string;
          session_id: string;
        };
        Update: {
          group_id?: string;
          player_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_players_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'session_players_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'session_players_session_id_group_id_fkey';
            columns: ['session_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      sessions: {
        Row: {
          created_at: string;
          date: string;
          group_id: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date: string;
          group_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          group_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      tiebreak_decisions: {
        Row: {
          decided_at: string;
          decided_by: string | null;
          group_id: string;
          kind: Database['public']['Enums']['tiebreak_kind'];
          team_ids: string[];
          tournament_id: string;
          winner_team_id: string;
        };
        ComputedFields: never;
        Insert: {
          decided_at?: string;
          decided_by?: string | null;
          group_id: string;
          kind: Database['public']['Enums']['tiebreak_kind'];
          team_ids?: string[];
          tournament_id: string;
          winner_team_id: string;
        };
        Update: {
          decided_at?: string;
          decided_by?: string | null;
          group_id?: string;
          kind?: Database['public']['Enums']['tiebreak_kind'];
          team_ids?: string[];
          tournament_id?: string;
          winner_team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tiebreak_decisions_decided_by_group_id_fkey';
            columns: ['decided_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'tiebreak_decisions_decided_by_group_id_fkey';
            columns: ['decided_by', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tiebreak_decisions_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tiebreak_decisions_winner_team_id_group_id_fkey';
            columns: ['winner_team_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      tournament_priority_entries: {
        Row: {
          group_id: string;
          player_id: string;
          reason: Database['public']['Enums']['priority_reason'];
          tournament_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          player_id: string;
          reason: Database['public']['Enums']['priority_reason'];
          tournament_id: string;
        };
        Update: {
          group_id?: string;
          player_id?: string;
          reason?: Database['public']['Enums']['priority_reason'];
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_priority_entries_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_priority_entries_player_id_group_id_fkey';
            columns: ['player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_priority_entries_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      tournament_standings: {
        Row: {
          group_id: string;
          position: number;
          team_id: string;
          tournament_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          position: number;
          team_id: string;
          tournament_id: string;
        };
        Update: {
          group_id?: string;
          position?: number;
          team_id?: string;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_standings_team_id_group_id_fkey';
            columns: ['team_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournament_teams';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_standings_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      tournament_teams: {
        Row: {
          eliminated: boolean;
          eliminated_directly: boolean;
          group_id: string;
          id: string;
          original_player1_id: string | null;
          original_player2_id: string | null;
          player1_id: string;
          player2_id: string;
          position: number;
          synthetic: boolean;
          tournament_id: string;
        };
        ComputedFields: never;
        Insert: {
          eliminated?: boolean;
          eliminated_directly?: boolean;
          group_id: string;
          id?: string;
          original_player1_id?: string | null;
          original_player2_id?: string | null;
          player1_id: string;
          player2_id: string;
          position: number;
          synthetic?: boolean;
          tournament_id: string;
        };
        Update: {
          eliminated?: boolean;
          eliminated_directly?: boolean;
          group_id?: string;
          id?: string;
          original_player1_id?: string | null;
          original_player2_id?: string | null;
          player1_id?: string;
          player2_id?: string;
          position?: number;
          synthetic?: boolean;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_teams_player1_id_group_id_fkey';
            columns: ['player1_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_teams_player1_id_group_id_fkey';
            columns: ['player1_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_teams_player2_id_group_id_fkey';
            columns: ['player2_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_teams_player2_id_group_id_fkey';
            columns: ['player2_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournament_teams_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      tournaments: {
        Row: {
          created_at: string;
          draw_id: string;
          format_id: string;
          group_id: string;
          id: string;
          name: string;
          odd_player_loser_priority_enabled: boolean;
          odd_player_placement_enabled: boolean;
          point_limit: number;
          session_id: string;
          status: Database['public']['Enums']['tournament_status'];
          third_place_enabled: boolean;
          updated_at: string;
          waiting_player_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          draw_id: string;
          format_id: string;
          group_id: string;
          id?: string;
          name: string;
          odd_player_loser_priority_enabled?: boolean;
          odd_player_placement_enabled?: boolean;
          point_limit: number;
          session_id: string;
          status?: Database['public']['Enums']['tournament_status'];
          third_place_enabled?: boolean;
          updated_at?: string;
          waiting_player_id?: string | null;
        };
        Update: {
          created_at?: string;
          draw_id?: string;
          format_id?: string;
          group_id?: string;
          id?: string;
          name?: string;
          odd_player_loser_priority_enabled?: boolean;
          odd_player_placement_enabled?: boolean;
          point_limit?: number;
          session_id?: string;
          status?: Database['public']['Enums']['tournament_status'];
          third_place_enabled?: boolean;
          updated_at?: string;
          waiting_player_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tournaments_draw_id_group_id_fkey';
            columns: ['draw_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'draws';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournaments_session_id_group_id_fkey';
            columns: ['session_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'tournaments_waiting_player_id_group_id_fkey';
            columns: ['waiting_player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id', 'group_id'];
          },
          {
            foreignKeyName: 'tournaments_waiting_player_id_group_id_fkey';
            columns: ['waiting_player_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
    };
    Views: {
      my_groups: {
        Row: {
          id: string;
          is_owner: boolean | null;
          last_session_date: string | null;
          name: string;
          player_count: number | null;
          player_id: string | null;
          role: Database['public']['Enums']['group_role'];
          today_session_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'group_members_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'player_stats';
            referencedColumns: ['player_id'];
          },
          {
            foreignKeyName: 'group_members_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      player_match_results: {
        Row: {
          group_id: string;
          match_id: string;
          played_at: string;
          player_id: string | null;
          session_id: string;
          team_id: string;
          tournament_id: string;
          won: boolean | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'matches_session_id_group_id_fkey';
            columns: ['session_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'group_id'];
          },
          {
            foreignKeyName: 'matches_tournament_id_group_id_fkey';
            columns: ['tournament_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      player_stats: {
        Row: {
          games_played: number | null;
          group_id: string;
          losses: number | null;
          name: string;
          player_id: string;
          times_waited: number | null;
          win_percentage: number | null;
          wins: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'players_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'players_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'my_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      team_stats: {
        Row: {
          games_played: number | null;
          group_id: string;
          losses: number | null;
          player1_id: string | null;
          player2_id: string | null;
          win_percentage: number | null;
          wins: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      accept_invite: {
        Args: {
          inv: Omit<
            Database['public']['Tables']['invites']['Row'],
            Database['public']['Tables']['invites']['ComputedFields']
          >;
        };
        Returns: {
          group_id: string;
          group_name: string;
        }[];
      };
      add_player: {
        Args: { p_gender: string; p_group_id: string; p_name: string };
        Returns: string;
      };
      claim_player: {
        Args: {
          p_birth_date: string;
          p_group_id: string;
          p_name: string;
          p_new_birth_date?: string;
        };
        Returns: Database['public']['CompositeTypes']['claim_result'];
        SetofOptions: {
          from: '*';
          to: 'claim_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_group: {
        Args: {
          p_group_name: string;
          p_initial_birth_date: string;
          p_owner_birth_date: string;
          p_owner_gender: string;
          p_owner_name: string;
        };
        Returns: {
          group_id: string;
          invite_code: string;
          invite_token: string;
          player_id: string;
        }[];
      };
      enter_group: { Args: { p_group_id: string }; Returns: undefined };
      is_group_member: { Args: { p_group_id: string }; Returns: boolean };
      is_group_owner: { Args: { p_group_id: string }; Returns: boolean };
      is_group_player: { Args: { p_group_id: string }; Returns: boolean };
      my_player_id: { Args: { p_group_id: string }; Returns: string };
      new_invite_code: { Args: Record<PropertyKey, never>; Returns: string };
      redeem_invite: {
        Args: { p_token: string };
        Returns: {
          group_id: string;
          group_name: string;
        }[];
      };
      redeem_invite_code: {
        Args: { p_code: string };
        Returns: {
          group_id: string;
          group_name: string;
        }[];
      };
      reset_player_birth_date: { Args: { p_player_id: string }; Returns: undefined };
      transfer_ownership: { Args: { p_group_id: string; p_player_id: string }; Returns: undefined };
      unclaimed_players: {
        Args: { p_group_id: string };
        Returns: {
          gender: string;
          id: string;
          name: string;
        }[];
      };
    };
    Enums: {
      group_role: 'player' | 'viewer';
      match_phase: 'round-1' | 'semifinal' | 'semifinal-bye' | 'final' | 'third-place';
      priority_reason: 'direct-elimination' | 'coin-flip-loss' | 'waiting-player-not-used';
      tiebreak_kind: 'losers' | 'winners';
      tournament_status: 'in-progress' | 'completed';
    };
    CompositeTypes: {
      claim_result: {
        ok: boolean | null;
        reason: string | null;
        player_id: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      group_role: ['player', 'viewer'],
      match_phase: ['round-1', 'semifinal', 'semifinal-bye', 'final', 'third-place'],
      priority_reason: ['direct-elimination', 'coin-flip-loss', 'waiting-player-not-used'],
      tiebreak_kind: ['losers', 'winners'],
      tournament_status: ['in-progress', 'completed'],
    },
  },
} as const;
