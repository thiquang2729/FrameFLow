export const SOURCE_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'jpg', 'jpeg', 'png']

export function isSourceImage(filePath: string): boolean {
  return /\.(jpe?g|png)$/i.test(filePath)
}
