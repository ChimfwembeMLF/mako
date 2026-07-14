use serde::Deserialize;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct LoginDto {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Deserialize, Validate)]
pub struct RegisterDto {
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Deserialize)]
pub struct RefreshTokenDto {
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
}

#[derive(Deserialize, Validate)]
pub struct ForgotPasswordDto {
    #[validate(email)]
    pub email: String,
}

#[derive(Deserialize, Validate)]
pub struct ResetPasswordDto {
    pub token: String,
    #[serde(rename = "newPassword")]
    #[validate(length(min = 6))]
    pub new_password: String,
}

#[derive(Deserialize, Validate)]
pub struct TokenVerificationDto {
    pub token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
}

#[derive(Deserialize)]
pub struct OAuthStateQuery {
    pub state: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct OAuthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    #[serde(rename = "error_description")]
    pub error_description: Option<String>,
}
