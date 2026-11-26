
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "analytics": {
          Tables: {
            "ai_query_logs": {
                  Row: {
                    "answer": string | null,"created_at": string,"id": string,"model": string | null,"organization_id": string,"question": string,"tool_calls": NonNullable<Json>,"unverified_numbers": NonNullable<Json>,"user_id": string | null,"website_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"organization_id": string,"question": string,"tool_calls"?: NonNullable<Json>,"unverified_numbers"?: NonNullable<Json>,"user_id"?: string | null,"website_ids": (string)[]
                  }
                  Update: {
                    "answer"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"organization_id"?: string,"question"?: string,"tool_calls"?: NonNullable<Json>,"unverified_numbers"?: NonNullable<Json>,"user_id"?: string | null,"website_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_query_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_daily": {
                  Row: {
                    "bounces": number,"computed_at": string,"conversion_value_cents": number,"conversions": number,"day": string,"dimension": string,"dimension_value": string,"engagement_ms": number,"entries": number,"events": number,"exits": number,"new_visitors": number | null,"pageviews": number,"returning_visitors": number | null,"sessions": number,"visitors": number,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bounces"?: number,"computed_at"?: string,"conversion_value_cents"?: number,"conversions"?: number,"day": string,"dimension": string,"dimension_value"?: string,"engagement_ms"?: number,"entries"?: number,"events"?: number,"exits"?: number,"new_visitors"?: number | null,"pageviews"?: number,"returning_visitors"?: number | null,"sessions"?: number,"visitors"?: number,"website_id": string
                  }
                  Update: {
                    "bounces"?: number,"computed_at"?: string,"conversion_value_cents"?: number,"conversions"?: number,"day"?: string,"dimension"?: string,"dimension_value"?: string,"engagement_ms"?: number,"entries"?: number,"events"?: number,"exits"?: number,"new_visitors"?: number | null,"pageviews"?: number,"returning_visitors"?: number | null,"sessions"?: number,"visitors"?: number,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_daily_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"click_id_type": string | null,"country_code": string | null,"device_type": string | null,"engagement_ms": number | null,"event_name": string,"event_type": string,"hostname": string,"id": string,"occurred_at": string,"organization_id": string,"os": string | null,"pathname": string,"props": NonNullable<Json>,"received_at": string,"referrer_host": string | null,"referrer_path": string | null,"region_code": string | null,"scroll_depth": number | null,"session_id": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name": string,"event_type": string,"hostname": string,"id"?: string,"occurred_at": string,"organization_id": string,"os"?: string | null,"pathname": string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name"?: string,"event_type"?: string,"hostname"?: string,"id"?: string,"occurred_at"?: string,"organization_id"?: string,"os"?: string | null,"pathname"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events_2026_11": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"click_id_type": string | null,"country_code": string | null,"device_type": string | null,"engagement_ms": number | null,"event_name": string,"event_type": string,"hostname": string,"id": string,"occurred_at": string,"organization_id": string,"os": string | null,"pathname": string,"props": NonNullable<Json>,"received_at": string,"referrer_host": string | null,"referrer_path": string | null,"region_code": string | null,"scroll_depth": number | null,"session_id": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name": string,"event_type": string,"hostname": string,"id"?: string,"occurred_at": string,"organization_id": string,"os"?: string | null,"pathname": string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name"?: string,"event_type"?: string,"hostname"?: string,"id"?: string,"occurred_at"?: string,"organization_id"?: string,"os"?: string | null,"pathname"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events_2026_12": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"click_id_type": string | null,"country_code": string | null,"device_type": string | null,"engagement_ms": number | null,"event_name": string,"event_type": string,"hostname": string,"id": string,"occurred_at": string,"organization_id": string,"os": string | null,"pathname": string,"props": NonNullable<Json>,"received_at": string,"referrer_host": string | null,"referrer_path": string | null,"region_code": string | null,"scroll_depth": number | null,"session_id": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name": string,"event_type": string,"hostname": string,"id"?: string,"occurred_at": string,"organization_id": string,"os"?: string | null,"pathname": string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name"?: string,"event_type"?: string,"hostname"?: string,"id"?: string,"occurred_at"?: string,"organization_id"?: string,"os"?: string | null,"pathname"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events_2027_01": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"click_id_type": string | null,"country_code": string | null,"device_type": string | null,"engagement_ms": number | null,"event_name": string,"event_type": string,"hostname": string,"id": string,"occurred_at": string,"organization_id": string,"os": string | null,"pathname": string,"props": NonNullable<Json>,"received_at": string,"referrer_host": string | null,"referrer_path": string | null,"region_code": string | null,"scroll_depth": number | null,"session_id": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name": string,"event_type": string,"hostname": string,"id"?: string,"occurred_at": string,"organization_id": string,"os"?: string | null,"pathname": string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name"?: string,"event_type"?: string,"hostname"?: string,"id"?: string,"occurred_at"?: string,"organization_id"?: string,"os"?: string | null,"pathname"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events_2027_02": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"click_id_type": string | null,"country_code": string | null,"device_type": string | null,"engagement_ms": number | null,"event_name": string,"event_type": string,"hostname": string,"id": string,"occurred_at": string,"organization_id": string,"os": string | null,"pathname": string,"props": NonNullable<Json>,"received_at": string,"referrer_host": string | null,"referrer_path": string | null,"region_code": string | null,"scroll_depth": number | null,"session_id": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name": string,"event_type": string,"hostname": string,"id"?: string,"occurred_at": string,"organization_id": string,"os"?: string | null,"pathname": string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"click_id_type"?: string | null,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number | null,"event_name"?: string,"event_type"?: string,"hostname"?: string,"id"?: string,"occurred_at"?: string,"organization_id"?: string,"os"?: string | null,"pathname"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"referrer_host"?: string | null,"referrer_path"?: string | null,"region_code"?: string | null,"scroll_depth"?: number | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_hourly": {
                  Row: {
                    "bounces": number,"computed_at": string,"conversions": number,"engagement_ms": number,"events": number,"hour_start": string,"pageviews": number,"sessions": number,"visitors": number,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bounces"?: number,"computed_at"?: string,"conversions"?: number,"engagement_ms"?: number,"events"?: number,"hour_start": string,"pageviews"?: number,"sessions"?: number,"visitors"?: number,"website_id": string
                  }
                  Update: {
                    "bounces"?: number,"computed_at"?: string,"conversions"?: number,"engagement_ms"?: number,"events"?: number,"hour_start"?: string,"pageviews"?: number,"sessions"?: number,"visitors"?: number,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_hourly_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_integrations": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"last_error": string | null,"last_sync_at": string | null,"organization_id": string,"provider": string,"status": string,"updated_at": string,"vault_secret_id": string | null,"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"organization_id": string,"provider": string,"status"?: string,"updated_at"?: string,"vault_secret_id"?: string | null,"website_id"?: string | null
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"organization_id"?: string,"provider"?: string,"status"?: string,"updated_at"?: string,"vault_secret_id"?: string | null,"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_integrations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_integrations_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_sessions": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"closed_at": string | null,"conversion_count": number,"country_code": string | null,"device_type": string | null,"engagement_ms": number,"entry_path": string,"events": number,"exit_path": string | null,"id": string,"is_bounce": boolean | null,"is_new_visitor": boolean | null,"last_activity_at": string,"organization_id": string,"os": string | null,"pageviews": number,"referrer_host": string | null,"region_code": string | null,"started_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path": string,"events"?: number,"exit_path"?: string | null,"id": string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at": string,"organization_id": string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path"?: string,"events"?: number,"exit_path"?: string | null,"id"?: string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at"?: string,"organization_id"?: string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_sessions_2026_11": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"closed_at": string | null,"conversion_count": number,"country_code": string | null,"device_type": string | null,"engagement_ms": number,"entry_path": string,"events": number,"exit_path": string | null,"id": string,"is_bounce": boolean | null,"is_new_visitor": boolean | null,"last_activity_at": string,"organization_id": string,"os": string | null,"pageviews": number,"referrer_host": string | null,"region_code": string | null,"started_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path": string,"events"?: number,"exit_path"?: string | null,"id": string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at": string,"organization_id": string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path"?: string,"events"?: number,"exit_path"?: string | null,"id"?: string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at"?: string,"organization_id"?: string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_sessions_2026_12": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"closed_at": string | null,"conversion_count": number,"country_code": string | null,"device_type": string | null,"engagement_ms": number,"entry_path": string,"events": number,"exit_path": string | null,"id": string,"is_bounce": boolean | null,"is_new_visitor": boolean | null,"last_activity_at": string,"organization_id": string,"os": string | null,"pageviews": number,"referrer_host": string | null,"region_code": string | null,"started_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path": string,"events"?: number,"exit_path"?: string | null,"id": string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at": string,"organization_id": string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path"?: string,"events"?: number,"exit_path"?: string | null,"id"?: string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at"?: string,"organization_id"?: string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_sessions_2027_01": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"closed_at": string | null,"conversion_count": number,"country_code": string | null,"device_type": string | null,"engagement_ms": number,"entry_path": string,"events": number,"exit_path": string | null,"id": string,"is_bounce": boolean | null,"is_new_visitor": boolean | null,"last_activity_at": string,"organization_id": string,"os": string | null,"pageviews": number,"referrer_host": string | null,"region_code": string | null,"started_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path": string,"events"?: number,"exit_path"?: string | null,"id": string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at": string,"organization_id": string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path"?: string,"events"?: number,"exit_path"?: string | null,"id"?: string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at"?: string,"organization_id"?: string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_sessions_2027_02": {
                  Row: {
                    "browser": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"],"city": string | null,"closed_at": string | null,"conversion_count": number,"country_code": string | null,"device_type": string | null,"engagement_ms": number,"entry_path": string,"events": number,"exit_path": string | null,"id": string,"is_bounce": boolean | null,"is_new_visitor": boolean | null,"last_activity_at": string,"organization_id": string,"os": string | null,"pageviews": number,"referrer_host": string | null,"region_code": string | null,"started_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path": string,"events"?: number,"exit_path"?: string | null,"id": string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at": string,"organization_id": string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at": string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash": string,"visitor_id_type": Database["analytics"]['Enums']["visitor_id_type"],"website_id": string
                  }
                  Update: {
                    "browser"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"],"city"?: string | null,"closed_at"?: string | null,"conversion_count"?: number,"country_code"?: string | null,"device_type"?: string | null,"engagement_ms"?: number,"entry_path"?: string,"events"?: number,"exit_path"?: string | null,"id"?: string,"is_bounce"?: boolean | null,"is_new_visitor"?: boolean | null,"last_activity_at"?: string,"organization_id"?: string,"os"?: string | null,"pageviews"?: number,"referrer_host"?: string | null,"region_code"?: string | null,"started_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_hash"?: string,"visitor_id_type"?: Database["analytics"]['Enums']["visitor_id_type"],"website_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"name": string,"organization_id": string,"revoked_at": string | null,"scopes": (string)[],"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"name": string,"organization_id": string,"revoked_at"?: string | null,"scopes"?: (string)[],"website_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"name"?: string,"organization_id"?: string,"revoked_at"?: string | null,"scopes"?: (string)[],"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "api_keys_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": string,"created_at": string,"id": number,"metadata": NonNullable<Json>,"organization_id": string | null,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": string,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: string,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_costs": {
                  Row: {
                    "campaign_id": string,"cost_cents": number,"day": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"cost_cents": number,"day": string,"source"?: string
                  }
                  Update: {
                    "campaign_id"?: string,"cost_cents"?: number,"day"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_costs_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "budget_cents": number | null,"created_at": string,"created_by": string | null,"currency": string,"ends_on": string | null,"id": string,"match_utm_campaign": string,"match_utm_medium": string | null,"match_utm_source": string | null,"name": string,"notes": string | null,"organization_id": string,"starts_on": string | null,"status": string,"updated_at": string,"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_cents"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"ends_on"?: string | null,"id"?: string,"match_utm_campaign": string,"match_utm_medium"?: string | null,"match_utm_source"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"starts_on"?: string | null,"status"?: string,"updated_at"?: string,"website_id"?: string | null
                  }
                  Update: {
                    "budget_cents"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"ends_on"?: string | null,"id"?: string,"match_utm_campaign"?: string,"match_utm_medium"?: string | null,"match_utm_source"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"starts_on"?: string | null,"status"?: string,"updated_at"?: string,"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_records": {
                  Row: {
                    "categories": NonNullable<Json>,"consent_id": string,"decision": string,"id": string,"policy_version": string,"recorded_at": string,"source": string,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: NonNullable<Json>,"consent_id": string,"decision": string,"id"?: string,"policy_version": string,"recorded_at"?: string,"source": string,"website_id": string
                  }
                  Update: {
                    "categories"?: NonNullable<Json>,"consent_id"?: string,"decision"?: string,"id"?: string,"policy_version"?: string,"recorded_at"?: string,"source"?: string,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"conversion_events": {
                  Row: {
                    "channel": Database["analytics"]['Enums']["traffic_channel"],"event_id": string,"goal_id": string,"id": string,"landing_path": string | null,"occurred_at": string,"organization_id": string,"page_path": string | null,"referrer_host": string | null,"session_id": string,"utm_campaign": string | null,"utm_medium": string | null,"utm_source": string | null,"value_cents": number | null,"visitor_hash": string,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["analytics"]['Enums']["traffic_channel"],"event_id": string,"goal_id": string,"id"?: string,"landing_path"?: string | null,"occurred_at": string,"organization_id": string,"page_path"?: string | null,"referrer_host"?: string | null,"session_id": string,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"value_cents"?: number | null,"visitor_hash": string,"website_id": string
                  }
                  Update: {
                    "channel"?: Database["analytics"]['Enums']["traffic_channel"],"event_id"?: string,"goal_id"?: string,"id"?: string,"landing_path"?: string | null,"occurred_at"?: string,"organization_id"?: string,"page_path"?: string | null,"referrer_host"?: string | null,"session_id"?: string,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"value_cents"?: number | null,"visitor_hash"?: string,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversion_events_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "conversion_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversion_events_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"conversion_goals": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"goal_type": string,"id": string,"is_active": boolean,"match_event_name": string | null,"match_operator": Database["analytics"]['Enums']["match_operator"],"match_path": string | null,"name": string,"once_per_session": boolean,"property_filters": NonNullable<Json>,"template_key": string | null,"updated_at": string,"value_cents": number | null,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"goal_type": string,"id"?: string,"is_active"?: boolean,"match_event_name"?: string | null,"match_operator"?: Database["analytics"]['Enums']["match_operator"],"match_path"?: string | null,"name": string,"once_per_session"?: boolean,"property_filters"?: NonNullable<Json>,"template_key"?: string | null,"updated_at"?: string,"value_cents"?: number | null,"website_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"goal_type"?: string,"id"?: string,"is_active"?: boolean,"match_event_name"?: string | null,"match_operator"?: Database["analytics"]['Enums']["match_operator"],"match_path"?: string | null,"name"?: string,"once_per_session"?: boolean,"property_filters"?: NonNullable<Json>,"template_key"?: string | null,"updated_at"?: string,"value_cents"?: number | null,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversion_goals_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"custom_events": {
                  Row: {
                    "allowed_properties": (string)[] | null,"description": string | null,"display_name": string | null,"event_name": string,"first_seen_at": string,"is_blocked": boolean,"last_seen_at": string,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_properties"?: (string)[] | null,"description"?: string | null,"display_name"?: string | null,"event_name": string,"first_seen_at"?: string,"is_blocked"?: boolean,"last_seen_at"?: string,"website_id": string
                  }
                  Update: {
                    "allowed_properties"?: (string)[] | null,"description"?: string | null,"display_name"?: string | null,"event_name"?: string,"first_seen_at"?: string,"is_blocked"?: boolean,"last_seen_at"?: string,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custom_events_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"dashboard_layouts": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"layout": NonNullable<Json>,"name": string,"organization_id": string,"updated_at": string,"user_id": string | null,"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"layout": NonNullable<Json>,"name": string,"organization_id": string,"updated_at"?: string,"user_id"?: string | null,"website_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"layout"?: NonNullable<Json>,"name"?: string,"organization_id"?: string,"updated_at"?: string,"user_id"?: string | null,"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dashboard_layouts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dashboard_layouts_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"data_deletion_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"organization_id": string,"params": NonNullable<Json>,"requested_by": string | null,"scope": string,"status": string,"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"organization_id": string,"params"?: NonNullable<Json>,"requested_by"?: string | null,"scope": string,"status"?: string,"website_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"organization_id"?: string,"params"?: NonNullable<Json>,"requested_by"?: string | null,"scope"?: string,"status"?: string,"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_deletion_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_deletion_requests_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"funnel_definitions": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"updated_at": string,"website_id": string,"window_seconds": number | null,"window_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"website_id": string,"window_seconds"?: number | null,"window_type"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"website_id"?: string,"window_seconds"?: number | null,"window_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funnel_definitions_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"funnel_steps": {
                  Row: {
                    "event_name": string | null,"funnel_id": string,"goal_id": string | null,"id": string,"match_operator": Database["analytics"]['Enums']["match_operator"],"match_path": string | null,"name": string,"position": number,"property_filters": NonNullable<Json>,"step_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_name"?: string | null,"funnel_id": string,"goal_id"?: string | null,"id"?: string,"match_operator"?: Database["analytics"]['Enums']["match_operator"],"match_path"?: string | null,"name": string,"position": number,"property_filters"?: NonNullable<Json>,"step_type": string
                  }
                  Update: {
                    "event_name"?: string | null,"funnel_id"?: string,"goal_id"?: string | null,"id"?: string,"match_operator"?: Database["analytics"]['Enums']["match_operator"],"match_path"?: string | null,"name"?: string,"position"?: number,"property_filters"?: NonNullable<Json>,"step_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funnel_steps_funnel_id_fkey"
      columns: ["funnel_id"]
isOneToOne: false
      referencedRelation: "funnel_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "funnel_steps_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "conversion_goals"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_attributions": {
                  Row: {
                    "appointment_at": string | null,"attribution_model": string,"became_customer_at": string | null,"channel": Database["analytics"]['Enums']["traffic_channel"] | null,"conversion_path": string | null,"crm_lead_id": string,"crm_status": string | null,"crm_status_changed_at": string | null,"deal_value_cents": number | null,"goal_id": string | null,"id": string,"landing_path": string | null,"lead_created_at": string,"organization_id": string,"referrer_host": string | null,"session_id": string | null,"synced_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"website_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_at"?: string | null,"attribution_model"?: string,"became_customer_at"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"] | null,"conversion_path"?: string | null,"crm_lead_id": string,"crm_status"?: string | null,"crm_status_changed_at"?: string | null,"deal_value_cents"?: number | null,"goal_id"?: string | null,"id"?: string,"landing_path"?: string | null,"lead_created_at": string,"organization_id": string,"referrer_host"?: string | null,"session_id"?: string | null,"synced_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"website_id"?: string | null
                  }
                  Update: {
                    "appointment_at"?: string | null,"attribution_model"?: string,"became_customer_at"?: string | null,"channel"?: Database["analytics"]['Enums']["traffic_channel"] | null,"conversion_path"?: string | null,"crm_lead_id"?: string,"crm_status"?: string | null,"crm_status_changed_at"?: string | null,"deal_value_cents"?: number | null,"goal_id"?: string | null,"id"?: string,"landing_path"?: string | null,"lead_created_at"?: string,"organization_id"?: string,"referrer_host"?: string | null,"session_id"?: string | null,"synced_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"website_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_attributions_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "conversion_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_attributions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_attributions_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_branding": {
                  Row: {
                    "display_name": string | null,"email_sender_name": string | null,"hide_nova_branding": boolean,"logo_storage_path": string | null,"organization_id": string,"primary_color": string | null,"report_footer": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name"?: string | null,"email_sender_name"?: string | null,"hide_nova_branding"?: boolean,"logo_storage_path"?: string | null,"organization_id": string,"primary_color"?: string | null,"report_footer"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "display_name"?: string | null,"email_sender_name"?: string | null,"hide_nova_branding"?: boolean,"logo_storage_path"?: string | null,"organization_id"?: string,"primary_color"?: string | null,"report_footer"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_branding_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"organization_id": string,"role": Database["analytics"]['Enums']["member_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"role"?: Database["analytics"]['Enums']["member_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"role"?: Database["analytics"]['Enums']["member_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_member_websites": {
                  Row: {
                    "member_id": string,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "member_id": string,"website_id": string
                  }
                  Update: {
                    "member_id"?: string,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_member_websites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_member_websites_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"organization_id": string,"role": Database["analytics"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"role"?: Database["analytics"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"role"?: Database["analytics"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "ai_enabled": boolean,"created_at": string,"deleted_at": string | null,"id": string,"is_demo": boolean,"name": string,"plan": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_enabled"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"plan"?: string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_enabled"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"plan"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"report_definitions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"formats": (string)[],"id": string,"is_active": boolean,"name": string,"next_run_at": string | null,"organization_id": string,"period": string,"recipients": (string)[],"schedule_cron": string | null,"template": NonNullable<Json>,"timezone": string,"updated_at": string,"website_ids": (string)[],"white_label": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"formats"?: (string)[],"id"?: string,"is_active"?: boolean,"name": string,"next_run_at"?: string | null,"organization_id": string,"period": string,"recipients"?: (string)[],"schedule_cron"?: string | null,"template": NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"website_ids": (string)[],"white_label"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"formats"?: (string)[],"id"?: string,"is_active"?: boolean,"name"?: string,"next_run_at"?: string | null,"organization_id"?: string,"period"?: string,"recipients"?: (string)[],"schedule_cron"?: string | null,"template"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"website_ids"?: (string)[],"white_label"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_definitions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"report_runs": {
                  Row: {
                    "created_at": string,"error": string | null,"files": NonNullable<Json>,"finished_at": string | null,"id": string,"period_end": string,"period_start": string,"report_id": string,"sent_count": number,"started_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"files"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"period_end": string,"period_start": string,"report_id": string,"sent_count"?: number,"started_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"files"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"period_end"?: string,"period_start"?: string,"report_id"?: string,"sent_count"?: number,"started_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_runs_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_definitions"
      referencedColumns: ["id"]
    }
                  ]
                },"tracking_settings": {
                  Row: {
                    "aggregate_retention_days": number | null,"allowed_origins": (string)[],"excluded_paths": (string)[],"geo_granularity": string,"heartbeat_seconds": number,"query_param_allowlist": (string)[],"raw_retention_days": number,"respect_gpc_dnt": boolean,"session_timeout_minutes": number,"spa_tracking": boolean,"track_contact_clicks": boolean,"track_downloads": boolean,"track_form_interactions": boolean,"track_outbound_clicks": boolean,"track_scroll_depth": boolean,"tracking_mode": Database["analytics"]['Enums']["tracking_mode"],"updated_at": string,"updated_by": string | null,"website_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aggregate_retention_days"?: number | null,"allowed_origins"?: (string)[],"excluded_paths"?: (string)[],"geo_granularity"?: string,"heartbeat_seconds"?: number,"query_param_allowlist"?: (string)[],"raw_retention_days"?: number,"respect_gpc_dnt"?: boolean,"session_timeout_minutes"?: number,"spa_tracking"?: boolean,"track_contact_clicks"?: boolean,"track_downloads"?: boolean,"track_form_interactions"?: boolean,"track_outbound_clicks"?: boolean,"track_scroll_depth"?: boolean,"tracking_mode"?: Database["analytics"]['Enums']["tracking_mode"],"updated_at"?: string,"updated_by"?: string | null,"website_id": string
                  }
                  Update: {
                    "aggregate_retention_days"?: number | null,"allowed_origins"?: (string)[],"excluded_paths"?: (string)[],"geo_granularity"?: string,"heartbeat_seconds"?: number,"query_param_allowlist"?: (string)[],"raw_retention_days"?: number,"respect_gpc_dnt"?: boolean,"session_timeout_minutes"?: number,"spa_tracking"?: boolean,"track_contact_clicks"?: boolean,"track_downloads"?: boolean,"track_form_interactions"?: boolean,"track_outbound_clicks"?: boolean,"track_scroll_depth"?: boolean,"tracking_mode"?: Database["analytics"]['Enums']["tracking_mode"],"updated_at"?: string,"updated_by"?: string | null,"website_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracking_settings_website_id_fkey"
      columns: ["website_id"]
isOneToOne: true
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
                  ]
                },"websites": {
                  Row: {
                    "additional_domains": (string)[],"created_at": string,"currency": string,"deleted_at": string | null,"domain": string,"id": string,"is_demo": boolean,"name": string,"organization_id": string,"public_site_id": string,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_domains"?: (string)[],"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"domain": string,"id"?: string,"is_demo"?: boolean,"name": string,"organization_id": string,"public_site_id"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "additional_domains"?: (string)[],"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"domain"?: string,"id"?: string,"is_demo"?: boolean,"name"?: string,"organization_id"?: string,"public_site_id"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "websites_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"accessible_website_ids":
{ Args: { "p_min": Database["analytics"]['Enums']["member_role"] }; Returns: string[]
                           },
"create_invitation":
{ Args: { "p_email": string,"p_org": string,"p_role"?: Database["analytics"]['Enums']["member_role"] }; Returns: string
                           },
"create_organization":
{ Args: { "p_name": string,"p_slug": string }; Returns: string
                           },
"ensure_partitions":
{ Args: { "p_months_ahead"?: number }; Returns: undefined
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expires_at": string,"organization_name": string,"role": Database["analytics"]['Enums']["member_role"],"status": string
            }[]
                           },
"has_org_role":
{ Args: { "p_min": Database["analytics"]['Enums']["member_role"],"p_org": string }; Returns: boolean
                           },
"list_members":
{ Args: { "p_org": string }; Returns: {
              "created_at": string,"email": string,"is_self": boolean,"member_id": string,"role": Database["analytics"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"purge_expired_raw_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "match_operator": "equals"|"starts_with"|"contains"|"regex","member_role": "viewer"|"analyst"|"admin"|"owner","tracking_mode": "cookieless"|"consent_upgrade"|"consent_required","traffic_channel": "organic_search"|"paid_search"|"direct"|"referral"|"social"|"email"|"display"|"unassigned","visitor_id_type": "daily_hash"|"consented_id"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "analytics">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "analytics": {
          Enums: {
            "match_operator": ["equals", "starts_with", "contains", "regex"],"member_role": ["viewer", "analyst", "admin", "owner"],"tracking_mode": ["cookieless", "consent_upgrade", "consent_required"],"traffic_channel": ["organic_search", "paid_search", "direct", "referral", "social", "email", "display", "unassigned"],"visitor_id_type": ["daily_hash", "consented_id"]
          }
        }
} as const
