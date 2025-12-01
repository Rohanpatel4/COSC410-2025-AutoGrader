import React, { useEffect, useState } from "react";
import { Trophy, Sparkles, Star } from "lucide-react";

interface CelebrationProps {
  show: boolean;
  onComplete?: () => void;
  score?: number;
  total?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
}

const PARTICLE_COLORS = [
  "#c7b37f", // Khaki/gold
  "#886e4c", // Old gold
  "#d4af37", // Metallic gold
  "#f5e6c4", // Light gold
  "#a08050", // Bronze gold
];

export const Celebration: React.FC<CelebrationProps> = ({ 
  show, 
  onComplete,
  score,
  total 
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      
      // Generate particles
      const newParticles: Particle[] = [];
      for (let i = 0; i < 30; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
          size: Math.random() * 8 + 4,
          duration: Math.random() * 2 + 2,
          delay: Math.random() * 0.5,
        });
      }
      setParticles(newParticles);

      // Auto-dismiss after animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-none celebration-overlay"
      onClick={() => {
        setIsVisible(false);
        onComplete?.();
      }}
    >
      {/* Particle container */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute bottom-0 celebration-particle"
            style={{
              left: `${particle.x}%`,
              "--duration": `${particle.duration}s`,
              "--delay": `${particle.delay}s`,
            } as React.CSSProperties}
          >
            <div
              className="rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size}px ${particle.color}`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Center celebration card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div 
          className="celebration-card bg-card/95 backdrop-blur-md border border-primary/30 rounded-2xl p-8 shadow-2xl max-w-sm mx-4 text-center relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 celebration-shimmer pointer-events-none" />
          
          {/* Sparkles around the trophy */}
          <div className="relative inline-block mb-4">
            <div className="absolute -top-2 -left-2 celebration-sparkle" style={{ "--delay": "0s" } as React.CSSProperties}>
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="absolute -top-2 -right-2 celebration-sparkle" style={{ "--delay": "0.3s" } as React.CSSProperties}>
              <Star className="w-4 h-4 text-accent fill-accent" />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 celebration-sparkle" style={{ "--delay": "0.6s" } as React.CSSProperties}>
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            
            {/* Trophy icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center celebration-pulse">
              <Trophy className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          {/* Text content */}
          <h2 className="text-2xl font-bold text-foreground mb-2 relative">
            Perfect Score!
          </h2>
          
          {score !== undefined && total !== undefined && (
            <p className="text-lg font-semibold text-primary mb-3">
              {score} / {total}
            </p>
          )}
          
          <p className="text-muted-foreground text-sm relative">
            Excellent work! All test cases passed.
          </p>

          {/* Dismiss hint */}
          <p className="text-xs text-muted-foreground/60 mt-4 relative">
            Click anywhere to dismiss
          </p>
        </div>
      </div>
    </div>
  );
};

export default Celebration;

