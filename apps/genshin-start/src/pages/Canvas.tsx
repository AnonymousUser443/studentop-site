import './Canvas.less';
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Game } from "../core/Game";
import { gameManager } from '../core/GameManager';

export interface CanvasRef {
  getViewer: () => any;
}

export const Canvas = forwardRef<CanvasRef>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const viewerRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    getViewer: () => viewerRef.current
  }));

  useEffect(() => {
    if (canvasRef.current && !game) {
      const gameInstance = new Game(canvasRef.current);
      setGame(gameInstance);
      viewerRef.current = gameInstance.viewer;
      
      // 监听preloaded事件
      gameManager.on("preloaded", () => {
        console.log('资源加载完成，preloaded事件已触发');
      });
      
      return () => {
        gameInstance.destroy();
      };
    }
  }, [gameManager.restartCount]);

  return (
    <aside className="webgl-wrapper">
      <canvas 
        onClick={() => gameManager.emit("canvas-click")} 
        ref={canvasRef} 
        className="webgl-canvas" 
        style={{ 
          width: "100vw", 
          height: "100vh",
          display: "block"
        }} 
        {...props}
      >
        No Canvas!
      </canvas>
    </aside>
  );
});