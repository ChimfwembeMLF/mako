import { BlockList, isIP, type LookupFunction } from 'net';
import { lookup as dnsLookup } from 'dns';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const NON_PUBLIC_RANGES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  NON_PUBLIC_RANGES.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  NON_PUBLIC_RANGES.addSubnet(network, prefix, 'ipv6');
}

export const NON_PUBLIC_ADDRESS = 'ENONPUBLICADDRESS';

function nonPublicAddressError(target: string): Error {
  return Object.assign(new Error(`${target} is not a public address`), {
    code: NON_PUBLIC_ADDRESS,
  });
}

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return !NON_PUBLIC_RANGES.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

/** Rejects non-http(s) URLs and IP literals outside the public internet. */
export function assertPublicUrl(url: string): void {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw nonPublicAddressError(url);
  }
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw nonPublicAddressError(host);
  }
}

/** Checks what a hostname really resolves to, at connect time, so rebinding can't slip through. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) return (callback as any)(err);
    const addresses = Array.isArray(address)
      ? address.map((entry) => entry.address)
      : [address];
    if (!addresses.every(isPublicAddress)) {
      return (callback as any)(nonPublicAddressError(hostname));
    }
    (callback as any)(null, address, family);
  });
};

/**
 * Axios options for fetching a URL a user supplied: no private networks, cloud
 * metadata or loopback, including via redirects. IP literals skip DNS, which is
 * why redirects are checked separately from the agents' lookup.
 */
export const publicOnlyRequestOptions = {
  httpAgent: new HttpAgent({ lookup: publicOnlyLookup }),
  httpsAgent: new HttpsAgent({ lookup: publicOnlyLookup }),
  beforeRedirect: (options: { href?: string }) => {
    if (options.href) assertPublicUrl(options.href);
  },
};
