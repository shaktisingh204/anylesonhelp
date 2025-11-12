'use client';

import { generateDynamicVideoPreviews } from '@/ai/flows/generate-dynamic-video-previews';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Film } from 'lucide-react';

export function VideoPreview({ videoName }: { videoName: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    async function getPreview() {
      setIsLoading(true);
      try {
        const result = await generateDynamicVideoPreviews({ videoDescription: videoName });
        if (!isCancelled) {
          setPreview(result.previewDataUri);
        }
      } catch (error) {
        console.error("Failed to generate preview for " + videoName, error);
        if (!isCancelled) {
          setPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }
    getPreview();

    return () => {
      isCancelled = true;
    }
  }, [videoName]);

  if (isLoading) {
    return <Skeleton className="w-32 h-20 rounded-md" />;
  }

  if (!preview) {
    return (
      <div className="w-32 h-20 rounded-md bg-muted flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
        <Film className="w-6 h-6" />
        <span>No Preview</span>
      </div>
    );
  }

  return (
    <div className="w-32 h-20 rounded-md overflow-hidden bg-muted">
      <Image 
        src={preview} 
        alt={`Preview for ${videoName}`} 
        width={128} 
        height={80} 
        className="object-cover w-full h-full"
        unoptimized // Necessary for external non-whitelisted image URLs returned by GenAI
      />
    </div>
  );
}
