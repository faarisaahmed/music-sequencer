// Album cover images: centre-cropped to a square and stored as JPEG data URLs.

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this browser can open"));
    };
    img.src = url;
  });
}

function square(img: HTMLImageElement, size: number, quality: number): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const out = Math.min(size, side);
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, out, out);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
  return c.toDataURL('image/jpeg', quality);
}

/** Make a cover (up to 1000 px) and a song-browser thumbnail from an image file. */
export async function makeCover(file: Blob): Promise<{ cover: string; thumb: string; small: boolean }> {
  const img = await loadImage(file);
  return {
    cover: square(img, 1000, 0.9),
    thumb: square(img, 320, 0.82),
    small: Math.min(img.naturalWidth, img.naturalHeight) < 500,
  };
}
