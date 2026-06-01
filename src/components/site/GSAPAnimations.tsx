'use client'

import { useEffect } from 'react'
import { useLenis } from 'lenis/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function GSAPAnimations() {
  // ── Conecta Lenis ao ScrollTrigger (padrão da skill) ──────
  useLenis(ScrollTrigger.update)

  useEffect(() => {
    // Se o usuário preferir movimento reduzido, não oculta nada —
    // elementos ficam visíveis sem animação (acessibilidade + SSR/bots)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const ctx = gsap.context(() => {

      // ── HERO — entrada 3D em cascata ──────────────────────
      gsap.fromTo(
        '.gsap-hero',
        { y: 70, opacity: 0, rotateX: 18, transformPerspective: 900 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 1.1,
          stagger: 0.16,
          ease: 'power3.out',
          delay: 0.15,
        }
      )

      // ── REVEAL 3D — entrada de baixo com perspectiva ──────
      gsap.utils.toArray<HTMLElement>('.gsap-reveal-3d').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 90, opacity: 0, rotateX: 22, transformPerspective: 1000 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 1.0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 87%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

      // ── REVEAL DA ESQUERDA — rotateY ─────────────────────
      gsap.utils.toArray<HTMLElement>('.gsap-reveal-left').forEach((el) => {
        gsap.fromTo(
          el,
          { x: -70, opacity: 0, rotateY: -14, transformPerspective: 900 },
          {
            x: 0,
            opacity: 1,
            rotateY: 0,
            duration: 0.95,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

      // ── REVEAL DA DIREITA — rotateY ──────────────────────
      gsap.utils.toArray<HTMLElement>('.gsap-reveal-right').forEach((el) => {
        gsap.fromTo(
          el,
          { x: 70, opacity: 0, rotateY: 14, transformPerspective: 900 },
          {
            x: 0,
            opacity: 1,
            rotateY: 0,
            duration: 0.95,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

      // ── STAGGER 3D — filhos em cascata 3D ────────────────
      gsap.utils.toArray<HTMLElement>('.gsap-stagger-parent').forEach((parent) => {
        const children = parent.querySelectorAll<HTMLElement>('.gsap-stagger-child')
        if (!children.length) return
        gsap.fromTo(
          children,
          { y: 60, opacity: 0, rotateX: 18, transformPerspective: 800 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.85,
            stagger: 0.13,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: parent,
              start: 'top 82%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

      // ── PARALLAX — profundidade no scroll ─────────────────
      gsap.utils.toArray<HTMLElement>('.gsap-parallax').forEach((el) => {
        const depth = el.dataset.depth ?? '15'
        gsap.to(el, {
          yPercent: -parseFloat(depth),
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      })

      // ── SCALE REVEAL — escala de 3D ───────────────────────
      gsap.utils.toArray<HTMLElement>('.gsap-scale-in').forEach((el) => {
        gsap.fromTo(
          el,
          { scale: 0.88, opacity: 0, transformPerspective: 800 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

      // ── FLOAT LOOP — elementos flutuantes ─────────────────
      gsap.to('.gsap-float', {
        y: -14,
        duration: 2.8,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })

      // ── LINE DRAW — linhas/divisores que crescem ──────────
      gsap.utils.toArray<HTMLElement>('.gsap-line-draw').forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0, transformOrigin: 'left center' },
          {
            scaleX: 1,
            duration: 1.0,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          }
        )
      })

    })

    return () => ctx.revert()
  }, [])

  return null
}
