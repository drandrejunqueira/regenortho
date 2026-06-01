'use client'

import { useEffect } from 'react'
import anime from 'animejs'

export function AnimeWrapper() {
  useEffect(() => {
    // Animando os elementos do Hero (títulos e textos)
    anime({
      targets: '.anime-hero',
      translateY: [50, 0],
      opacity: [0, 1],
      duration: 1200,
      delay: anime.stagger(250),
      easing: 'easeOutCirc'
    });

    // Animando as tecnologias (cards)
    anime({
      targets: '.anime-tech',
      translateY: [100, 0],
      opacity: [0, 1],
      duration: 1000,
      delay: anime.stagger(150, { start: 600 }),
      easing: 'easeOutExpo'
    });

    // Animação contínua para um efeito de "flutuação" em elementos decorativos
    anime({
      targets: '.anime-float',
      translateY: [-10, 10],
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine',
      duration: 3000
    });
    
    // Animação para ícones
    anime({
      targets: '.anime-icon',
      scale: [0.5, 1],
      opacity: [0, 1],
      rotate: '1turn',
      duration: 1500,
      delay: anime.stagger(200, { start: 1000 }),
      easing: 'easeOutElastic(1, .8)'
    });
  }, []);

  return null;
}
