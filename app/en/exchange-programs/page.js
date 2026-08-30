import { TOPICS } from '@/lib/topics';
import TopicPage, { topicMetadata } from '../../TopicPage';

const topic = TOPICS['prohramy-obminu'];

export const revalidate = 300;
export const metadata = topicMetadata(topic, 'en');

export default function Page() {
  return <TopicPage topic={topic} lang="en" />;
}
