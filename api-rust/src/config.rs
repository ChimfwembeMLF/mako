use anyhow::{Context, Result};
use std::env;

#[derive(Clone)]
pub struct OAuthConfig {
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_callback_url: String,
    pub google_gmail_callback_url: String,
    pub facebook_app_id: String,
    pub facebook_app_secret: String,
    pub facebook_callback_url: String,
    pub facebook_graph_url: String,
    pub linkedin_client_id: String,
    pub linkedin_client_secret: String,
    pub linkedin_callback_url: String,
    pub instagram_client_id: String,
    pub instagram_client_secret: String,
    pub instagram_callback_url: String,
    pub frontend_url: String,
}

impl OAuthConfig {
    pub fn from_env() -> Self {
        let frontend_url = env::var("FRONTEND_URL")
            .or_else(|_| env::var("CLIENT_URL"))
            .or_else(|_| env::var("APP_URL"))
            .unwrap_or_else(|_| {
                let port = env::var("PORT").unwrap_or_else(|_| "4000".to_string());
                format!("http://localhost:{port}")
            })
            .trim_end_matches('/')
            .to_string();

        Self {
            google_client_id: env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
            google_callback_url: env::var("GOOGLE_CALLBACK_URL").unwrap_or_default(),
            google_gmail_callback_url: env::var("GOOGLE_GMAIL_CALLBACK_URL").unwrap_or_default(),
            facebook_app_id: env::var("FACEBOOK_APP_ID").unwrap_or_default(),
            facebook_app_secret: env::var("FACEBOOK_APP_SECRET").unwrap_or_default(),
            facebook_callback_url: env::var("FACEBOOK_CALLBACK_URL").unwrap_or_default(),
            facebook_graph_url: env::var("FACEBOOK_GRAPH_URL")
                .unwrap_or_else(|_| "https://graph.facebook.com".to_string()),
            linkedin_client_id: env::var("LINKEDIN_CLIENT_ID").unwrap_or_default(),
            linkedin_client_secret: env::var("LINKEDIN_CLIENT_SECRET").unwrap_or_default(),
            linkedin_callback_url: env::var("LINKEDIN_CALLBACK_URL").unwrap_or_default(),
            instagram_client_id: env::var("INSTAGRAM_CLIENT_ID").unwrap_or_default(),
            instagram_client_secret: env::var("INSTAGRAM_CLIENT_SECRET").unwrap_or_default(),
            instagram_callback_url: env::var("INSTAGRAM_CALLBACK_URL").unwrap_or_default(),
            frontend_url,
        }
    }
}

#[derive(Clone)]
pub struct MailConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
    pub app_name: String,
}

impl MailConfig {
    pub fn from_env() -> Self {
        Self {
            host: env::var("MAIL_HOST").unwrap_or_default(),
            port: env::var("MAIL_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .unwrap_or(587),
            username: env::var("MAIL_USERNAME").unwrap_or_default(),
            password: env::var("MAIL_PASSWORD").unwrap_or_default(),
            from: env::var("MAIL_FROM").unwrap_or_default(),
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "Mako".to_string()),
        }
    }

    pub fn is_configured(&self) -> bool {
        const PLACEHOLDERS: &[&str] = &["MAIL_DETAILS", "MAIL_DETAILS_HERE", "PASSWORD", ""];
        !self.host.is_empty()
            && !PLACEHOLDERS.contains(&self.username.as_str())
            && !PLACEHOLDERS.contains(&self.password.as_str())
            && !PLACEHOLDERS.contains(&self.from.as_str())
    }
}

#[derive(Clone)]
pub struct MistralConfig {
    pub api_key: String,
    pub text_model: String,
    pub premium_model: String,
}

impl MistralConfig {
    pub fn from_env() -> Self {
        Self {
            api_key: env::var("MISTRAL_API_KEY").unwrap_or_default(),
            text_model: env::var("MISTRAL_TEXT_MODEL")
                .unwrap_or_else(|_| "mistral-small-latest".to_string()),
            premium_model: env::var("MISTRAL_PREMIUM_MODEL")
                .unwrap_or_else(|_| "mistral-large-latest".to_string()),
        }
    }
}

#[derive(Clone)]
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint: String,
    pub force_path_style: bool,
}

impl S3Config {
    pub fn from_env() -> Self {
        let endpoint = env::var("AWS_S3_ENDPOINT")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                env::var("MINIO_DOMAIN")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
                    .map(|domain| {
                        if domain.starts_with("http://") || domain.starts_with("https://") {
                            domain
                        } else {
                            format!("https://{domain}")
                        }
                    })
            })
            .unwrap_or_default();

        let bucket = env::var("AWS_S3_BUCKET_NAME")
            .or_else(|_| env::var("MINIO_BUCKET"))
            .unwrap_or_default();

        let force_path_style =
            env_flag("AWS_S3_FORCE_PATH_STYLE") || !endpoint.trim().is_empty();

        Self {
            bucket,
            region: env::var("AWS_S3_BUCKET_NAME_REGION")
                .unwrap_or_else(|_| "us-east-1".to_string()),
            access_key_id: env::var("AWS_ACCESS_KEY_ID")
                .or_else(|_| env::var("MINIO_ROOT_USER"))
                .unwrap_or_default(),
            secret_access_key: env::var("AWS_SECRET_ACCESS_KEY")
                .or_else(|_| env::var("MINIO_ROOT_PASSWORD"))
                .unwrap_or_default(),
            endpoint,
            force_path_style,
        }
    }

    pub fn is_enabled(&self) -> bool {
        !self.bucket.trim().is_empty()
            && !self.access_key_id.trim().is_empty()
            && !self.secret_access_key.trim().is_empty()
    }
}

#[derive(Clone)]
pub struct SupabaseConfig {
    pub url: String,
    pub service_role_key: String,
    pub storage_bucket: String,
}

impl SupabaseConfig {
    pub fn from_env() -> Self {
        Self {
            url: env::var("SUPABASE_URL").unwrap_or_default(),
            service_role_key: env::var("SUPABASE_SERVICE_ROLE_KEY").unwrap_or_default(),
            storage_bucket: env::var("SUPABASE_STORAGE_BUCKET")
                .unwrap_or_else(|_| "media".to_string()),
        }
    }
}

#[derive(Clone)]
pub struct PawaPayConfig {
    pub env: String,
    pub api_token: String,
    pub api_url: String,
    pub sandbox_api_url: String,
    pub base_url_sandbox: String,
    pub base_url_prod: String,
    pub private_key: String,
    pub public_key_id: String,
    pub payments_dev_auto_complete: bool,
}

impl PawaPayConfig {
    pub fn from_env() -> Self {
        Self {
            env: env::var("PAWAPAY_ENV").unwrap_or_else(|_| "sandbox".to_string()),
            api_token: env::var("PAWAPAY_API_TOKEN").unwrap_or_default(),
            api_url: env::var("PAWAPAY_API_URL").unwrap_or_default(),
            sandbox_api_url: env::var("PAWAPAY_SANDBOX_API_URL").unwrap_or_default(),
            base_url_sandbox: env::var("PAWAPAY_BASE_URL_SANDBOX").unwrap_or_default(),
            base_url_prod: env::var("PAWAPAY_BASE_URL_PROD").unwrap_or_default(),
            private_key: env::var("PAWAPAY_PRIVATE_KEY").unwrap_or_default(),
            public_key_id: env::var("PAWAPAY_PUBLIC_KEY_ID").unwrap_or_default(),
            payments_dev_auto_complete: env_flag("PAYMENTS_DEV_AUTO_COMPLETE"),
        }
    }
}

pub struct AppConfig {
    pub port: u16,
    pub jwt_secret: String,
    pub jwt_expiry_secs: usize,
    pub refresh_expiry_secs: usize,
    pub database_url: String,
    pub node_env: String,
    pub oauth: OAuthConfig,
    pub mail: MailConfig,
    pub mistral: MistralConfig,
    pub s3: S3Config,
    pub supabase: SupabaseConfig,
    pub pawapay: PawaPayConfig,
    pub queues_enabled: bool,
    pub redis_url: Option<String>,
    pub auto_publish_cron_enabled: bool,
    pub comment_sync_cron_enabled: bool,
    pub pawapay_poll_cron_enabled: bool,
    pub subscription_renewal_cron_enabled: bool,
    pub daily_workflow_cron_enabled: bool,
    pub insights_sync_cron_enabled: bool,
    pub notification_cron_enabled: bool,
    pub weekly_digest_cron_enabled: bool,
    pub throttle_enabled: bool,
    pub throttle_limit: u32,
    pub throttle_ttl_secs: u64,
    pub auto_reply_backfill_on_start: bool,
    pub uploads_dir: Option<String>,
    pub public_dir: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        let _ = dotenvy::from_filename("../api/.env");

        let port = env::var("PORT")
            .unwrap_or_else(|_| "4000".to_string())
            .parse()
            .context("PORT must be a number")?;

        let jwt_secret = env::var("JWT_SECRET")
            .or_else(|_| env::var("SESSION_SECRET"))
            .unwrap_or_else(|_| "default_secret".to_string());

        let jwt_expiry_secs = env::var("SESSION_EXPIRY")
            .unwrap_or_else(|_| "3600".to_string())
            .parse()
            .unwrap_or(3600);

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| build_database_url());

        Ok(Self {
            port,
            jwt_secret,
            jwt_expiry_secs,
            refresh_expiry_secs: 7 * 24 * 3600,
            database_url,
            node_env: env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()),
            oauth: OAuthConfig::from_env(),
            mail: MailConfig::from_env(),
            mistral: MistralConfig::from_env(),
            s3: S3Config::from_env(),
            supabase: SupabaseConfig::from_env(),
            pawapay: PawaPayConfig::from_env(),
            queues_enabled: env_flag("QUEUES_ENABLED"),
            redis_url: redis_url_from_env(),
            auto_publish_cron_enabled: env_flag_default_true("AUTO_PUBLISH_CRON_ENABLED"),
            comment_sync_cron_enabled: env_flag_default_true("COMMENT_SYNC_CRON_ENABLED"),
            pawapay_poll_cron_enabled: env_flag_default_true("PAWAPAY_POLL_CRON_ENABLED"),
            subscription_renewal_cron_enabled: env_flag_default_true(
                "SUBSCRIPTION_RENEWAL_CRON_ENABLED",
            ),
            daily_workflow_cron_enabled: env_flag_default_true("DAILY_WORKFLOW_CRON_ENABLED"),
            insights_sync_cron_enabled: env_flag_default_true("INSIGHTS_SYNC_CRON_ENABLED"),
            notification_cron_enabled: env_flag_default_true("NOTIFICATION_CRON_ENABLED"),
            weekly_digest_cron_enabled: env_flag_default_true("WEEKLY_DIGEST_CRON_ENABLED"),
            throttle_enabled: throttle_enabled_from_env(),
            throttle_limit: env_u32("THROTTLE_LIMIT", 100),
            throttle_ttl_secs: env_u64("THROTTLE_TTL_SECS", 60),
            auto_reply_backfill_on_start: !matches!(
                env::var("AUTO_REPLY_BACKFILL_ON_START")
                    .unwrap_or_default()
                    .to_lowercase()
                    .as_str(),
                "false" | "0" | "no"
            ),
            uploads_dir: env::var("UPLOADS_DIR").ok().filter(|v| !v.trim().is_empty()),
            public_dir: env::var("PUBLIC_DIR").ok().filter(|v| !v.trim().is_empty()),
        })
    }
}

fn env_flag(key: &str) -> bool {
    matches!(
        env::var(key).unwrap_or_default().to_lowercase().as_str(),
        "true" | "1" | "yes"
    )
}

fn throttle_enabled_from_env() -> bool {
    match env::var("THROTTLE_ENABLED") {
        Ok(value) => !matches!(value.to_lowercase().as_str(), "false" | "0" | "no"),
        Err(_) => env::var("NODE_ENV")
            .map(|v| v.to_lowercase() != "test")
            .unwrap_or(true),
    }
}

fn env_u32(key: &str, default: u32) -> u32 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn redis_url_from_env() -> Option<String> {
    if let Ok(url) = env::var("REDIS_URL") {
        let trimmed = url.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    let host = env::var("REDIS_HOST").ok().filter(|v| !v.trim().is_empty())?;
    let port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let password = env::var("REDIS_PASSWORD").ok().filter(|v| !v.is_empty());
    Some(match password {
        Some(pass) => format!("redis://:{pass}@{host}:{port}"),
        None => format!("redis://{host}:{port}"),
    })
}

fn env_flag_default_true(key: &str) -> bool {
    match env::var(key) {
        Ok(value) => !matches!(value.to_lowercase().as_str(), "false" | "0" | "no"),
        Err(_) => true,
    }
}

fn build_database_url() -> String {
    let host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
    let user = env::var("DB_USERNAME").unwrap_or_else(|_| "thecodefather".to_string());
    let password = env::var("DB_PASSWORD").unwrap_or_default();
    let database = env::var("DB_DATABASE").unwrap_or_else(|_| "autopilot_dev".to_string());

    if password.is_empty() {
        format!("postgres://{user}@{host}:{port}/{database}")
    } else {
        format!("postgres://{user}:{password}@{host}:{port}/{database}")
    }
}
