import React, { useState, useEffect, useRef } from 'react';

interface FPSMonitorProps {
  viewer?: any; // xviewer Viewer实例
}

const FPSMonitor: React.FC<FPSMonitorProps> = ({ viewer }) => {
  const [fps, setFps] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationFrame = useRef<number>();

  useEffect(() => {
    if (!viewer) return;

    const measureFPS = (currentTime: number) => {
      frameCount.current++;
      
      // 每秒更新一次FPS
      if (currentTime - lastTime.current >= 1000) {
        const currentFps = Math.round((frameCount.current * 1000) / (currentTime - lastTime.current));
        setFps(currentFps);
        
        frameCount.current = 0;
        lastTime.current = currentTime;
      }
      
      // 继续监控
      animationFrame.current = requestAnimationFrame(measureFPS);
    };

    // 开始监控
    animationFrame.current = requestAnimationFrame(measureFPS);

    // 清理函数
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [viewer]);

  // 获取FPS状态颜色
  const getFPSColor = () => {
    if (fps >= 50) return '#4CAF50'; // 绿色 - 良好
    if (fps >= 30) return '#FF9800'; // 橙色 - 一般
    return '#F44336'; // 红色 - 较差
  };

  // 切换显示/隐藏
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 10000,
          background: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}
      >
        显示FPS
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        border: '2px solid ' + getFPSColor(),
        borderRadius: '8px',
        padding: '12px',
        minWidth: '80px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontSize: '14px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#ccc' }}>
        渲染性能
      </div>
      
      <div
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: getFPSColor(),
          marginBottom: '4px',
          textShadow: '0 0 4px rgba(0, 0, 0, 0.5)'
        }}
      >
        {fps}
      </div>
      
      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '8px' }}>
        FPS
      </div>
      
      {/* FPS状态指示器 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '8px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: fps >= 50 ? '#4CAF50' : '#333'
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: fps >= 30 ? '#FF9800' : '#333'
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: fps > 0 ? '#F44336' : '#333'
          }}
        />
      </div>
      
      {/* 性能等级 */}
      <div style={{ 
        fontSize: '10px', 
        color: '#ccc',
        borderTop: '1px solid #444',
        paddingTop: '6px'
      }}>
        {fps >= 50 ? '优秀' : fps >= 30 ? '良好' : '需优化'}
      </div>
      
      {/* 隐藏按钮 */}
      <button
        onClick={toggleVisibility}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: 'none',
          border: 'none',
          color: '#ccc',
          cursor: 'pointer',
          fontSize: '12px',
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '2px'
        }}
        title="隐藏FPS显示"
      >
        ×
      </button>
    </div>
  );
};

export default FPSMonitor;