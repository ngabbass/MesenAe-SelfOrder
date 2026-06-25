export async function uploadToCloudinary(
  bucket: string,
  fileName: string,
  file: File | Blob | string
): Promise<string | null> {
  try {
    let fileToUpload: File | Blob;

    if (typeof file === 'string' && file.startsWith('data:')) {
      const res = await fetch(file);
      fileToUpload = await res.blob();
    } else if (file instanceof Blob || file instanceof File) {
      fileToUpload = file;
    } else {
      return null;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Cloudinary env variables missing.");
      throw new Error("Konfigurasi Cloudinary (Env API Keys) belum diatur! Gambar gagal diunggah.");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      folder: bucket,
      timestamp: timestamp,
    };

    const sortedKeys = Object.keys(params).sort();
    const sortedParamsStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const strToSign = sortedParamsStr + apiSecret;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', bucket);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || response.statusText);
    }

    return result.secure_url;
  } catch (err: any) {
    console.error('[Cloudinary] Exception during upload:', err);
    throw new Error(err.message || 'Terjadi kesalahan saat menghubungi server Cloudinary.');
  }
}

export async function deleteFromCloudinary(url: string | null | undefined): Promise<boolean> {
  if (!url || !url.includes('cloudinary.com')) return false;

  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return false;
    
    const pathAfterUpload = parts.slice(uploadIndex + 1);
    let publicIdWithExtension = pathAfterUpload.join('/');
    
    if (/^v\d+\//.test(publicIdWithExtension)) {
      publicIdWithExtension = publicIdWithExtension.replace(/^v\d+\//, '');
    }
    
    const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
    const publicId = lastDotIndex !== -1 ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return false;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      public_id: publicId,
      timestamp: timestamp,
    };

    const sortedKeys = Object.keys(params).sort();
    const sortedParamsStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const strToSign = sortedParamsStr + apiSecret;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    return result.result === 'ok';
  } catch (err) {
    console.error('[Cloudinary] Exception during delete:', err);
    return false;
  }
}
