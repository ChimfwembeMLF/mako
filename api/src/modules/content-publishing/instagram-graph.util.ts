import { META_GRAPH_VERSION } from '../../common/meta-graph-version';

/** Instagram Login tokens only work on graph.instagram.com; Facebook-linked ones on graph.facebook.com. */
export function instagramGraphBase(account: {
  metadata?: Record<string, unknown> | null;
}): string {
  return account.metadata?.login_type === 'instagram'
    ? `https://graph.instagram.com/${META_GRAPH_VERSION}`
    : `https://graph.facebook.com/${META_GRAPH_VERSION}`;
}
