"use client";

import { useState } from "react";
import { Maximize2, Minimize2, Calendar, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const HeroSection = () => {
  const [fullBleed, setFullBleed] = useState(true);

  const VIDEO_URL =
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4";

  return (
    <section
      className={`relative w-full overflow-hidden transition-all duration-500 ease-in-out ${
        fullBleed ? "min-h-screen" : "py-32 lg:py-40"
      }`}
    >
      {/* Height Toggle */}
      <button
        onClick={() => setFullBleed(!fullBleed)}
        aria-label={fullBleed ? "Switch to fit-to-content" : "Switch to full-bleed"}
        className="absolute top-24 right-4 z-20 p-2.5 rounded-[10px] backdrop-blur-xl border border-[rgba(0,188,228,0.3)] bg-[rgba(2,21,65,0.4)] text-white hover:bg-[rgba(2,21,65,0.6)] transition-all focus:outline-none"
      >
        {fullBleed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      {/* Background Image */}
      <Image
        src="/image/regen.webp"
        alt="REGENORTHO Clinic Background"
        fill
        className="absolute inset-0 w-full h-full object-cover z-0"
        priority
      />

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-[#021541]/75 z-[1]" />

      {/* Background Image Layer (15% Opacity) */}
      <div className="absolute top-32 bottom-0 left-0 right-0 z-[2] opacity-15 pointer-events-none">
        <Image
          src="/image/drandre-alias.png"
          alt="Dr. André Elias Junqueira Background"
          fill
          className="object-contain object-bottom"
          priority
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center text-center mt-32 px-6">
        {/* Tagline Pill */}
        <div className="inline-flex items-center gap-2.5 h-[38px] px-3.5 rounded-[10px] backdrop-blur-xl border border-[rgba(0,188,228,0.3)] bg-[rgba(2,21,65,0.4)] shadow-[0_0_20px_rgba(0,188,228,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <span className="bg-[#00BCE4] text-white font-sans font-medium text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-[0_0_8px_rgba(0,188,228,0.4)]">
            Inovação
          </span>
          <span className="font-sans font-medium text-xs text-white/90 tracking-widest uppercase">
            Medicina Regenerativa de Precisão
          </span>
        </div>

        {/* Headline */}
        <h1 
          className="font-headline text-white text-5xl lg:text-[clamp(3.5rem,8vw,6rem)] leading-[1.05] tracking-tight mt-8 max-w-5xl font-bold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Movimento sem limites.
          <br className="hidden lg:block" />
          Restaure sua{" "}
          <em
            className="italic mx-[0.08em] relative inline-block text-[#00BCE4]"
            style={{ fontStyle: "italic" }}
          >
            biologia.
          </em>
        </h1>

        {/* Subtext */}
        <p 
          className="font-sans font-light text-lg lg:text-xl text-white/70 mt-6 max-w-[700px] leading-relaxed"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          Tecnologia de ponta para eliminar a dor e restaurar sua qualidade de vida sem cirurgias invasivas. Dr. André Elias Junqueira — São José dos Campos.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link 
            href="/site/agendar"
            className="px-10 py-4 rounded-[10px] bg-[#00BCE4] text-white font-sans font-bold text-base hover:brightness-110 transition-all shadow-lg shadow-[#00BCE4]/20 flex items-center gap-2 uppercase tracking-widest"
          >
            <Calendar size={18} />
            Agendar Avaliação
          </Link>
          <Link 
            href="/site/tratamentos"
            className="px-10 py-4 rounded-[10px] border border-white/20 bg-white/10 backdrop-blur-md text-white font-sans font-bold text-base hover:bg-white/20 transition-all flex items-center gap-2 uppercase tracking-widest"
          >
            Conheça os Tratamentos
            <ArrowRight size={18} />
          </Link>
        </div>
        
        {/* Trust badge */}
        <div className="mt-16 flex items-center gap-4 text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">
            <div className="h-px w-8 bg-white/20" />
            <span>São José dos Campos</span>
            <div className="h-px w-8 bg-white/20" />
        </div>
      </div>
    </section>
  );
};

export { HeroSection };
