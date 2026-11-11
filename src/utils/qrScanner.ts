import jsQR from 'jsqr';
import { parseDecodedText, QRCodeChunk } from '../store';

// 等比缩放图片以加快处理速度，限制最大宽度
const MAX_IMAGE_WIDTH = 2000;

export const scanImageForQRCodes = async (file: File): Promise<QRCodeChunk[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.floor((height * MAX_IMAGE_WIDTH) / width);
        width = MAX_IMAGE_WIDTH;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      const chunksMap = new Map<string, QRCodeChunk>();
      
      // 辅助函数：扫描指定区域
      const scanRect = (x: number, y: number, w: number, h: number) => {
        const imageData = ctx.getImageData(x, y, w, h);
        const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
        if (code) {
          // 强制使用 utf-8 解码二进制数据，解决中文字符乱码问题
          let text = code.data;
          try {
            if (code.binaryData && code.binaryData.length > 0) {
              const uint8array = new Uint8Array(code.binaryData);
              text = new TextDecoder('utf-8').decode(uint8array);
            }
          } catch (e) {
            console.warn("UTF-8 Decode failed, fallback to default text", e);
          }
          
          const chunk = parseDecodedText(text);
          if (chunk) {
            chunksMap.set(`${chunk.index}-${chunk.total}`, chunk);
          }
        }
      };
      
      // 1. 全图扫描
      scanRect(0, 0, width, height);
      
      // 2. 网格分块扫描 (应对长图中包含多个二维码的情况)
      // 尝试不同的网格密度，比如 2x2 到 8x8
      const gridSizes = [2, 3, 4, 5, 6, 8, 10];
      
      for (const grids of gridSizes) {
        const cellW = Math.floor(width / grids);
        const cellH = Math.floor(height / grids);
        
        // 增加一点重叠区域，防止二维码刚好在边界被切断
        const overlapX = Math.floor(cellW * 0.2);
        const overlapY = Math.floor(cellH * 0.2);
        
        for (let row = 0; row < grids; row++) {
          for (let col = 0; col < grids; col++) {
            const startX = Math.max(0, col * cellW - overlapX);
            const startY = Math.max(0, row * cellH - overlapY);
            const endX = Math.min(width, (col + 1) * cellW + overlapX);
            const endY = Math.min(height, (row + 1) * cellH + overlapY);
            
            scanRect(startX, startY, endX - startX, endY - startY);
          }
        }
      }
      
      resolve(Array.from(chunksMap.values()));
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    
    img.src = url;
  });
};
