'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { S3Folder, S3File } from '@/lib/s3';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCw, Folder, Home, FileDown, ChevronRight, Eye, ListTree, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VideoPreview } from './video-preview';
import { Badge } from '@/components/ui/badge';

type ViewMode = 'browse' | 'deep';

export default function S3Explorer() {
  const [prefix, setPrefix] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [data, setData] = useState<{ folders: S3Folder[], files: S3File[] } | null>(null);
  const [deepFiles, setDeepFiles] = useState<S3File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const { toast } = useToast();

  const fetchData = useCallback(async (currentPrefix: string, mode: ViewMode) => {
    setIsLoading(true);
    setData(null);
    setDeepFiles([]);
    
    const endpoint = mode === 'browse' ? `/api/browse?prefix=${currentPrefix}` : `/api/browse-recursive?prefix=${currentPrefix}`;

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const result = await response.json();
      if (mode === 'browse') {
        setData(result);
      } else {
        setDeepFiles(result.files);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      setData({ folders: [], files: [] });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData(prefix, viewMode);
  }, [prefix, viewMode, fetchData]);

  const handleNavigate = (newPrefix: string) => {
    setPrefix(newPrefix);
    const pathParts = newPrefix.replace(/\/$/, '').split('/').filter(p => p);
    setPath(pathParts);
    setViewMode('browse');
  };
  
  const handlePathNavigation = (index: number) => {
    const newPrefix = path.slice(0, index + 1).join('/') + '/';
    handleNavigate(newPrefix);
  };
  
  const handleRootNavigation = () => {
    handleNavigate('');
  };

  const handleExport = async () => {
    const filesToExport = viewMode === 'browse' ? data?.files : deepFiles;
    if (!filesToExport || filesToExport.length === 0) {
      toast({ title: 'Nothing to Export', description: 'There are no files in the current view.' });
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToExport, prefix }),
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast({ title: 'Export Successful', description: `${filename} has been downloaded.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export Error', description: 'Could not generate Excel file.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix }),
      });

      if (response.status === 404) {
        const errorData = await response.json();
        toast({ title: 'Nothing to Export', description: errorData.error });
        return;
      }

      if (!response.ok) throw new Error('Recursive export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'export-all.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Export All Successful', description: `${filename} has been downloaded.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export Error', description: 'Could not generate ZIP file.' });
    } finally {
      setIsExporting(false);
    }
  };

  const currentFiles = useMemo(() => viewMode === 'browse' ? data?.files : deepFiles, [viewMode, data, deepFiles]);
  const currentFolders = useMemo(() => viewMode === 'browse' ? data?.folders : [], [viewMode, data]);
  const hasContent = (currentFolders && currentFolders.length > 0) || (currentFiles && currentFiles.length > 0);

  return (
    <Card className="w-full shadow-lg">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center text-sm font-medium text-muted-foreground whitespace-nowrap overflow-x-auto">
            <button onClick={handleRootNavigation} className="flex items-center gap-1 hover:text-primary transition-colors">
              <Home className="h-4 w-4" />
              <span>Root</span>
            </button>
            {path.map((part, index) => (
              <div key={index} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-1" />
                <button onClick={() => handlePathNavigation(index)} className="hover:text-primary transition-colors">{part}</button>
              </div>
            ))}
          </nav>

          {/* Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fetchData(prefix, viewMode)} disabled={isLoading}>
              <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="ml-2">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'browse' ? 'deep' : 'browse')} disabled={isLoading || isExporting}>
              {viewMode === 'browse' ? <ListTree className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-2">{viewMode === 'browse' ? 'Show All Deep Files' : 'Show Folder View'}</span>
            </Button>
            <Button size="sm" onClick={handleExport} disabled={isLoading || isExporting || !currentFiles || currentFiles.length === 0}>
              {(isLoading || isExporting) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Export
            </Button>
            <Button size="sm" onClick={handleExportAll} disabled={isLoading || isExporting}>
              {(isLoading || isExporting) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Export All
            </Button>
          </div>
        </div>

        {/* File List */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Size</TableHead>
                <TableHead className="text-right w-[120px]">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="w-32 h-20 rounded-md bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-3/4 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-1/2 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-20 ml-auto rounded bg-muted animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  {viewMode === 'browse' && currentFolders?.map(folder => (
                    <TableRow key={folder.prefix} className="cursor-pointer hover:bg-secondary/50" onClick={() => handleNavigate(folder.prefix)}>
                      <TableCell>
                        <div className="w-32 h-20 flex items-center justify-center bg-secondary rounded-md">
                          <Folder className="h-10 w-10 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Folder className="h-5 w-5 text-amber-500" />
                        {folder.name}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {currentFiles?.map(file => (
                    <TableRow key={file.key}>
                      <TableCell>
                        <VideoPreview videoName={file.name} />
                      </TableCell>
                      <TableCell className="font-code text-sm">{file.name}
                      {viewMode === 'deep' && <Badge variant="outline" className="ml-2 text-xs">{file.key.substring(0, file.key.lastIndexOf('/'))}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{file.sizeFormatted}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <FileDown className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && !hasContent && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">No video files or folders found.</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
