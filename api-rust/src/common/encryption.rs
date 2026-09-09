use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};

pub struct EncryptionService {
    key: [u8; 32],
}

impl EncryptionService {
    pub fn new(key_str: &str) -> Self {
        let mut key = [0u8; 32];
        let key_bytes = key_str.as_bytes();
        let len = key_bytes.len().min(32);
        key[..len].copy_from_slice(&key_bytes[..len]);
        Self { key }
    }

    pub fn encrypt(&self, data: &str) -> Result<(String, String, String), String> {
        let cipher = Aes256Gcm::new_from_slice(&self.key).map_err(|e| e.to_string())?;

        let mut nonce_bytes = [0u8; 12];
        getrandom::fill(&mut nonce_bytes).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| e.to_string())?;

        // AES-GCM appends the 16-byte auth tag to the end of the ciphertext
        let len = ciphertext.len();
        if len < 16 {
            return Err("Encryption failed: output too short".to_string());
        }

        let encrypted_data = &ciphertext[..len - 16];
        let auth_tag = &ciphertext[len - 16..];

        Ok((
            general_purpose::STANDARD.encode(encrypted_data),
            general_purpose::STANDARD.encode(nonce_bytes),
            general_purpose::STANDARD.encode(auth_tag),
        ))
    }

    pub fn decrypt(&self, encrypted_data: &str, iv: &str, auth_tag: &str) -> Result<String, String> {
        let cipher = Aes256Gcm::new_from_slice(&self.key).map_err(|e| e.to_string())?;

        let encrypted_bytes = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| e.to_string())?;
        let nonce_bytes = general_purpose::STANDARD
            .decode(iv)
            .map_err(|e| e.to_string())?;
        let auth_tag_bytes = general_purpose::STANDARD
            .decode(auth_tag)
            .map_err(|e| e.to_string())?;

        let mut payload = Vec::with_capacity(encrypted_bytes.len() + auth_tag_bytes.len());
        payload.extend_from_slice(&encrypted_bytes);
        payload.extend_from_slice(&auth_tag_bytes);

        let nonce = Nonce::from_slice(&nonce_bytes);
        let decrypted_bytes = cipher
            .decrypt(nonce, payload.as_ref())
            .map_err(|e| e.to_string())?;

        String::from_utf8(decrypted_bytes).map_err(|e| e.to_string())
    }
}
