import React, { useRef, useEffect, useState } from 'react';
import { Canvas, CanvasRef } from './pages/Canvas';
import { Menu } from './pages/Menu';
import { Preloader } from './pages/Preloader';
import { gameManager } from './core/GameManager';
import './App.css';

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerInstance, setViewerInstance] = useState<any>(null);
  const canvasRef = useRef<CanvasRef>(null);

  useEffect(() => {
    // 监听游戏管理器的状态
    gameManager.on("preloaded", () => {
      setLoading(false);
      console.log('《原神启动》游戏初始化完成 - 帧率限制已解除');
    });
    
    gameManager.on("restart", () => {
      setLoading(true);
      setError(null);
    });

    // 获取Viewer实例并传递给FPS监控组件
    const getViewerInstance = () => {
      if (canvasRef.current) {
        const viewer = canvasRef.current.getViewer();
        if (viewer) {
          setViewerInstance(viewer);
        }
      }
    };

    // 延迟获取Viewer实例，确保Canvas已初始化
    const timer = setTimeout(getViewerInstance, 1000);

    // 清理函数
    return () => {
      clearTimeout(timer);
      gameManager.reset();
    };
  }, []);

  if (error) {
    return (
      <div className="App">
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'red',
          fontSize: '18px'
        }}>
          <h2>错误</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Canvas ref={canvasRef} />
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          fontSize: '18px',
          zIndex: 1000
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '3px solid #333',
              borderTop: '3px solid #4CAF50',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            正在启动《原神启动》...
            <br />
            <span style={{ fontSize: '14px', color: '#ccc' }}>
              帧率限制已解除，性能优化已启用
            </span>
          </div>
        </div>
      )}
      
      {/* 加载进度（白底，进度满后自动淡出） */}
      <Preloader />

      {/* 登录界面：预加载完成后挂载；点开始 → 沿路前行 → 门 → 点击开门 → 跳转目标站点 */}
      {!loading && <Menu />}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .webgl-canvas {
          image-rendering: auto !important;
          image-rendering: optimizeSpeed !important;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
        }
        
        * {
          box-sizing: border-box;
        }
      `}</style>
    </>
  );
}