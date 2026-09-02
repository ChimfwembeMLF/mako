import { useLocalSearchParams } from 'expo-router';
import { InboxThreadPanel } from '../../../src/components/InboxThreadPanel';

export default function InboxThreadScreen() {
  const { id, channel, contentId } = useLocalSearchParams<{
    id: string;
    channel?: string;
    contentId?: string;
  }>();

  return <InboxThreadPanel id={String(id)} channel={channel} contentId={contentId} />;
}
