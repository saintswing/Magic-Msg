import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Download, RefreshCw, FileText, Settings, QrCode, Play, Pause, FastForward } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../components/Layout';

export const Sender: React.FC = () => {
  const { 
    sourceText, 
    setSourceText, 
    
    // Animated UR
    urEncoder,
    currentURFragment,
    isAnimating,
    urFps,
    setURFps,
    initUREncoder,
    setAnimating,
    nextURFragment,
    
    // Static Fallback
    chunkSize, 
    qrChunks, 
    setChunkSize, 
    generateStaticChunks 
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'animated' | 'static'>('animated');
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  
  // 处理动态播放逻辑
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isAnimating && urEncoder) {
      const msPerFrame = 1000 / urFps;
      intervalId = setInterval(() => {
        nextURFragment();
      }, msPerFrame);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAnimating, urEncoder, urFps, nextURFragment]);

  // 当文本变化时，自动重置状态
  useEffect(() => {
    setAnimating(false);
  }, [sourceText, setAnimating]);

  const handleInitAnimated = () => {
    initUREncoder();
    setAnimating(true);
  };

  const handleExportStatic = async () => {
    if (!exportRef.current || qrChunks.length === 0) return;
    
    try {
      setIsExporting(true);
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `qr-bridge-export-${new Date().getTime()}.png`;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出长图失败');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左侧控制区 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                文本输入
              </h2>
            </div>
            
            <textarea
              className="w-full h-64 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-zinc-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="请在此粘贴或输入需要传输的超长文本..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
            
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>总字符数: {sourceText.length}</span>
            </div>
          </div>

          {/* 模式切换卡片 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
              <button
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'animated' ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                )}
                onClick={() => setActiveTab('animated')}
              >
                动态轮播 (主)
              </button>
              <button
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'static' ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                )}
                onClick={() => setActiveTab('static')}
              >
                静态长图 (兜底)
              </button>
            </div>

            {/* 动态轮播设置 */}
            {activeTab === 'animated' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex justify-between">
                    <span className="flex items-center gap-1"><FastForward className="w-4 h-4"/> 播放帧率 (FPS)</span>
                    <span className="text-zinc-200">{urFps}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={urFps}
                    onChange={(e) => setURFps(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-zinc-500">
                    若手机摄像头对焦慢，请降低帧率。
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleInitAnimated}
                    disabled={!sourceText}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新生成
                  </button>
                  
                  {urEncoder && (
                    <button
                      onClick={() => setAnimating(!isAnimating)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                        isAnimating 
                          ? "bg-amber-600 hover:bg-amber-700 text-white" 
                          : "bg-green-600 hover:bg-green-700 text-white"
                      )}
                    >
                      {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isAnimating ? "暂停" : "播放"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 静态长图设置 */}
            {activeTab === 'static' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex justify-between">
                    <span>每块字符数</span>
                    <span className="text-zinc-200">{chunkSize}</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="10"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full accent-zinc-500"
                  />
                </div>

                <button
                  onClick={generateStaticChunks}
                  disabled={!sourceText}
                  className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  生成静态阵列
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧展示区 */}
        <div className="lg:col-span-2">
          {activeTab === 'animated' ? (
            // 动态展示区
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg min-h-[500px] flex flex-col items-center justify-center relative">
              <h2 className="absolute top-5 left-5 text-lg font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-400" />
                动态喷泉码 (UR)
              </h2>
              
              {!urEncoder ? (
                <div className="text-zinc-500 space-y-4 text-center">
                  <QrCode className="w-16 h-16 opacity-20 mx-auto" />
                  <p>输入文本后点击重新生成并播放</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-4 bg-white rounded-2xl shadow-2xl transition-transform duration-75">
                    <QRCodeSVG
                      value={currentURFragment}
                      size={320}
                      level="L" // UR 推荐 Low 容错，依靠外层算法纠错
                      includeMargin={false}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 bg-zinc-950 px-4 py-2 rounded-full border border-zinc-800">
                    <span className="flex h-3 w-3 relative">
                      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isAnimating ? "bg-green-400" : "bg-zinc-500")}></span>
                      <span className={cn("relative inline-flex rounded-full h-3 w-3", isAnimating ? "bg-green-500" : "bg-zinc-500")}></span>
                    </span>
                    <span className="text-zinc-300 font-mono text-sm font-bold">
                      {isAnimating ? "正在广播数据流..." : "广播已暂停"}
                    </span>
                  </div>
                  
                  <p className="text-xs text-zinc-500 max-w-md text-center">
                    请在接收端使用手机摄像头扫描此区域。无论从哪一帧开始扫，只要进度达到 100% 即可还原完整文本。
                  </p>
                </div>
              )}
            </div>
          ) : (
            // 静态展示区
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  静态阵列预览 ({qrChunks.length} 块)
                </h2>
                {qrChunks.length > 0 && (
                  <button
                    onClick={handleExportStatic}
                    disabled={isExporting}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800/50 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? '导出中...' : '导出长图'}
                  </button>
                )}
              </div>

              {qrChunks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
                  <QrCode className="w-16 h-16 opacity-20" />
                  <p>在左侧输入文本并点击生成阵列</p>
                </div>
              ) : (
                <div className="overflow-auto flex-1 bg-zinc-950 rounded-lg border border-zinc-800 p-4">
                  {/* 导出容器 */}
                  <div 
                    ref={exportRef} 
                    className="bg-white p-8 inline-block min-w-full"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {qrChunks.map((chunk) => (
                        <div key={chunk.index} className="flex flex-col items-center space-y-2">
                          <div className="p-2 border-2 border-gray-100 rounded-xl">
                            <QRCodeSVG
                              value={chunk.content}
                              size={140}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <span className="text-gray-600 font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded">
                            [{chunk.index}/{chunk.total}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
