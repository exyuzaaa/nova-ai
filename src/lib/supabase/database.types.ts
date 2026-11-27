
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
      foreignKeyName: "api_keys_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
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
                },"daily_salts": {
                  Row: {
                    "created_at": string,"day": string,"salt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"salt": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"salt"?: string
                  }
                  Relationships: [
                    
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
      foreignKeyName: "lead_attributions_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
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
      foreignKeyName: "organization_member_websites_website_id_fkey"
      columns: ["website_id"]
isOneToOne: false
      referencedRelation: "websites"
      referencedColumns: ["id"]
    }
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
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accessible_website_ids":
{ Args: { "p_min": Database["core"]['Enums']["member_role"] }; Returns: string[]
                           },
"assert_site_access":
{ Args: { "p_website": string }; Returns: string
                           },
"ensure_partitions":
{ Args: { "p_months_ahead"?: number }; Returns: undefined
                           },
"has_org_role":
{ Args: { "p_min": Database["core"]['Enums']["member_role"],"p_org": string }; Returns: boolean
                           },
"purge_daily_salts":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"purge_expired_raw_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"site_breakdown":
{ Args: { "p_dimension": string,"p_end": string,"p_limit"?: number,"p_start": string,"p_website": string }; Returns: {
              "key": string,"pageviews": number,"visitors": number
            }[]
                           },
"site_daily_stats":
{ Args: { "p_end": string,"p_start": string,"p_website": string }; Returns: {
              "bounces": number,"day": string,"engagement_ms": number,"pageviews": number,"sessions": number,"visitors": number
            }[]
                           },
"site_has_data":
{ Args: { "p_website": string }; Returns: boolean
                           },
"site_realtime":
{ Args: { "p_website": string }; Returns: Json
                           },
"site_session_distribution":
{ Args: { "p_end": string,"p_start": string,"p_website": string }; Returns: {
              "bucket": string,"kind": string,"sessions": number
            }[]
                           },
"tracking_status":
{ Args: { "p_website": string }; Returns: {
              "events_24h": number,"last_event_at": string,"last_path": string,"pageviews_24h": number,"sessions_24h": number
            }[]
                           }
          }
          Enums: {
            "match_operator": "equals"|"starts_with"|"contains"|"regex","tracking_mode": "cookieless"|"consent_upgrade"|"consent_required","traffic_channel": "organic_search"|"paid_search"|"direct"|"referral"|"social"|"email"|"display"|"unassigned","visitor_id_type": "daily_hash"|"consented_id"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"core": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": string,"created_at": string,"id": number,"metadata": NonNullable<Json>,"target_id": string | null,"target_type": string | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": string,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: string,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"lead_member_id": string | null,"name": string,"parent_id": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"lead_member_id"?: string | null,"name": string,"parent_id"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"lead_member_id"?: string | null,"name"?: string,"parent_id"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_tenant_id_lead_member_id_fkey"
      columns: ["tenant_id","lead_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "departments_tenant_id_parent_id_fkey"
      columns: ["tenant_id","parent_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"role": Database["core"]['Enums']["member_role"],"tenant_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by"?: string | null,"role"?: Database["core"]['Enums']["member_role"],"tenant_id": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["core"]['Enums']["member_role"],"tenant_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_invitations_organization_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"member_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"member_id": string,"role_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"member_id": string,"role_id": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"member_id"?: string,"role_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_roles_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "member_roles_tenant_id_role_id_fkey"
      columns: ["tenant_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "category": string,"created_at": string,"description": string,"enabled_by_default": boolean,"is_core": boolean,"key": string,"name": string,"sort_order": number,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"description": string,"enabled_by_default"?: boolean,"is_core"?: boolean,"key": string,"name": string,"sort_order"?: number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"description"?: string,"enabled_by_default"?: boolean,"is_core"?: boolean,"key"?: string,"name"?: string,"sort_order"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notification_preferences": {
                  Row: {
                    "email": boolean,"in_app": boolean,"kind": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: boolean,"in_app"?: boolean,"kind": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "email"?: boolean,"in_app"?: boolean,"kind"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"href": string | null,"id": string,"kind": string,"metadata": NonNullable<Json>,"read_at": string | null,"tenant_id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"href"?: string | null,"id"?: string,"kind": string,"metadata"?: NonNullable<Json>,"read_at"?: string | null,"tenant_id": string,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"href"?: string | null,"id"?: string,"kind"?: string,"metadata"?: NonNullable<Json>,"read_at"?: string | null,"tenant_id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "default_role": Database["core"]['Enums']["member_role"],"description": string | null,"grantable": boolean,"is_sensitive": boolean,"key": string,"module_key": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "default_role": Database["core"]['Enums']["member_role"],"description"?: string | null,"grantable"?: boolean,"is_sensitive"?: boolean,"key": string,"module_key": string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "default_role"?: Database["core"]['Enums']["member_role"],"description"?: string | null,"grantable"?: boolean,"is_sensitive"?: boolean,"key"?: string,"module_key"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "permissions_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"permission_key": string,"role_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"permission_key": string,"role_id": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"permission_key"?: string,"role_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_tenant_id_role_id_fkey"
      columns: ["tenant_id","role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"search_index": {
                  Row: {
                    "entity_id": string,"entity_type": string,"href": string,"permission": string,"search": unknown,"subtitle": string | null,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entity_id": string,"entity_type": string,"href": string,"permission": string,"search"?: never,"subtitle"?: string | null,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "entity_id"?: string,"entity_type"?: string,"href"?: string,"permission"?: string,"search"?: never,"subtitle"?: string | null,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "search_index_permission_fkey"
      columns: ["permission"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "search_index_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"member_id": string,"team_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"member_id": string,"team_id": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"member_id"?: string,"team_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_tenant_id_member_id_fkey"
      columns: ["tenant_id","member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "team_members_tenant_id_team_id_fkey"
      columns: ["tenant_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "created_at": string,"department_id": string | null,"description": string | null,"id": string,"lead_member_id": string | null,"name": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"description"?: string | null,"id"?: string,"lead_member_id"?: string | null,"name": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"description"?: string | null,"id"?: string,"lead_member_id"?: string | null,"name"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_tenant_id_department_id_fkey"
      columns: ["tenant_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "teams_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_tenant_id_lead_member_id_fkey"
      columns: ["tenant_id","lead_member_id"]
isOneToOne: false
      referencedRelation: "tenant_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"tenant_branding": {
                  Row: {
                    "display_name": string | null,"email_sender_name": string | null,"hide_nova_branding": boolean,"logo_storage_path": string | null,"primary_color": string | null,"report_footer": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name"?: string | null,"email_sender_name"?: string | null,"hide_nova_branding"?: boolean,"logo_storage_path"?: string | null,"primary_color"?: string | null,"report_footer"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "display_name"?: string | null,"email_sender_name"?: string | null,"hide_nova_branding"?: boolean,"logo_storage_path"?: string | null,"primary_color"?: string | null,"report_footer"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_branding_organization_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_members": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"role": Database["core"]['Enums']["member_role"],"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["core"]['Enums']["member_role"],"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["core"]['Enums']["member_role"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_modules": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"enabled": boolean,"module_key": string,"source": string,"tenant_id": string,"updated_at": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"enabled"?: boolean,"module_key": string,"source"?: string,"tenant_id": string,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"enabled"?: boolean,"module_key"?: string,"source"?: string,"tenant_id"?: string,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_modules_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "tenant_modules_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "ai_enabled": boolean,"city": string | null,"company_size": string | null,"country_code": string,"created_at": string,"currency": string,"deleted_at": string | null,"email": string | null,"id": string,"industry": string | null,"is_demo": boolean,"legal_name": string | null,"locale": string,"logo_path": string | null,"name": string,"onboarding_completed_at": string | null,"phone": string | null,"plan": string,"postal_code": string | null,"slug": string,"status": string,"street": string | null,"suspended_at": string | null,"suspended_reason": string | null,"timezone": string,"updated_at": string,"vat_id": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_enabled"?: boolean,"city"?: string | null,"company_size"?: string | null,"country_code"?: string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"industry"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"locale"?: string,"logo_path"?: string | null,"name": string,"onboarding_completed_at"?: string | null,"phone"?: string | null,"plan"?: string,"postal_code"?: string | null,"slug": string,"status"?: string,"street"?: string | null,"suspended_at"?: string | null,"suspended_reason"?: string | null,"timezone"?: string,"updated_at"?: string,"vat_id"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "ai_enabled"?: boolean,"city"?: string | null,"company_size"?: string | null,"country_code"?: string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"industry"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"locale"?: string,"logo_path"?: string | null,"name"?: string,"onboarding_completed_at"?: string | null,"phone"?: string | null,"plan"?: string,"postal_code"?: string | null,"slug"?: string,"status"?: string,"street"?: string | null,"suspended_at"?: string | null,"suspended_reason"?: string | null,"timezone"?: string,"updated_at"?: string,"vat_id"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    
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
"can":
{ Args: { "p_permission": string,"p_tenant": string }; Returns: boolean
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role"?: Database["core"]['Enums']["member_role"],"p_tenant": string }; Returns: string
                           },
"create_tenant":
{ Args: { "p_name": string,"p_slug": string }; Returns: string
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expires_at": string,"role": Database["core"]['Enums']["member_role"],"status": string,"tenant_name": string
            }[]
                           },
"has_tenant_role":
{ Args: { "p_min": Database["core"]['Enums']["member_role"],"p_tenant": string }; Returns: boolean
                           },
"list_members":
{ Args: { "p_tenant": string }; Returns: {
              "created_at": string,"email": string,"is_self": boolean,"member_id": string,"role": Database["core"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"log_audit":
{ Args: { "p_action": string,"p_metadata"?: Json,"p_target_id": string,"p_target_type": string,"p_tenant": string }; Returns: undefined
                           },
"module_enabled":
{ Args: { "p_module": string,"p_tenant": string }; Returns: boolean
                           },
"module_entitled":
{ Args: { "p_module": string,"p_tenant": string }; Returns: boolean
                           },
"my_permissions":
{ Args: { "p_tenant": string }; Returns: string[]
                           },
"notify":
{ Args: { "p_body"?: string,"p_href"?: string,"p_kind": string,"p_metadata"?: Json,"p_tenant": string,"p_title": string,"p_user": string }; Returns: undefined
                           },
"notify_role":
{ Args: { "p_body"?: string,"p_exclude"?: string,"p_href"?: string,"p_kind": string,"p_min": Database["core"]['Enums']["member_role"],"p_tenant": string,"p_title": string }; Returns: undefined
                           },
"purge_notifications":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"search":
{ Args: { "p_limit"?: number,"p_query": string,"p_tenant": string }; Returns: {
              "entity_id": string,"entity_type": string,"href": string,"rank": number,"subtitle": string,"title": string
            }[]
                           },
"search_query":
{ Args: { "p_query": string }; Returns: unknown
                           },
"search_remove":
{ Args: { "p_id": string,"p_type": string }; Returns: undefined
                           },
"search_upsert":
{ Args: { "p_href": string,"p_id": string,"p_permission": string,"p_subtitle": string,"p_tenant": string,"p_title": string,"p_type": string }; Returns: undefined
                           },
"set_module_enabled":
{ Args: { "p_enabled": boolean,"p_module": string,"p_tenant": string }; Returns: undefined
                           },
"tenant_access":
{ Args: { "p_min": Database["core"]['Enums']["member_role"],"p_module": string,"p_tenant": string }; Returns: boolean
                           }
          }
          Enums: {
            "member_role": "viewer"|"member"|"admin"|"owner"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "nova_ingest_event":
{ Args: { "p": Json }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
            "match_operator": ["equals", "starts_with", "contains", "regex"],"tracking_mode": ["cookieless", "consent_upgrade", "consent_required"],"traffic_channel": ["organic_search", "paid_search", "direct", "referral", "social", "email", "display", "unassigned"],"visitor_id_type": ["daily_hash", "consented_id"]
          }
        },"core": {
          Enums: {
            "member_role": ["viewer", "member", "admin", "owner"]
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
