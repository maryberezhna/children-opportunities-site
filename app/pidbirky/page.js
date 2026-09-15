import CollectionsHub, { collectionsMetadata } from '../CollectionsHub';

export const revalidate = 300;
export const metadata = collectionsMetadata('uk');

export default function Page() {
  return <CollectionsHub lang="uk" />;
}
