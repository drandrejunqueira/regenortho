export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#12161b]">
      {/* Top bar */}
      <header className="bg-[#1c2026] border-b border-[#3e4949]/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="/site" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#006e72] to-[#61d8dd] flex items-center justify-center text-[#003739] font-bold text-sm select-none">
              RO
            </div>
            <div>
              <p className="text-sm font-bold text-[#dfe2eb]">Regem Orto</p>
              <p className="text-[10px] text-[#61d8dd]/70 uppercase tracking-widest">Portal do Paciente</p>
            </div>
          </a>
          <a
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3e4949]/30 text-[#bec9c9] text-xs font-medium hover:text-[#dfe2eb] hover:bg-[#262a31] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
            Login Clínica
          </a>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
