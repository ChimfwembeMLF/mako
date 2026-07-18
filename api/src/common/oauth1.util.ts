import { createHmac, randomBytes } from 'crypto';

export type OAuth1Credentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

function percentEncode(value: string): string {
  let out = '';
  for (const byte of Buffer.from(value, 'utf8')) {
    if (
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      (byte >= 0x30 && byte <= 0x39) ||
      byte === 0x2d ||
      byte === 0x2e ||
      byte === 0x5f ||
      byte === 0x7e
    ) {
      out += String.fromCharCode(byte);
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

function signOAuth1(
  method: string,
  url: string,
  params: Record<string, string>,
  creds: OAuth1Credentials,
): string {
  const baseUrl = url.split('?')[0] ?? url;
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join('&');

  const baseString = [
    percentEncode(method.toUpperCase()),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

/** Build OAuth 1.0a Authorization header for Twitter media upload. */
export function oauth1AuthorizationHeader(
  method: string,
  url: string,
  extraParams: Record<string, string>,
  creds: OAuth1Credentials,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');

  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.token,
    oauth_version: '1.0',
    ...extraParams,
  };

  params.oauth_signature = signOAuth1(method, url, params, creds);

  const header = Object.entries(params)
    .filter(([k]) => k.startsWith('oauth_'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');

  return `OAuth ${header}`;
}
