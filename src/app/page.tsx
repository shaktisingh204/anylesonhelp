import S3ExplorerHeader from '@/components/s3/header';
import S3Explorer from '@/components/s3/s3-explorer';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <S3ExplorerHeader />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <S3Explorer />
      </main>
    </div>
  );
}
