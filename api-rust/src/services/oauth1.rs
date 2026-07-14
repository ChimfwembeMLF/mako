use base64::{engine::general_purpose::STANDARD as B64, Engine};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use std::collections::BTreeMap;

type HmacSha1 = Hmac<Sha1>;

pub struct OAuth1Credentials<'a> {
    pub consumer_key: &'a str,
    pub consumer_secret: &'a str,
    pub token: &'a str,
    pub token_secret: &'a str,
}

pub fn authorization_header(
    method: &str,
    url: &str,
    extra_params: &[(&str, &str)],
    creds: &OAuth1Credentials<'_>,
) -> String {
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let nonce = uuid::Uuid::new_v4().simple().to_string();

    let mut params: BTreeMap<String, String> = BTreeMap::new();
    params.insert("oauth_consumer_key".into(), creds.consumer_key.to_string());
    params.insert("oauth_nonce".into(), nonce);
    params.insert("oauth_signature_method".into(), "HMAC-SHA1".into());
    params.insert("oauth_timestamp".into(), timestamp.clone());
    params.insert("oauth_token".into(), creds.token.to_string());
    params.insert("oauth_version".into(), "1.0".into());

    for (k, v) in extra_params {
        params.insert((*k).to_string(), (*v).to_string());
    }

    let signature = sign(method, url, &params, creds);
    params.insert("oauth_signature".into(), signature);

    let header = params
        .iter()
        .filter(|(k, _)| k.starts_with("oauth_"))
        .map(|(k, v)| format!("{}=\"{}\"", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join(", ");

    format!("OAuth {header}")
}

fn sign(
    method: &str,
    url: &str,
    params: &BTreeMap<String, String>,
    creds: &OAuth1Credentials<'_>,
) -> String {
    let base_url = url.split('?').next().unwrap_or(url);
    let param_string = params
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let base_string = format!(
        "{}&{}&{}",
        percent_encode(&method.to_uppercase()),
        percent_encode(base_url),
        percent_encode(&param_string)
    );

    let signing_key = format!(
        "{}&{}",
        percent_encode(creds.consumer_secret),
        percent_encode(creds.token_secret)
    );

    let mut mac = HmacSha1::new_from_slice(signing_key.as_bytes()).expect("HMAC key");
    mac.update(base_string.as_bytes());
    B64.encode(mac.finalize().into_bytes())
}

fn percent_encode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}
