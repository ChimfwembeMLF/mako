use reqwest::Client;
use uuid::Uuid;

use crate::common::{ApiError, ApiResult};
use crate::config::SupabaseConfig;

#[derive(Clone, Debug)]
pub struct StorageUploadResult {
    pub public_url: String,
    pub storage_path: String,
}

#[derive(Clone)]
pub struct SupabaseStorageService {
    config: SupabaseConfig,
    client: Client,
}

impl SupabaseStorageService {
    pub fn new(config: SupabaseConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        !self.config.url.trim().is_empty() && !self.config.service_role_key.trim().is_empty()
    }

    pub fn bucket(&self) -> &str {
        &self.config.storage_bucket
    }

    pub fn is_supabase_url(&self, url: &str) -> bool {
        if url.trim().is_empty() {
            return false;
        }
        let base = self.config.url.trim_end_matches('/');
        url.starts_with(base) || url.contains("supabase.co/storage/v1/object/")
    }

    pub fn build_object_path(&self, tenant_id: &str, prefix: Option<&str>, ext: &str) -> String {
        let safe_tenant: String = tenant_id
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-')
            .collect();
        let folder = prefix.unwrap_or("uploads");
        format!("{safe_tenant}/{folder}/{}{ext}", Uuid::new_v4())
    }

    pub async fn upload_buffer(
        &self,
        tenant_id: &str,
        buffer: &[u8],
        content_type: &str,
        original_name: Option<&str>,
        prefix: Option<&str>,
    ) -> ApiResult<StorageUploadResult> {
        if !self.is_enabled() {
            return Err(ApiError::BadRequest(
                "Supabase storage is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
                    .into(),
            ));
        }

        let ext = file_extension(original_name).unwrap_or_else(|| {
            if content_type.starts_with("video/") {
                ".mp4"
            } else {
                ".bin"
            }
        });
        let storage_path = self.build_object_path(tenant_id, prefix, ext);
        let base = self.config.url.trim_end_matches('/');
        let encoded_path = encode_path(&storage_path);
        let upload_url = format!("{base}/storage/v1/object/{}/{encoded_path}", self.bucket());
        let key = self.config.service_role_key.trim();

        let response = self
            .client
            .post(upload_url)
            .header("apikey", key)
            .header("Authorization", format!("Bearer {key}"))
            .header("x-upsert", "false")
            .header("content-type", content_type)
            .body(buffer.to_vec())
            .send()
            .await
            .map_err(|err| ApiError::BadRequest(format!("Storage upload failed: {err}")))?;

        if !response.status().is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(ApiError::BadRequest(format!(
                "Storage upload failed: {message}"
            )));
        }

        let public_url = format!(
            "{}/storage/v1/object/public/{}/{}",
            base,
            self.bucket(),
            encoded_path
        );

        Ok(StorageUploadResult {
            public_url,
            storage_path,
        })
    }

    pub async fn delete_object(&self, storage_path: &str) -> ApiResult<()> {
        if !self.is_enabled() {
            return Ok(());
        }
        if storage_path.trim().is_empty() {
            return Ok(());
        }

        let base = self.config.url.trim_end_matches('/');
        let encoded_path = encode_path(storage_path);
        let delete_url = format!("{base}/storage/v1/object/{}/{}", self.bucket(), encoded_path);
        let key = self.config.service_role_key.trim();

        let response = self
            .client
            .delete(delete_url)
            .header("apikey", key)
            .header("Authorization", format!("Bearer {key}"))
            .send()
            .await
            .map_err(|err| ApiError::BadRequest(format!("Storage delete failed: {err}")))?;

        if !response.status().is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(ApiError::BadRequest(format!(
                "Storage delete failed: {message}"
            )));
        }

        Ok(())
    }
}

fn file_extension(original_name: Option<&str>) -> Option<&str> {
    let name = original_name?;
    let idx = name.rfind('.')?;
    if idx == name.len() - 1 {
        return None;
    }
    Some(&name[idx..])
}

fn encode_path(path: &str) -> String {
    path.split('/')
        .map(urlencoding::encode)
        .map(|part| part.into_owned())
        .collect::<Vec<_>>()
        .join("/")
}
