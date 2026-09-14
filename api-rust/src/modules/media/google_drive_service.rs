use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct GoogleDriveService {
    client: Client,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: i32,
    pub token_type: String,
}

impl GoogleDriveService {
    pub fn new() -> Self {
        let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
        let api_base_url = std::env::var("API_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let redirect_uri = format!("{}/api/v1/integrations/google-drive/callback", api_base_url);

        Self {
            client: Client::new(),
            client_id,
            client_secret,
            redirect_uri,
        }
    }

    pub fn get_auth_url(&self) -> String {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/drive.readonly&access_type=offline&prompt=consent",
            self.client_id, self.redirect_uri
        )
    }

    pub async fn exchange_code(&self, code: &str) -> Result<GoogleTokenResponse, reqwest::Error> {
        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("code", code),
            ("redirect_uri", self.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];

        let response = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        response.json::<GoogleTokenResponse>().await
    }
}
