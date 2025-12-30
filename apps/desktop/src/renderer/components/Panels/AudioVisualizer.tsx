import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    analyser: AnalyserNode | null;
    level?: number | null;
    width?: number;
    height?: number;
}

export function AudioVisualizer({ analyser, level, width = 360, height = 64 }: AudioVisualizerProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const smoothedHeightsRef = useRef<number[]>([]);
    const levelRef = useRef(0);

    useEffect(() => {
        if (typeof level === 'number') {
            levelRef.current = Math.max(0, Math.min(1, level));
        }
    }, [level]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser ? analyser.frequencyBinCount : 0;
        const dataArray = analyser ? new Uint8Array(bufferLength) : null;

        // Number of bars to show (one side)
        const barCount = 32;
        if (smoothedHeightsRef.current.length !== barCount) {
            smoothedHeightsRef.current = new Array(barCount).fill(0);
        }

        const draw = () => {
            if (analyser && dataArray) {
                analyser.getByteFrequencyData(dataArray);
            }

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const barWidth = (w / (barCount * 2)) * 0.7;
            const barGap = (w / (barCount * 2)) * 0.3;
            const centerY = h / 2;
            const centerX = w / 2;

            // Smoothing factor (lower = smoother/slower, higher = more reactive)
            const smoothing = 0.15;

            for (let i = 0; i < barCount; i++) {
                // Sample frequency data
                let rawValue = 0;
                if (analyser && dataArray) {
                    const step = Math.max(1, Math.floor(bufferLength / (barCount * 1.5)));
                    rawValue = (dataArray[i * step] || 0) / 255;
                } else {
                    const curve = 0.35 + 0.65 * Math.sin((i / barCount) * Math.PI);
                    rawValue = levelRef.current * curve;
                }

                // Apply smoothing
                smoothedHeightsRef.current[i] = smoothedHeightsRef.current[i] * (1 - smoothing) + rawValue * smoothing;
                const value = smoothedHeightsRef.current[i];

                const barHeight = Math.max(4, value * h * 0.9);
                const y = centerY - barHeight / 2;

                // Draw symmetrical bars from center
                // Right side
                const xRight = centerX + i * (barWidth + barGap);
                // Left side
                const xLeft = centerX - (i + 1) * (barWidth + barGap);

                // Create Gradient
                const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

                ctx.fillStyle = gradient;

                // Add Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

                const radius = barWidth / 2;

                // Draw Right
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(xRight, y, barWidth, barHeight, radius);
                } else {
                    ctx.rect(xRight, y, barWidth, barHeight);
                }
                ctx.fill();

                // Draw Left
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(xLeft, y, barWidth, barHeight, radius);
                } else {
                    ctx.rect(xLeft, y, barWidth, barHeight);
                }
                ctx.fill();
            }

            animationFrameRef.current = requestAnimationFrame(draw);
        };

        animationFrameRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [analyser]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}
        />
    );
}
