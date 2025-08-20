import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, Image as ImageIcon, Loader } from 'lucide-react';

export default function ImageUpload({ 
  bucket, 
  currentImageUrl, 
  onImageUploaded, 
  onImageRemoved,
  multiple = false 
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImageUrl);
  const [error, setError] = useState('');

  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setUploading(true);

    try {
      if (multiple) {
        // Handle multiple file upload for logs
        const uploadedUrls = [];
        
        for (const file of files) {
          const fileUrl = await uploadFile(file);
          if (fileUrl) uploadedUrls.push(fileUrl);
        }
        
        onImageUploaded(uploadedUrls);
      } else {
        // Handle single file upload
        const file = files[0];
        const fileUrl = await uploadFile(file);
        
        if (fileUrl) {
          setPreview(fileUrl);
          onImageUploaded(fileUrl);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file');
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size should be less than 5MB');
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleRemoveImage = async () => {
    if (!preview) return;

    setUploading(true);
    try {
      // Extract file name from URL
      const urlParts = preview.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error } = await supabase.storage
        .from(bucket)
        .remove([fileName]);

      if (error) throw error;

      setPreview(null);
      onImageRemoved();
    } catch (error) {
      console.error('Error removing image:', error);
      setError('Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {multiple ? 'Images' : 'Image'}
      </label>
      
      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      {!multiple && preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-32 object-cover rounded-lg border border-gray-300"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            disabled={uploading}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <>
                  <Loader className="h-8 w-8 text-gray-400 animate-spin" />
                  <p className="mb-2 text-sm text-gray-500 mt-2">
                    Uploading...
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 mt-2">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple={multiple}
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {multiple && (
        <p className="text-xs text-gray-500">
          You can select multiple images at once
        </p>
      )}
    </div>
  );
}