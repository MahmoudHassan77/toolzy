// ── Image Extraction for PDF-to-Word ─────────────────────────────────────────
// Extracts embedded images from a PDF page using pdfjs operator list.

import { OPS } from 'pdfjs-dist'

export interface ExtractedImage {
  data: Uint8Array
  width: number
  height: number
  /** X position on the page (from the transform matrix) */
  x: number
  /** Y position on the page (from the transform matrix) */
  y: number
}

/**
 * Convert raw RGBA image data to a PNG-encoded Uint8Array using an offscreen canvas.
 */
function rgbaToPng(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get 2d context'))
        return
      }

      const imageData = new ImageData(
        new Uint8ClampedArray(rgbaData),
        width,
        height,
      )
      ctx.putImageData(imageData, 0, 0)

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob returned null'))
          return
        }
        blob.arrayBuffer().then(ab => {
          resolve(new Uint8Array(ab))
        }).catch(reject)
      }, 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Ensure image data is RGBA (4 channels per pixel).
 * pdfjs image data can be RGB (3 bytes/pixel) or RGBA (4 bytes/pixel).
 */
function ensureRGBA(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array | Uint8ClampedArray {
  const expectedRGBA = width * height * 4
  if (data.length === expectedRGBA) return data

  const expectedRGB = width * height * 3
  if (data.length === expectedRGB) {
    // Convert RGB to RGBA
    const rgba = new Uint8Array(expectedRGBA)
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i]
      rgba[j + 1] = data[i + 1]
      rgba[j + 2] = data[i + 2]
      rgba[j + 3] = 255 // fully opaque
    }
    return rgba
  }

  // Unknown format — return as-is, hoping it's close enough
  return data
}

/**
 * Extract all images from a PDF page.
 * Uses the operator list to find paintImageXObject and paintInlineImageXObject ops.
 *
 * @param page - A pdfjs PDFPageProxy
 * @returns Array of extracted images. May be empty if no images or extraction fails.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractImages(page: any): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = []

  try {
    const opList = await page.getOperatorList()
    const { fnArray, argsArray } = opList

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i]

      try {
        if (fn === OPS.paintImageXObject) {
          // args: [imgName, width, height]
          const imgName: string = argsArray[i][0]
          if (!imgName) continue

          // Get the image object from the page's object store
          let imgObj: any
          try {
            imgObj = page.objs.get(imgName)
          } catch {
            // Object not available yet — try commonObjs
            try {
              imgObj = page.commonObjs.get(imgName)
            } catch {
              continue
            }
          }

          if (!imgObj || !imgObj.data || !imgObj.width || !imgObj.height) continue

          // Skip very small images (likely artifacts, not real content images)
          if (imgObj.width < 10 || imgObj.height < 10) continue

          const rgbaData = ensureRGBA(imgObj.data, imgObj.width, imgObj.height)
          const pngData = await rgbaToPng(rgbaData, imgObj.width, imgObj.height)

          // Try to get position from transform matrix in nearby ops
          // The transform is typically set just before the image paint op
          let x = 0
          let y = 0
          // Look backwards for the most recent transform
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (fnArray[j] === OPS.transform) {
              const tm = argsArray[j]
              if (Array.isArray(tm) && tm.length >= 6) {
                x = tm[4]
                y = tm[5]
              }
              break
            }
          }

          images.push({
            data: pngData,
            width: imgObj.width,
            height: imgObj.height,
            x,
            y,
          })
        } else if (fn === OPS.paintInlineImageXObject) {
          // Inline images have the data directly in the args
          const imgObj: any = argsArray[i][0]
          if (!imgObj || !imgObj.data || !imgObj.width || !imgObj.height) continue

          // Skip very small images
          if (imgObj.width < 10 || imgObj.height < 10) continue

          const rgbaData = ensureRGBA(imgObj.data, imgObj.width, imgObj.height)
          const pngData = await rgbaToPng(rgbaData, imgObj.width, imgObj.height)

          let x = 0
          let y = 0
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (fnArray[j] === OPS.transform) {
              const tm = argsArray[j]
              if (Array.isArray(tm) && tm.length >= 6) {
                x = tm[4]
                y = tm[5]
              }
              break
            }
          }

          images.push({
            data: pngData,
            width: imgObj.width,
            height: imgObj.height,
            x,
            y,
          })
        }
      } catch {
        // Skip this particular image op on error, continue with the rest
        continue
      }
    }
  } catch {
    // If the whole operator list extraction fails, return empty
    return []
  }

  return images
}
