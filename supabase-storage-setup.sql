-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('inventory-images', 'inventory-images', true)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('log-images', 'log-images', true)
ON CONFLICT DO NOTHING;

-- Add image_url columns to tables
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE maintenance_logs 
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Storage policies for authenticated users to upload images
CREATE POLICY "Authenticated users can upload asset images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-images');

CREATE POLICY "Authenticated users can upload inventory images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-images');

CREATE POLICY "Authenticated users can upload log images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'log-images');

-- Public can view images
CREATE POLICY "Public can view asset images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'asset-images');

CREATE POLICY "Public can view inventory images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'inventory-images');

CREATE POLICY "Public can view log images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'log-images');

-- Authenticated users can update their own images
CREATE POLICY "Users can update asset images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'asset-images');

CREATE POLICY "Users can update inventory images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'inventory-images');

CREATE POLICY "Users can update log images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'log-images');

-- Authenticated users can delete their own images
CREATE POLICY "Users can delete asset images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'asset-images');

CREATE POLICY "Users can delete inventory images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'inventory-images');

CREATE POLICY "Users can delete log images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'log-images');