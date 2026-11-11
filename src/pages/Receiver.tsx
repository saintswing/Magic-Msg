import React, { useCallback, useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Copy, Trash2, AlertCircle, Camera, StopCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useStore } from '../store';
import { scanImageForQRCodes } from '../utils/qrScanner';
import { cn } from '../components/Layout';

export const Receiver: React.FC = () => {
  const { 
    // UR 
    urDecoder,
    urProgress,
    urDecodedText,
    initURDecoder,
    receiveURFragment,
    
    // Static Fallback
    staticDecodedChunks, 
    addStaticDecodedChunk, 
    clearStaticDecodedChunks, 
    getStaticCompleteText 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'animated' | 'static'>('animated');
  
  // Static State
  const [isScanningStatic, setIsScanningStatic] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animated State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- Animated Camera Logic ---
  
  const startCamera = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }
      
      initURDecoder();
      setIsCameraActive(true);
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          if (decodedText.toUpperCase().startsWith('UR:')) {
            receiveURFragment(decodedText);
          }
        },
        () => {
          // ignore scan errors (empty frames)
        }
      );
    } catch (err) {
      console.error("Camera start failed:", err);
      alert("无法访问摄像头，请确保您已授予权限或在 HTTPS 环境下运行。");
      setIsCameraActive(false);
    }
  };

  const stopCamera = useCallback(async () => {
    if (scannerRef.current && isCameraActive) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Failed to stop camera:", err);
      } finally {
        setIsCameraActive(false);
      }
    }
  }, [isCameraActive]);

  // 当解码完成时自动停止摄像头
  useEffect(() => {
    if (urProgress === 1 && isCameraActive) {
      stopCamera();
    }
  }, [urProgress, isCameraActive, stopCamera]);

  // 卸载组件时清理摄像头
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // --- Static Upload Logic ---

  const totalExpectedStatic = staticDecodedChunks.length > 0 ? staticDecodedChunks[0].total : 0;
  const currentCountStatic = staticDecodedChunks.length;
  const isCompleteStatic = totalExpectedStatic > 0 && currentCountStatic === totalExpectedStatic;
  
  const handleFiles = async (files: FileList | File[]) => {
    setIsScanningStatic(true);
    setScanMessage({ type: 'info', text: `正在扫描 ${files.length} 个文件...` });
    
    let foundCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const chunks = await scanImageForQRCodes(file);
        chunks.forEach((chunk) => {
          addStaticDecodedChunk(chunk);
          foundCount++;
        });
      } catch (err) {
        console.error('Scan error on file', file.name, err);
      }
    }
    
    setIsScanningStatic(false);
    if (foundCount > 0) {
      setScanMessage({ type: 'success', text: `本次扫描识别出 ${foundCount} 个有效内容块！` });
    } else {
      setScanMessage({ type: 'error', text: '未能在图片中识别出有效的内容块。' });
    }
    
    setTimeout(() => setScanMessage(null), 5000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  // --- Copy Logic ---
  
  const handleCopy = () => {
    const text = activeTab === 'animated' ? urDecodedText : getStaticCompleteText();
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板！');
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 顶部模式切换 */}
      <div className="flex justify-center">
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-full max-w-md">
          <button
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === 'animated' ? "bg-blue-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
            onClick={() => {
              setActiveTab('animated');
            }}
          >
            动态喷泉码扫描 (主)
          </button>
          <button
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === 'static' ? "bg-zinc-700 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
            onClick={() => {
              setActiveTab('static');
              if (isCameraActive) stopCamera();
            }}
          >
            静态长图解析 (兜底)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 左侧操作区 */}
        <div className="space-y-6">
          
          {activeTab === 'animated' ? (
            // 动态摄像头区域
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  实时摄像头
                </h2>
              </div>
              
              <div className="w-full aspect-square max-w-sm bg-black rounded-xl overflow-hidden border-2 border-zinc-800 relative">
                {/* html5-qrcode 需要一个明确 ID 的容器 */}
                <div id="reader" className="w-full h-full" />
                
                {!isCameraActive && urProgress !== 1 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10">
                    <Camera className="w-12 h-12 text-zinc-500 mb-4" />
                    <button
                      onClick={startCamera}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
                    >
                      启动摄像头
                    </button>
                  </div>
                )}
                
                {urProgress === 1 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/90 backdrop-blur-md z-10 animate-in fade-in zoom-in">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-green-400">解码成功</h3>
                    <button
                      onClick={() => {
                        initURDecoder();
                        startCamera();
                      }}
                      className="mt-6 px-4 py-2 border border-green-500/50 text-green-400 hover:bg-green-500/10 rounded font-medium transition-colors"
                    >
                      重新扫描
                    </button>
                  </div>
                )}
              </div>

              {isCameraActive && (
                <button
                  onClick={stopCamera}
                  className="mt-6 px-6 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full font-medium transition-colors flex items-center gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  停止扫描
                </button>
              )}

              {/* UR 进度条 */}
              <div className="w-full mt-8 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">解码进度 (自动组装)</span>
                  <span className={cn("font-mono font-bold", urProgress === 1 ? "text-green-400" : "text-blue-400")}>
                    {Math.floor(urProgress * 100)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden p-0.5 border border-zinc-700">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      urProgress === 1 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-blue-500"
                    )}
                    style={{ width: `${Math.max(5, urProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            // 静态上传区域
            <>
              <div 
                className={cn(
                  "bg-zinc-900 border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer h-80",
                  dragActive ? "border-zinc-500 bg-zinc-800" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50",
                  isScanningStatic && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-200 mb-2">点击上传或拖拽图片</h3>
                <p className="text-zinc-500 text-sm max-w-sm">
                  上传长图或多张照片。
                </p>
                
                {isScanningStatic && (
                  <div className="mt-6 flex items-center gap-2 text-blue-400 font-medium">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    正在深度扫描...
                  </div>
                )}
              </div>

              {scanMessage && (
                <div className={cn(
                  "p-4 rounded-lg flex items-center gap-3 border animate-in fade-in slide-in-from-top-2",
                  scanMessage.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-400" : 
                  scanMessage.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  "bg-blue-500/10 border-blue-500/20 text-blue-400"
                )}>
                  {scanMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{scanMessage.text}</span>
                </div>
              )}

              {/* 静态进度展示 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">静态收集进度</h2>
                  {totalExpectedStatic > 0 && (
                    <span className="text-sm font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300">
                      {currentCountStatic} / {totalExpectedStatic}
                    </span>
                  )}
                </div>
                
                {totalExpectedStatic === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">暂无解析数据</p>
                ) : (
                  <div className="space-y-4">
                    <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-zinc-500 h-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, (currentCountStatic / totalExpectedStatic) * 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                      {Array.from({ length: totalExpectedStatic }).map((_, i) => {
                        const index = i + 1;
                        const isFound = staticDecodedChunks.some(c => c.index === index);
                        return (
                          <div 
                            key={index}
                            className={cn(
                              "w-8 h-8 rounded flex items-center justify-center text-xs font-mono font-bold transition-colors",
                              isFound ? "bg-green-600 text-white shadow-sm" : "bg-zinc-800 text-zinc-600 border border-zinc-700 border-dashed"
                            )}
                          >
                            {index}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 结果区 */}
        <div className="h-full flex flex-col">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                解码结果
                {(activeTab === 'animated' ? urProgress === 1 : isCompleteStatic) && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={activeTab === 'animated' ? initURDecoder : clearStaticDecodedChunks}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-300 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  清空
                </button>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  复制文本
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-4 relative group">
              <textarea
                readOnly
                className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none absolute inset-0 p-4"
                value={activeTab === 'animated' ? (urDecodedText || '') : getStaticCompleteText()}
                placeholder="此处将显示解析并还原后的完整文本..."
              />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};
