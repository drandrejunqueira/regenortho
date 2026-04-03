'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Patient } from '@/types'

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/pacientes?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setPatients(data)
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  function calcAge(birthDate: string | null) {
    if (!birthDate) return '—'
    const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    return `${age} anos`
  }

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description="Gerencie a base de pacientes da clínica"
      />

      <div className="mb-4 max-w-xs relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#bec9c9]/60" style={{ fontSize: '18px' }}>search</span>
        <input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1c2026] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-[#1c2026] animate-pulse" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-[#1c2026] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[#262a31] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#bec9c9]" style={{ fontSize: '24px' }}>group</span>
          </div>
          <p className="text-sm font-medium text-[#dfe2eb]">Nenhum paciente encontrado</p>
          <p className="text-sm text-[#bec9c9] mt-1">{search ? 'Tente buscar com outros termos' : 'Cadastre o primeiro paciente'}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-[#1c2026]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#262a31]">
                {['Paciente', 'Idade', 'Telefone', 'Cidade', 'Status', ''].map((h) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider ${h === '' ? 'w-10' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3e4949]/20">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-[#262a31]/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#006e72] flex items-center justify-center text-[#dfe2eb] font-bold text-xs shrink-0 select-none">
                        {patient.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-[#dfe2eb]">{patient.name}</p>
                        {patient.insurance && (
                          <p className="text-xs text-[#bec9c9]">{patient.insurance}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-technical text-xs text-[#bec9c9]">{calcAge(patient.birthDate)}</td>
                  <td className="px-5 py-3 font-technical text-xs text-[#bec9c9]">{patient.phone}</td>
                  <td className="px-5 py-3 text-xs text-[#bec9c9]">{patient.city ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      patient.isActive
                        ? 'bg-[#61d8dd]/10 text-[#61d8dd]'
                        : 'bg-[#31353c] text-[#bec9c9]'
                    }`}>
                      {patient.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/pacientes/${patient.id}`}
                      className="p-1.5 rounded-lg bg-[#31353c] text-[#bec9c9] hover:text-[#61d8dd] hover:bg-[#61d8dd]/10 transition-all inline-flex"
                      aria-label="Ver paciente"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
