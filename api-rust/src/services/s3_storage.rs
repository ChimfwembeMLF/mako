use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::{Builder as S3ConfigBuilder, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use tokio::sync::OnceCell;
use uuid::Uuid;

use crate::common::{ApiError, ApiResult};
use crate::config::S3Config;

#[derive(Clone, Debug)]
pub struct StorageUploadResult {
    pub public_url: String,
    pub storage_path: String,
}

#[derive(Clone)]
pub struct S3StorageService {
    config: S3Config,
    client: OnceCell<Client>,
}

impl S3StorageService {
    pub fn new(config: S3Config) -> Self {
        Self {
            config,
            client: OnceCell::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.config.is_enabled()
    }

    pub fn bucket(&self) -> &str {
        self.config.bucket.trim()
    }

    pub fn is_s3_url(&self, url: &str) -> bool {
        self.path_from_public_url(url).is_some()
    }

    pub fn build_object_path(&self, tenant_id: &str, prefix: Option<&str>, ext: &str) -> String {
        let safe_tenant: String = tenant_id
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-')
            .collect();
        let folder = prefix.unwrap_or("uploads");
        let normalized_ext = ext.trim_start_matches('.');
        format!("{safe_tenant}/{folder}/{}.{}", Uuid::new_v4(), normalized_ext)
    }

    pub fn public_url(&self, storage_path: &str) -> String {
        let endpoint = self.config.endpoint.trim_end_matches('/');
        if endpoint.is_empty() {
            format!(
                "https://s3.{}.amazonaws.com/{}/{}",
                self.config.region.trim(),
                self.bucket(),
                storage_path
            )
        } else {
            format!("{endpoint}/{}/{storage_path}", self.bucket())
        }
    }

    pub fn path_from_public_url(&self, public_url: &str) -> Option<String> {
        if public_url.trim().is_empty() {
            return None;
        }

        let prefix = format!("{}/", self.public_url(""));
        if public_url.starts_with(&prefix) {
            return Some(public_url[prefix.len()..].to_string());
        }

        None
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
                "S3 storage is required. Set AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env"
                    .into(),
            ));
        }

        let ext = file_extension(original_name).unwrap_or_else(|| {
            if content_type.starts_with("video/") {
                ".mp4"
            } else if content_type.starts_with("image/") {
                ".bin"
            } else {
                ".bin"
            }
        });
        let storage_path = self.build_object_path(tenant_id, prefix, ext);
        let client = self.client().await?;

        client
            .put_object()
            .bucket(self.bucket())
            .key(&storage_path)
            .body(ByteStream::from(buffer.to_vec()))
            .content_type(content_type)
            .cache_control("max-age=3600")
            .send()
            .await
            .map_err(|err| ApiError::BadRequest(format!("Storage upload failed: {err}")))?;

        Ok(StorageUploadResult {
            public_url: self.public_url(&storage_path),
            storage_path,
        })
    }

    pub async fn delete_object(&self, storage_path: &str) -> ApiResult<()> {
        if !self.is_enabled() || storage_path.trim().is_empty() {
            return Ok(());
        }

        let client = self.client().await?;
        client
            .delete_object()
            .bucket(self.bucket())
            .key(storage_path)
            .send()
            .await
            .map_err(|err| ApiError::BadRequest(format!("Storage delete failed: {err}")))?;

        Ok(())
    }

    pub async fn delete_by_public_url(&self, public_url: &str) -> ApiResult<()> {
        if let Some(path) = self.path_from_public_url(public_url) {
            self.delete_object(&path).await?;
        }
        Ok(())
    }

    async fn client(&self) -> ApiResult<&Client> {
        self.client
            .get_or_try_init(|| async {
                let credentials = Credentials::new(
                    self.config.access_key_id.trim(),
                    self.config.secret_access_key.trim(),
                    None,
                    None,
                    "mako-s3",
                );

                let shared = aws_config::defaults(BehaviorVersion::latest())
                    .region(Region::new(self.config.region.clone()))
                    .credentials_provider(credentials)
                    .load()
                    .await;

                let mut builder = S3ConfigBuilder::from(&shared);
                if !self.config.endpoint.trim().is_empty() {
                    builder = builder
                        .endpoint_url(self.config.endpoint.trim())
                        .force_path_style(self.config.force_path_style);
                }

                Ok(Client::from_conf(builder.build()))
            })
            .await
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
