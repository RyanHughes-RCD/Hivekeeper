// Little Bee Haven — floating text and particle bursts (drawn in scene/world coordinates).
import { ellipse, sparkle, drawHeart } from './art.js';

const CONFETTI = ['#ff8fab', '#ffd23f', '#8ec9ff', '#b79ae8', '#9be08a', '#ffffff'];

export class Fx {
  constructor(textSize = 11, scale = 1) { this.items = []; this.textSize = textSize; this.scale = scale; }

  text(x, y, text, color = '#c97b10', size = this.textSize) {
    // nudge stacked texts apart
    const near = this.items.filter((i) => i.kind === 'text' && Math.abs(i.x - x) < 30 && i.life > 0.8).length;
    this.items.push({ kind: 'text', x, y: y - near * size * 1.2, vy: -14 * this.scale, life: 1.6, max: 1.6, text, color, size });
  }

  burst(x, y, type = 'sparkle', n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (14 + Math.random() * 30) * this.scale;
      this.items.push({
        kind: type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 22 * this.scale,
        life: 0.7 + Math.random() * 0.6, max: 1.3, r: (1.2 + Math.random() * 2) * this.scale,
        color: type === 'confetti' ? CONFETTI[i % CONFETTI.length] : null, rot: Math.random() * 6,
      });
    }
  }

  update(dt) {
    for (const p of this.items) {
      p.life -= dt;
      if (p.kind === 'text') { p.y += p.vy * dt; p.vy *= 0.97; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.kind === 'petal' || p.kind === 'leaf' ? 25 : 55) * this.scale * dt;
      p.vx *= 0.98; p.rot += dt * 6;
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.items) {
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
      ctx.globalAlpha = a;
      switch (p.kind) {
        case 'text': {
          ctx.font = `800 ${p.size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(3, p.size * 0.3);
          ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          break;
        }
        case 'pollen': ellipse(ctx, p.x, p.y, p.r, p.r, '#ffd84d', '#e0a51f', 0.5); break;
        case 'honey': ellipse(ctx, p.x, p.y, p.r * 1.2, p.r * 1.4, '#ffb81c', '#c97b10', 0.5); break;
        case 'leaf': ellipse(ctx, p.x, p.y, p.r * 1.3, p.r * 0.7, '#8fd18b'); break;
        case 'petal': ellipse(ctx, p.x, p.y, p.r * 1.2, p.r * 0.7, '#ffc1d6'); break;
        case 'heart': drawHeart(ctx, p.x, p.y, p.r * 1.6, '#ff8fab'); break;
        case 'confetti':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
          ctx.restore();
          break;
        default: sparkle(ctx, p.x, p.y, p.r * 1.6, '#fff6b0');
      }
      ctx.globalAlpha = 1;
    }
  }
}
