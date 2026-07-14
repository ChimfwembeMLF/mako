use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use scrypt::{scrypt, Params};
use std::env;

const SALT: &[u8] = b"mako-oauth-token-v1";
const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;

fn encryption_secret() -> String {
    env::var("TOKEN_ENCRYPTION_KEY")
        .or_else(|_| env::var("JWT_SECRET"))
        .unwrap_or_else(|_| "default_secret".to_string())
}

fn derive_key(secret: &str) -> Result<[u8; 32]> {
    let params = Params::new(14, 8, 1, 32).context("scrypt params")?;
    let mut key = [0u8; 32];
    scrypt(secret.as_bytes(), SALT, &params, &mut key).context("scrypt")?;
    Ok(key)
}

/// Matches NestJS `token-crypto.util.ts`: base64(iv[12] + authTag[16] + ciphertext).
pub fn encrypt_token(plaintext: &str) -> Result<String> {
    let key = derive_key(&encryption_secret())?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| anyhow!(e))?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    getrandom::fill(&mut nonce_bytes).map_err(|e| anyhow!(e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let payload = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow!("encrypt failed: {e}"))?;
    if payload.len() < TAG_LEN {
        return Err(anyhow!("invalid encrypt output"));
    }
    let (ct, tag) = payload.split_at(payload.len() - TAG_LEN);
    let mut out = Vec::with_capacity(NONCE_LEN + TAG_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(tag);
    out.extend_from_slice(ct);
    Ok(STANDARD.encode(out))
}

pub fn decrypt_token(payload: &str) -> Result<String> {
    let key = derive_key(&encryption_secret())?;
    let buf = STANDARD.decode(payload).context("base64 decode")?;
    if buf.len() <= NONCE_LEN + TAG_LEN {
        return Err(anyhow!("invalid ciphertext"));
    }
    let nonce_bytes = &buf[0..NONCE_LEN];
    let tag = &buf[NONCE_LEN..NONCE_LEN + TAG_LEN];
    let ct = &buf[NONCE_LEN + TAG_LEN..];
    let mut combined = ct.to_vec();
    combined.extend_from_slice(tag);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| anyhow!(e))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plain = cipher
        .decrypt(nonce, combined.as_ref())
        .map_err(|e| anyhow!("decrypt failed: {e}"))?;
    String::from_utf8(plain).context("utf8")
}
