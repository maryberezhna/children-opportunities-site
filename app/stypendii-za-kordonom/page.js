import { TOPICS } from '@/lib/topics';
import TopicPage, { topicMetadata } from '../TopicPage';

const topic = TOPICS['stypendii-za-kordonom'];

export const revalidate = 300;
export const metadata = topicMetadata(topic);

export default function Page() {
  return <TopicPage topic={topic} />;
}
