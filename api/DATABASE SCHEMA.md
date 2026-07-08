// =====================
// TENANCY CORE
// =====================
Table auth.users {
  id uuid [pk]
  email text
  created_at timestamptz
}

Table tenants {
  id uuid [pk, default: `gen_random_uuid()`]
  name text
  slug text [unique]
  logo_url text
  owner_id uuid [ref: > auth.users.id]
  created_at timestamptz
  updated_at timestamptz
}

Table profiles {
  id uuid [pk, default: `gen_random_uuid()`]
  user_id uuid [unique, ref: > auth.users.id]
  display_name text
  full_name text
  avatar_url text
  is_system_admin boolean
  created_at timestamptz
  updated_at timestamptz
  // Note: email removed – use auth.users.email instead
}

Table tenant_members {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]
  role_id uuid
  is_active boolean
  invited_by uuid [ref: > auth.users.id]
  joined_at timestamptz

  indexes {
    (tenant_id, user_id) [unique]
  }
}

Table workspaces {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  name text
  slug text
  logo_url text
  created_at timestamptz
  updated_at timestamptz

  indexes {
    (tenant_id, slug) [unique]
  }
}

// =====================
// RBAC
// =====================

Table permissions {
  key text [pk]
  label text
  description text
  module text
}

Table roles {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  name text
  description text
  is_system boolean
  created_at timestamptz

  indexes {
    (tenant_id, name) [unique]
  }
}

Table role_permissions {
  role_id uuid [ref: > roles.id]
  permission_key text [ref: > permissions.key]

  indexes {
    (role_id, permission_key) [pk]
  }
}

// Enhanced user permissions with effect, expiry, and audit fields
Table user_permissions {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]
  permission_key text [ref: > permissions.key]
  effect text [not null] // 'allow' or 'deny'
  valid_from timestamptz [default: `now()`]
  valid_until timestamptz
  granted_by uuid [ref: > auth.users.id]
  reason text
  created_at timestamptz

  indexes {
    (tenant_id, user_id, permission_key) [unique]
    (valid_until) // for expiration cleanup
  }
}

// =====================
// BRAND SYSTEM
// =====================

Table brand_profiles {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]

  company_name text
  industry text
  description text
  services text
  target_audience text
  audience_pain_points text
  tone_of_voice text
  brand_personality text
  current_offers text
  unique_selling_points text
  faqs text
  case_studies text
  banned_words text
  banned_topics text
  competitors text
  keywords text
  website_url text

  created_at timestamptz
  updated_at timestamptz
  deleted_at timestamptz // soft delete

  indexes {
    (tenant_id, user_id) [unique]
  }
}

// =====================
// CONTENT SYSTEM
// =====================

Table content_items {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  workspace_id uuid [ref: > workspaces.id]
  user_id uuid [ref: > auth.users.id]
  brand_profile_id uuid [ref: > brand_profiles.id]

  content_type text
  title text
  content text

  campaign_theme text
  status text

  platforms text[]
  platform_payloads jsonb

  scheduled_date date
  scheduled_time timetz
  published_at timestamptz

  external_post_id text
  publish_failed_reason text

  deleted_at timestamptz

  created_at timestamptz
  updated_at timestamptz

  indexes {
    (tenant_id, status, scheduled_date)
    (workspace_id, status)
  }
}

Table media_assets {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  content_id uuid [ref: > content_items.id]

  media_url text
  media_type text
  name text
  tags text[]

  uploaded_by uuid [ref: > auth.users.id]

  file_size_bytes bigint
  width_px int
  height_px int
  alt_text text

  created_at timestamptz

  indexes {
    content_id
  }
}

// =====================
// SOCIAL + AUTOMATION
// =====================

Table social_accounts {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]

  platform text
  account_name text
  connected boolean
  credentials jsonb

  created_at timestamptz
  updated_at timestamptz
  deleted_at timestamptz
}

Table auto_reply_rules {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]

  platform text
  name text
  trigger_keywords text[]
  trigger_sentiment text
  response_template text
  ai_generate boolean
  is_active boolean

  created_at timestamptz
  updated_at timestamptz
  deleted_at timestamptz
}

Table comment_replies {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  content_id uuid [ref: > content_items.id]

  platform text
  external_comment_id text
  external_post_id text

  commenter_name text
  commenter_avatar_url text
  comment_text text

  reply_text text
  reply_type text

  status text
  rule_id uuid [ref: > auto_reply_rules.id]

  sent_at timestamptz
  parent_comment_id text

  created_at timestamptz

  indexes {
    content_id
    rule_id
  }
}

// =====================
// LEADS (now tenant‑isolated)
// =====================

Table lead_sources {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]  // added tenant isolation
  user_id uuid [ref: > auth.users.id]
  label text
  webhook_secret text
  created_at timestamptz

  indexes {
    (tenant_id, user_id)
  }
}

Table leads {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]

  name text
  email text
  source text
  message text

  classification text
  status text

  ai_reply text
  unsubscribed boolean
  unsubscribe_token text

  deleted_at timestamptz

  created_at timestamptz
  updated_at timestamptz

  indexes {
    (tenant_id, status, created_at)
  }
}

// =====================
// PAYMENTS
// =====================

Table deposits {
  id uuid [pk, default: `gen_random_uuid()`]
  deposit_id text [unique]

  tenant_id uuid [ref: > tenants.id]

  plan text
  status text
  amount numeric
  currency text

  correspondent text
  msisdn text
  phone text
  provider text

  raw_payload jsonb

  created_at timestamptz
  updated_at timestamptz
}

Table payment_failures {
  id uuid [pk, default: `gen_random_uuid()`]
  deposit_id text

  tenant_id uuid [ref: > tenants.id]
  provider text
  reason text
  raw_payload jsonb

  created_at timestamptz
}

// =====================
// APPROVAL WORKFLOWS (fixed role FK)
// =====================

Table approval_workflows {
  action_key text [pk]
  label text
  description text
  is_enabled boolean
  approver_role_id uuid [ref: > roles.id]  // changed from text to FK
  updated_by uuid [ref: > auth.users.id]
  updated_at timestamptz
}

Table approval_requests {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]

  action_key text [ref: > approval_workflows.action_key]
  resource_type text
  resource_id uuid

  payload jsonb

  requested_by uuid [ref: > auth.users.id]
  reviewed_by uuid [ref: > auth.users.id]

  status text
  requester_notes text
  reviewer_notes text

  created_at timestamptz
  reviewed_at timestamptz

  indexes {
    (status, created_at)
    (tenant_id, status)
  }
}

// =====================
// WHATSAPP
// =====================

Table whatsapp_contacts {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]

  phone text
  name text
  opted_in boolean
  opted_in_at timestamptz
  tags text[]

  created_at timestamptz

  indexes {
    (tenant_id, phone)
  }
}

// =====================
// AUDIT + AI USAGE
// =====================

Table audit_logs {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]

  action text
  resource_type text
  resource_id uuid

  before_state jsonb
  after_state jsonb
  metadata jsonb

  ip_address text
  user_agent text

  created_at timestamptz

  indexes {
    (tenant_id, created_at)
  }
}

Table ai_usage {
  id uuid [pk, default: `gen_random_uuid()`]
  tenant_id uuid [ref: > tenants.id]
  user_id uuid [ref: > auth.users.id]

  function_name text
  tokens_used int
  created_at timestamptz

  indexes {
    (tenant_id, created_at)
  }
}