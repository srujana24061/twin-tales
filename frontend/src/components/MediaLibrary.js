import { useState, useRef } from 'react';
import { Upload, Video, Image as ImageIcon, X, Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

export function MediaLibrary({ onMediaSelect }) {
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => 
      f.type.startsWith('video/') || f.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      toast.error('Please upload video or image files');
      return;
    }

    setUploading(true);

    for (const file of validFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        toast.info(`Uploading ${file.name}...`);

        // Get presigned URL
        const { data: presignedData } = await api.post('/media/presigned-url', null, {
          params: { filename: file.name, content_type: file.type }
        });

        // Upload to S3
        await fetch(presignedData.presigned_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });

        // Add to media library
        const newItem = {
          id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          url: presignedData.s3_url,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          thumbnail: file.type.startsWith('image/') ? presignedData.s3_url : null,
          duration: 5, // Default duration, can be updated later
          size: file.size
        };

        setMediaItems(prev => [...prev, newItem]);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        toast.success(`${file.name} uploaded!`);

        // Auto-select for quick adding
        onMediaSelect?.(newItem);

      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(err);
      } finally {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }

    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-primary');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-primary');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-primary');
  };

  const removeMedia = (id) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
    toast.success('Media removed from library');
  };

  const handleMediaDragStart = (e, item) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Media Library
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {mediaItems.length}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg gap-1.5"
            style={{ background: 'var(--primary)', color: 'white' }}
            data-testid="upload-media-btn"
          >
            {uploading ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-3 h-3" /> Upload</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* Upload progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="space-y-1">
            {Object.entries(uploadProgress).map(([name, progress]) => (
              <div key={name} className="text-xs flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {name}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>{progress}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drop Zone */}
      {mediaItems.length === 0 && (
        <div
          ref={dropZoneRef}
          className="m-4 p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer"
          style={{ borderColor: 'var(--glass-border)' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          data-testid="media-drop-zone"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Upload className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Drop files here or click to upload
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Supports videos and images
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {mediaItems.map(item => (
            <div
              key={item.id}
              className="relative group rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)' }}
              draggable
              onDragStart={(e) => handleMediaDragStart(e, item)}
              data-testid={`media-item-${item.id}`}
            >
              {/* Thumbnail */}
              <div className="aspect-video flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                {item.type === 'video' ? (
                  item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Video className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
                  )
                ) : (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {item.name}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {item.type === 'video' ? <Video className="w-2.5 h-2.5 inline mr-1" /> : <ImageIcon className="w-2.5 h-2.5 inline mr-1" />}
                  {(item.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>

              {/* Remove button */}
              <button
                className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: '#ef444480' }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeMedia(item.id);
                }}
                data-testid={`remove-media-${item.id}`}
              >
                <X className="w-3 h-3 text-white" />
              </button>

              {/* Drag indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: '#00000040' }}>
                <span className="text-xs font-medium text-white px-2 py-1 rounded"
                  style={{ background: 'var(--primary)' }}>
                  Drag to timeline
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {mediaItems.length > 0 && (
        <div className="px-4 py-2 border-t text-[10px] text-center" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-tertiary)' }}>
          💡 Drag media to timeline or click Upload to add more
        </div>
      )}
    </div>
  );
}
