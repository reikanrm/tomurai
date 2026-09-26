/** Opens a category search only. Never add case details or coordinates here. */
export function googleMapsSearchUrl(category: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(category);
}
