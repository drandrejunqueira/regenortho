'use client'

import { useEffect, useRef } from 'react'
import anime from 'animejs'

export function AnimatedCell() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 1. Animação de desenho das linhas (line drawing) parecendo uma regeneração
    anime({
      targets: '.cell-path',
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: 'easeInOutSine',
      duration: 3500,
      delay: anime.stagger(150),
      direction: 'alternate',
      loop: true
    });

    // 2. Animação 3D de levitação Isométrica entre as camadas!
    // Usamos o translateZ para separar as camadas no eixo Z (profundidade)
    anime({
      targets: '.iso-layer',
      translateZ: function(_el: any, i: number, _l: number) {
        // Aumenta o espaçamento das camadas (layer 0 fica em baixo, layer 2 sobe mais)
        return (i * 40) + 10; 
      },
      rotateZ: [0, 90],
      scale: [0.95, 1.05],
      duration: 4000,
      easing: 'easeInOutQuad',
      direction: 'alternate',
      loop: true,
      delay: anime.stagger(300)
    });

    // 3. Pulso do núcleo vital (dourado e teal)
    anime({
      targets: '.cell-core',
      scale: [0.7, 1.2],
      opacity: [0.6, 1],
      fill: ['#006876', '#58e6ff'],
      duration: 1500,
      easing: 'easeInOutSine',
      direction: 'alternate',
      loop: true
    });

    // 4. Órbita circular
    anime({
      targets: '.cell-orbit',
      rotateZ: '360deg',
      duration: 8000,
      easing: 'linear',
      loop: true
    });
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full flex items-center justify-center overflow-hidden" style={{ perspective: '1200px' }}>
      
      {/* Container principal rodado no eixo X para dar perspectiva 3D Isométrica */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(45deg)' }}>
        
        {/* LAYER 1 - BASE FUNDA */}
        <svg className="iso-layer absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ transformStyle: 'preserve-3d' }}>
          <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="rgba(0,104,118,0.05)" stroke="rgba(0,104,118,0.2)" strokeWidth="1.5" className="cell-path" />
          {/* Fundo do núcleo espalhado */}
          <circle cx="50" cy="50" r="30" fill="rgba(0,104,118,0.1)" stroke="none" />
        </svg>

        {/* LAYER 2 - ESTRUTURA MÉDIA (LIGAÇÕES) */}
        <svg className="iso-layer absolute inset-0 w-full h-full drop-shadow-lg" viewBox="0 0 100 100" style={{ transformStyle: 'preserve-3d' }}>
          {/* Hexágono interno traçado */}
          <polygon points="50,15 85,32 85,68 50,85 15,68 15,32" fill="none" stroke="#00BCD4" strokeWidth="1" strokeDasharray="2 4" className="cell-path" />
          
          {/* Fios de energia ligando o centro aos vértices */}
          <line x1="50" y1="50" x2="50" y2="15" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          <line x1="50" y1="50" x2="85" y2="32" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          <line x1="50" y1="50" x2="85" y2="68" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          <line x1="50" y1="50" x2="50" y2="85" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          <line x1="50" y1="50" x2="15" y2="68" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          <line x1="50" y1="50" x2="15" y2="32" stroke="rgba(0,188,228,0.6)" strokeWidth="1" className="cell-path" />
          
          <circle cx="50" cy="50" r="22" fill="none" stroke="#00BCD4" strokeWidth="0.5" className="cell-path cell-orbit" strokeDasharray="10 5" />
        </svg>

        {/* LAYER 3 - NÚCLEO TOPO (BIOLOGIA REGENERATIVA) */}
        <svg className="iso-layer absolute inset-0 w-full h-full drop-shadow-2xl" viewBox="0 0 100 100" style={{ transformStyle: 'preserve-3d' }}>
          {/* Anel de ouro brilhante flotando ao redor do núcleo */}
          <circle cx="50" cy="50" r="16" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="6 3" className="cell-path cell-orbit" style={{ transformOrigin: '50px 50px' }} />
          
          {/* Núcleo central que pulsa */}
          <circle cx="50" cy="50" r="8" className="cell-core drop-shadow-lg" />
          
          <polygon points="50,30 68,40 68,60 50,70 32,60 32,40" fill="rgba(88,230,255,0.15)" stroke="#58e6ff" strokeWidth="1.5" className="cell-path" />
        </svg>

      </div>
    </div>
  )
}
