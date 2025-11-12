import { FolderKanban } from 'lucide-react';

export default function S3ExplorerHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">S3 Explorer</h1>
        </div>
      </div>
    </header>
  );
}
