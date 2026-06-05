
/**
 * Utility to append version parameter to image URLs for cache invalidation.
 */
export function getVersionedImageUrl(url: string | undefined, version?: number): string {
  if (!url) return "";
  if (!version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

export const IMAGE_CACHE_METADATA = {
  cacheControl: 'public,max-age=31536000,immutable',
};
