import CollectionsHub, { collectionsMetadata } from '../../CollectionsHub';

export const revalidate = 300;
export const metadata = collectionsMetadata('en');

export default function Page() {
  return <CollectionsHub lang="en" />;
}
