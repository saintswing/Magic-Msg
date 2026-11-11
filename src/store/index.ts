import { create } from 'zustand';
import { UREncoder, URDecoder, UR } from '@ngraveio/bc-ur';

export interface QRCodeChunk {
  index: number; // 1-based
  total: number;
  content: string; // [CHUNK:1/5]xxxxx
  rawText: string;
}

export interface DecodedChunk extends QRCodeChunk {
  id: string;
}

interface AppState {
  // ---------------------------------
  // Common Sender
  // ---------------------------------
  sourceText: string;
  setSourceText: (text: string) => void;
  
  // ---------------------------------
  // Animated Sender (UR Protocol)
  // ---------------------------------
  urEncoder: UREncoder | null;
  currentURFragment: string;
  isAnimating: boolean;
  urFps: number; // Frames per second
  setURFps: (fps: number) => void;
  initUREncoder: () => void;
  setAnimating: (isAnimating: boolean) => void;
  nextURFragment: () => void;
  
  // ---------------------------------
  // Static Sender (Fallback)
  // ---------------------------------
  chunkSize: number;
  qrChunks: QRCodeChunk[];
  setChunkSize: (size: number) => void;
  generateStaticChunks: () => void;
  
  // ---------------------------------
  // Animated Receiver (UR Protocol)
  // ---------------------------------
  urDecoder: URDecoder | null;
  urProgress: number; // 0.0 to 1.0
  urDecodedText: string | null;
  initURDecoder: () => void;
  receiveURFragment: (fragment: string) => void;
  
  // ---------------------------------
  // Static Receiver (Fallback)
  // ---------------------------------
  staticDecodedChunks: DecodedChunk[];
  addStaticDecodedChunk: (chunk: QRCodeChunk) => void;
  clearStaticDecodedChunks: () => void;
  getStaticCompleteText: () => string;
}

const CHUNK_PREFIX_REGEX = /^\[CHUNK:(\d+)\/(\d+)\]([\s\S]*)$/;

export const useStore = create<AppState>((set, get) => ({
  // ---------------------------------
  // Common
  // ---------------------------------
  sourceText: '',
  setSourceText: (text) => set({ sourceText: text }),

  // ---------------------------------
  // Animated Sender (UR)
  // ---------------------------------
  urEncoder: null,
  currentURFragment: '',
  isAnimating: false,
  urFps: 10,
  
  setURFps: (fps) => set({ urFps: fps }),
  
  initUREncoder: () => {
    const { sourceText } = get();
    if (!sourceText) {
      set({ urEncoder: null, currentURFragment: '', isAnimating: false });
      return;
    }
    
    // 使用 TextEncoder 处理中文，确保 UR 编码的是正确的 UTF-8 Buffer
    const textBuffer = new TextEncoder().encode(sourceText);
    // bc-ur 需要 Buffer
    const buffer = Buffer.from(textBuffer);
    
    // 将数据封装为 UR 对象。'bytes' 是通用的二进制载荷类型。
    const ur = UR.fromBuffer(buffer);
    
    // 初始化编码器，设置每个分片的最大长度（字节）。
    // 250 是一个比较安全的数值，保证二维码不会过密，同时兼容旧设备。
    const encoder = new UREncoder(ur, 250);
    
    set({
      urEncoder: encoder,
      currentURFragment: encoder.nextPart().toUpperCase(), // 大写对二维码识别更友好
      isAnimating: false,
    });
  },
  
  setAnimating: (isAnimating) => set({ isAnimating }),
  
  nextURFragment: () => {
    const { urEncoder } = get();
    if (urEncoder) {
      set({ currentURFragment: urEncoder.nextPart().toUpperCase() });
    }
  },

  // ---------------------------------
  // Static Sender (Fallback)
  // ---------------------------------
  chunkSize: 150,
  qrChunks: [],
  setChunkSize: (size) => set({ chunkSize: size }),
  generateStaticChunks: () => {
    const { sourceText, chunkSize } = get();
    if (!sourceText) {
      set({ qrChunks: [] });
      return;
    }
    
    const chunks: QRCodeChunk[] = [];
    const total = Math.ceil(sourceText.length / chunkSize);
    
    for (let i = 0; i < total; i++) {
      const rawText = sourceText.slice(i * chunkSize, (i + 1) * chunkSize);
      const index = i + 1;
      chunks.push({
        index,
        total,
        content: `[CHUNK:${index}/${total}]${rawText}`,
        rawText,
      });
    }
    
    set({ qrChunks: chunks });
  },

  // ---------------------------------
  // Animated Receiver (UR)
  // ---------------------------------
  urDecoder: null,
  urProgress: 0,
  urDecodedText: null,
  
  initURDecoder: () => {
    set({
      urDecoder: new URDecoder(),
      urProgress: 0,
      urDecodedText: null,
    });
  },
  
  receiveURFragment: (fragment: string) => {
    const { urDecoder } = get();
    if (!urDecoder || urDecoder.isComplete()) return;
    
    try {
      urDecoder.receivePart(fragment);
      
      const progress = urDecoder.estimatedPercentComplete();
      
      if (urDecoder.isComplete()) {
        if (urDecoder.isSuccess()) {
          const ur = urDecoder.resultUR();
          const buffer = ur.decodeCBOR();
          // 使用 TextDecoder 还原中文字符
          const text = new TextDecoder('utf-8').decode(buffer);
          set({ urProgress: 1, urDecodedText: text });
        } else {
          // Checksum error or something else
          console.error("UR Decoder failed: Invalid Checksum");
          set({ urProgress: 1, urDecodedText: "[解码失败: 数据校验错误]" });
        }
      } else {
        set({ urProgress: progress });
      }
    } catch (e) {
      // 捕获可能的非法分片格式，避免崩溃
      console.warn("Invalid UR fragment received:", e);
    }
  },

  // ---------------------------------
  // Static Receiver (Fallback)
  // ---------------------------------
  staticDecodedChunks: [],
  addStaticDecodedChunk: (chunk) => {
    set((state) => {
      const id = `${chunk.index}-${chunk.total}`;
      if (state.staticDecodedChunks.some((c) => c.id === id)) {
        return state;
      }
      return {
        staticDecodedChunks: [...state.staticDecodedChunks, { ...chunk, id }],
      };
    });
  },
  clearStaticDecodedChunks: () => set({ staticDecodedChunks: [] }),
  getStaticCompleteText: () => {
    const { staticDecodedChunks } = get();
    if (staticDecodedChunks.length === 0) return '';
    const sorted = [...staticDecodedChunks].sort((a, b) => a.index - b.index);
    return sorted.map((c) => c.rawText).join('');
  },
}));

// 工具函数：解析静态模式文本
export const parseDecodedText = (text: string): QRCodeChunk | null => {
  const match = text.match(CHUNK_PREFIX_REGEX);
  if (!match) return null;
  
  const index = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  const rawText = match[3];
  
  return {
    index,
    total,
    content: text,
    rawText,
  };
};
