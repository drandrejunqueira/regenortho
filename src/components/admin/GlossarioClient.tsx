'use client'

import { useState, useTransition } from 'react'
import {
  BookOpen, Plus, Search, Bot, Sparkles, RefreshCw, Trash2, Check,
  Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, HelpCircle,
  Volume2, Megaphone, Settings2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { setFlags } from '@/app/actions/configuracoes'

// Interfaces
interface Termo {
  id: string
  termo: string
  slug: string
  letra: string
  nicho: string
  conteudo: string | null
  status: string
  seoTitle: string | null
  seoDescription: string | null
  createdAt: Date
  updatedAt: Date
}

interface Props {
  initialTermos: Termo[]
  leituraAtiva: boolean
  adsAtivo: boolean
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function GlossarioClient({ initialTermos, leituraAtiva, adsAtivo }: Props) {
  const [termos, setTermos] = useState<Termo[]>(initialTermos)
  const [flagLeitura, setFlagLeitura] = useState(leituraAtiva)
  const [flagAds, setFlagAds] = useState(adsAtivo)
  const [savingFlag, setSavingFlag] = useState<string | null>(null)

  const toggleFlag = async (chave: string, valor: boolean, setLocal: (v: boolean) => void) => {
    setLocal(valor)
    setSavingFlag(chave)
    try {
      await setFlags({ [chave]: String(valor) })
      toast.success(valor ? 'Recurso ativado.' : 'Recurso desativado.')
    } catch {
      setLocal(!valor)
      toast.error('Falha ao salvar a configuração.')
    } finally {
      setSavingFlag(null)
    }
  }

  // default nicho contextualized for ortopedics
  const [nicho, setNicho] = useState('Ortopedia regenerativa, infiltrações articulares e tratamento da dor')
  const [letrasSugerir, setLetrasSugerir] = useState<string[]>(['A'])
  const [prefixo, setPrefixo] = useState('O que é')
  const [promptExtra, setPromptExtra] = useState('')
  const [novoTermoManual, setNovoTermoManual] = useState('')

  // Estados de Edição Inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTermo, setEditingTermo] = useState('')
  const [editingNicho, setEditingNicho] = useState('')

  // Filtros e Busca
  const [busca, setBusca] = useState('')
  const [letraFiltro, setLetraFiltro] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'publicado'>('todos')

  // Estados de Carregamento
  const [loadingSugerir, setLoadingSugerir] = useState(false)
  const [loadingManual, setLoadingManual] = useState(false)
  const [loadingAcao, setLoadingAcao] = useState<string | null>(null) // ID do termo operando
  
  // Seleção e Processamento em Lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [bulkCurrent, setBulkCurrent] = useState(0)
  const [bulkTermoAtual, setBulkTermoAtual] = useState('')
  const [bulkLabel, setBulkLabel] = useState('Geração em Lote Ativa')
  const [bulkUnit, setBulkUnit] = useState('verbetes')

  const [pending, startTransition] = useTransition()

  // Atualizar a lista do banco
  const refreshList = async () => {
    try {
      const res = await fetch('/api/admin/glossario')
      if (res.ok) {
        const data = await res.json()
        setTermos(data)
      }
    } catch (err) {
      console.error('Erro ao recarregar termos:', err)
    }
  }

  // Alternar seleção de letra (multi-seleção)
  const toggleLetra = (l: string) =>
    setLetrasSugerir(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])

  const selecionarTodasLetras = () => setLetrasSugerir([...ALFABETO])
  const limparLetras = () => setLetrasSugerir([])

  // Sugerir termos via IA
  const handleSugerirTermos = async () => {
    if (!nicho.trim()) {
      toast.error('Informe a especialidade médica para contextualizar a IA.')
      return
    }
    if (letrasSugerir.length === 0) {
      toast.error('Selecione ao menos uma letra para gerar os títulos.')
      return
    }

    const letras = [...letrasSugerir].sort()

    setLoadingSugerir(true)
    setBulkLabel('Gerando Títulos por Letra')
    setBulkUnit('letras')
    setIsGeneratingBulk(true)
    setBulkTotal(letras.length)
    setBulkCurrent(0)

    let totalInseridos = 0
    let totalSugeridos = 0
    const falhas: string[] = []

    for (let i = 0; i < letras.length; i++) {
      const letra = letras[i]
      setBulkCurrent(i + 1)
      setBulkTermoAtual(`Letra ${letra}`)

      try {
        const res = await fetch('/api/admin/glossario/gerar-termos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nicho, letra, promptExtra, prefixo })
        })
        const data = await res.json()
        if (!res.ok) {
          falhas.push(letra)
          console.error(`Erro ao gerar títulos para a letra "${letra}":`, data.error)
        } else {
          totalSugeridos += data.totalSugeridos ?? 0
          totalInseridos += data.totalInseridos ?? 0
        }
      } catch (err) {
        falhas.push(letra)
        console.error(`Erro de conexão ao gerar títulos para a letra "${letra}":`, err)
      }
    }

    setIsGeneratingBulk(false)
    setLoadingSugerir(false)
    setPromptExtra('')
    await refreshList()

    if (totalInseridos > 0 || totalSugeridos > 0) {
      toast.success(
        `Concluído! ${totalInseridos} novos títulos adicionados (${totalSugeridos} sugeridos) em ${letras.length} letra(s).` +
        (falhas.length > 0 ? ` Falhas: ${falhas.join(', ')}.` : '')
      )
    } else {
      toast.error(
        falhas.length > 0
          ? `Falha ao gerar títulos nas letras: ${falhas.join(', ')}.`
          : 'Nenhum título novo foi adicionado (possíveis duplicatas).'
      )
    }
  }

  // Adicionar termo manualmente
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoTermoManual.trim()) return

    setLoadingManual(true)
    try {
      const letra = novoTermoManual.trim().charAt(0).toUpperCase()
      const res = await fetch('/api/admin/glossario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termo: novoTermoManual.trim(),
          letra,
          nicho
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar termo')

      toast.success(`Termo "${data.termo}" cadastrado com sucesso!`)
      setNovoTermoManual('')
      await refreshList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingManual(false)
    }
  }

  // Salvar alteração inline
  const handleSaveEdit = async (id: string) => {
    if (!editingTermo.trim()) {
      toast.error('O termo não pode estar em branco.')
      return
    }

    setLoadingAcao(id)
    try {
      const res = await fetch('/api/admin/glossario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          termo: editingTermo.trim(),
          nicho: editingNicho.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar alteração')

      toast.success(`Verbete atualizado com sucesso!`)
      setEditingId(null)
      await refreshList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingAcao(null)
    }
  }

  // Gerar definição de um único termo
  const handleGerarDefinicao = async (id: string, termoNome: string) => {
    setLoadingAcao(id)
    try {
      const res = await fetch('/api/admin/glossario/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar definição')

      toast.success(`Definição para "${termoNome}" gerada e publicada!`)
      await refreshList()
    } catch (err: any) {
      toast.error(`Erro em "${termoNome}": ${err.message}`)
    } finally {
      setLoadingAcao(null)
    }
  }

  // Excluir termo
  const handleExcluirTermo = async (id: string, termoNome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o verbete "${termoNome}"?`)) return

    setLoadingAcao(id)
    try {
      const res = await fetch('/api/admin/glossario', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao excluir')
      }

      toast.success(`Verbete "${termoNome}" excluído.`)
      setSelectedIds(prev => prev.filter(x => x !== id))
      await refreshList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingAcao(null)
    }
  }

  // Gerar em Lote (Bulk Queue)
  const handleGerarLote = async () => {
    if (selectedIds.length === 0) {
      toast.error('Nenhum termo selecionado para a geração em lote.')
      return
    }

    const pendentes = termos.filter(t => selectedIds.includes(t.id) && t.status === 'pendente')
    if (pendentes.length === 0) {
      toast.error('Nenhum dos termos selecionados está com status "Pendente".')
      return
    }

    setBulkLabel('Escrevendo Definições com IA')
    setBulkUnit('verbetes')
    setIsGeneratingBulk(true)
    setBulkTotal(pendentes.length)
    setBulkCurrent(0)

    for (let i = 0; i < pendentes.length; i++) {
      const t = pendentes[i]
      setBulkCurrent(i + 1)
      setBulkTermoAtual(t.termo)

      try {
        const res = await fetch('/api/admin/glossario/gerar-conteudo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: t.id })
        })

        if (!res.ok) {
          const data = await res.json()
          console.error(`Erro no lote para "${t.termo}":`, data.error)
        }
      } catch (err) {
        console.error(`Erro de conexão no lote para "${t.termo}":`, err)
      }
    }

    setIsGeneratingBulk(false)
    setSelectedIds([])
    toast.success('Geração em lote concluída!')
    await refreshList()
  }

  // Selecionar tudo filtrado
  const toggleSelectAll = (filteredTermos: Termo[]) => {
    const visibleIds = filteredTermos.map(t => t.id)
    const allSelected = visibleIds.every(id => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Filtragem local
  const filteredTermos = termos.filter(t => {
    const matchesBusca =
      busca.trim() === '' ||
      t.termo.toLowerCase().includes(busca.toLowerCase()) ||
      t.nicho.toLowerCase().includes(busca.toLowerCase())

    const matchesStatus =
      statusFiltro === 'todos' || t.status === statusFiltro

    const matchesLetra =
      letraFiltro === null || t.letra === letraFiltro

    return matchesBusca && matchesStatus && matchesLetra
  })

  const stats = {
    total: termos.length,
    publicados: termos.filter(t => t.status === 'publicado').length,
    pendentes: termos.filter(t => t.status === 'pendente').length
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(2,21,65,0.06)] pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#021541] flex items-center gap-2">
            <BookOpen className="size-5 text-[#00BCE4]" />
            Dicionário e Glossário Técnico
          </h2>
          <p className="text-[#718096] text-xs mt-0.5">
            Cadastre termos e utilize inteligência artificial para escrever explicações clínicas completas para o site.
          </p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Total de Termos</span>
            <h3 className="text-2xl font-extrabold text-[#021541] mt-1">{stats.total}</h3>
          </div>
          <span className="flex items-center justify-center size-10 rounded-lg bg-[rgba(2,21,65,0.04)] text-[#021541]">
            <BookOpen className="size-5" />
          </span>
        </div>
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Publicados / Indexados</span>
            <h3 className="text-2xl font-extrabold text-[#00BCE4] mt-1">{stats.publicados}</h3>
          </div>
          <span className="flex items-center justify-center size-10 rounded-lg bg-[rgba(0,188,228,0.08)] text-[#00BCE4]">
            <CheckCircle2 className="size-5" />
          </span>
        </div>
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Pendentes de Conteúdo</span>
            <h3 className="text-2xl font-extrabold text-[#D97706] mt-1">{stats.pendentes}</h3>
          </div>
          <span className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 text-[#D97706]">
            <Loader2 className="size-5 animate-spin" />
          </span>
        </div>
      </div>

      {/* Configurações do Glossário (liga/desliga) */}
      <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#021541] flex items-center gap-2 mb-4">
          <Settings2 className="size-4 text-[#00BCE4]" />
          Funcionalidades Ativas no Site
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FlagToggle
            icon={Volume2}
            titulo="Modo de leitura ditada (TTS)"
            descricao="Adiciona o botão “Ouvir este verbete” nas páginas de verbetes do site usando sintetizador."
            ativo={flagLeitura}
            salvando={savingFlag === 'glossario_leitura_ativo'}
            onToggle={() => toggleFlag('glossario_leitura_ativo', !flagLeitura, setFlagLeitura)}
          />
          <FlagToggle
            icon={Megaphone}
            titulo="Anúncios / CTAs Integrados"
            descricao="Insere banners e chamadas de agendamento de consultas ortopédicas no corpo dos textos."
            ativo={flagAds}
            salvando={savingFlag === 'glossario_ads_ativo'}
            onToggle={() => toggleFlag('glossario_ads_ativo', !flagAds, setFlagAds)}
          />
        </div>
      </div>

      {/* Painel Lote Ativo */}
      {isGeneratingBulk && (
        <div className="bg-white border-2 border-[#00BCE4]/30 rounded-xl p-6 shadow-md relative overflow-hidden animate-pulse">
          <div className="absolute top-0 left-0 h-1 bg-[#00BCE4] transition-all duration-300" style={{ width: `${(bulkCurrent / bulkTotal) * 100}%` }} />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center size-12 rounded-full bg-[#00BCE4]/10 text-[#00BCE4]">
                <Loader2 className="size-6 animate-spin" />
              </span>
              <div>
                <h4 className="font-bold text-[#021541] text-base">{bulkLabel}</h4>
                <p className="text-[#718096] text-xs mt-0.5">
                  Processando <span className="text-[#021541] font-semibold">"{bulkTermoAtual}"</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-1 shrink-0">
              <span className="font-mono text-sm font-bold text-[#021541]">
                {bulkCurrent} de {bulkTotal} {bulkUnit} ({Math.round((bulkCurrent / bulkTotal) * 100)}%)
              </span>
              <div className="w-48 bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] h-2 rounded-full overflow-hidden mt-1">
                <div className="bg-[#00BCE4] h-full rounded-full transition-all duration-300" style={{ width: `${(bulkCurrent / bulkTotal) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corpo Layout Dividido */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulários e Ações (Esquerda) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card Sugestão IA */}
          <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#021541] flex items-center gap-2">
              <Bot className="size-4 text-[#00BCE4]" />
              Sugestão de Termos em Lote
            </h3>
            <p className="text-xs text-[#718096] leading-relaxed font-light">
              Escolha a especialidade e as iniciais que deseja gerar. A IA sugerirá de 15 a 30 termos técnicos em lote para cada letra.
            </p>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#718096] uppercase tracking-wider">Especialidade / Foco</label>
                <input
                  type="text"
                  value={nicho}
                  onChange={e => setNicho(e.target.value)}
                  className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-2 text-[#021541] text-xs focus:outline-none focus:border-[#00BCE4] transition-colors"
                  placeholder="Ex: artrose de joelho, PRP, dor lombar"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#718096] uppercase tracking-wider">Prefixo do Verbete</label>
                <select
                  value={prefixo}
                  onChange={e => setPrefixo(e.target.value)}
                  className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-2 text-[#021541] text-xs focus:outline-none focus:border-[#00BCE4] transition-colors"
                >
                  <option value="O que é">O que é...</option>
                  <option value="Como funciona">Como funciona...</option>
                  <option value="Tratamento para">Tratamento para...</option>
                  <option value="Nenhum">Nenhum (Termo simples)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-[#718096] uppercase tracking-wider">
                    Letras Iniciais ({letrasSugerir.length})
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                    <button
                      type="button"
                      onClick={selecionarTodasLetras}
                      disabled={loadingSugerir || isGeneratingBulk}
                      className="text-[#00BCE4] hover:underline"
                    >
                      Todas
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={limparLetras}
                      disabled={loadingSugerir || isGeneratingBulk}
                      className="text-[#718096] hover:text-[#021541]"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {ALFABETO.map(l => {
                    const ativa = letrasSugerir.includes(l)
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleLetra(l)}
                        disabled={loadingSugerir || isGeneratingBulk}
                        className={cn(
                          'h-7 text-[10px] font-bold rounded-lg border transition-all disabled:opacity-30',
                          ativa
                            ? 'bg-[#00BCE4] border-[#00BCE4] text-[#021541] font-black'
                            : 'border-[rgba(2,21,65,0.08)] text-[#718096] hover:border-[#00BCE4]/50'
                        )}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#718096] uppercase tracking-wider">Instruções Extras</label>
                <textarea
                  value={promptExtra}
                  onChange={e => setPromptExtra(e.target.value)}
                  className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-2 text-[#021541] text-xs focus:outline-none focus:border-[#00BCE4] transition-colors resize-none"
                  placeholder="Ex: Focar em infiltrações biológicas e viscossuplementação..."
                  rows={2}
                />
              </div>

              <button
                type="button"
                onClick={handleSugerirTermos}
                disabled={loadingSugerir || isGeneratingBulk}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#00BCE4] hover:bg-[#009ebd] disabled:opacity-60 text-[#021541] font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                {loadingSugerir ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {loadingSugerir
                  ? 'Gerando...'
                  : `Sugerir Termos (${letrasSugerir.length} Letras)`}
              </button>
            </div>
          </div>

          {/* Card Cadastro Manual */}
          <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#021541] flex items-center gap-2">
              <Plus className="size-4 text-[#00BCE4]" />
              Cadastrar Termo Manualmente
            </h3>
            <form onSubmit={handleAddManual} className="space-y-3">
              <input
                type="text"
                value={novoTermoManual}
                onChange={e => setNovoTermoManual(e.target.value)}
                className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] transition-colors"
                placeholder="Ex: O que é Viscossuplementação"
              />
              <button
                type="submit"
                disabled={loadingManual || !novoTermoManual.trim() || isGeneratingBulk}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] hover:border-[#00BCE4]/50 disabled:opacity-50 text-[#021541] font-bold text-xs uppercase tracking-widest py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {loadingManual ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Cadastrar Termo
              </button>
            </form>
          </div>
        </div>

        {/* Lista e Tabela (Direita) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Busca */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#718096]" />
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-9 pr-3 py-2 text-[#021541] placeholder:text-[#718096]/50 text-xs focus:outline-none focus:border-[#00BCE4] transition-colors"
                  placeholder="Buscar termo ou especialidade..."
                />
              </div>

              {/* Filtro Status */}
              <div className="flex border border-[rgba(2,21,65,0.06)] rounded-lg overflow-hidden shrink-0 bg-[#f5f6f8]">
                {(['todos', 'pendente', 'publicado'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFiltro(s)}
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                      statusFiltro === s
                        ? 'bg-[#021541] text-white'
                        : 'text-[#718096] hover:text-[#021541]'
                    )}
                  >
                    {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Pendente' : 'Publicado'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro Alfabético */}
            <div className="flex flex-wrap items-center gap-1 border-t border-[rgba(2,21,65,0.06)] pt-3">
              <button
                type="button"
                onClick={() => setLetraFiltro(null)}
                className={cn(
                  'h-6 px-2.5 text-[9px] font-bold rounded uppercase transition-all',
                  letraFiltro === null
                    ? 'bg-[#00BCE4] text-[#021541]'
                    : 'bg-[#f5f6f8] text-[#718096] hover:border-[#00BCE4]/50 border border-[rgba(2,21,65,0.06)]'
                )}
              >
                Tudo
              </button>
              {ALFABETO.map(l => {
                const count = termos.filter(t => t.letra === l).length
                if (count === 0) return null
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLetraFiltro(l)}
                    className={cn(
                      'h-6 px-2.5 text-[9px] font-bold rounded uppercase transition-all flex items-center gap-1',
                      letraFiltro === l
                        ? 'bg-[#00BCE4] text-[#021541] font-black'
                        : 'bg-[#f5f6f8] text-[#718096] hover:border-[#00BCE4]/50 border border-[rgba(2,21,65,0.06)]'
                    )}
                  >
                    {l}
                    <span className={cn('text-[8px] px-0.5 rounded font-mono font-bold', letraFiltro === l ? 'bg-white/20' : 'bg-white border border-[rgba(2,21,65,0.06)]')}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Barra de Ações em Lote */}
          {selectedIds.length > 0 && (
            <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-xl px-4 py-3 flex items-center justify-between shadow-sm animate-fade-in">
              <span className="text-xs text-[#718096] font-medium">
                <span className="text-[#021541] font-bold mr-1">{selectedIds.length}</span>
                termos selecionados
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGerarLote}
                  disabled={isGeneratingBulk}
                  className="inline-flex items-center gap-1.5 bg-[#00BCE4]/10 text-[#00BCE4] border border-[#00BCE4]/20 hover:bg-[#00BCE4]/20 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Sparkles className="size-3.5" />
                  Gerar Artigos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[#718096] hover:text-[#021541] text-xs px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabela de Dados */}
          <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5f6f8] border-b border-[rgba(2,21,65,0.06)]">
                    <th className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredTermos.length > 0 && filteredTermos.every(t => selectedIds.includes(t.id))}
                        onChange={() => toggleSelectAll(filteredTermos)}
                        className="rounded border-[rgba(2,21,65,0.06)] focus:ring-[#00BCE4] text-[#00BCE4] cursor-pointer"
                      />
                    </th>
                    <th className="p-4 font-bold text-[#718096] uppercase tracking-wider">Termo / Especialidade</th>
                    <th className="p-4 font-bold text-[#718096] uppercase tracking-wider w-16 text-center">Letra</th>
                    <th className="p-4 font-bold text-[#718096] uppercase tracking-wider w-24 text-center">Status</th>
                    <th className="p-4 font-bold text-[#718096] uppercase tracking-wider w-32 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(2,21,65,0.05)]">
                  {filteredTermos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-[#718096]">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <AlertCircle className="size-8 text-[#718096] opacity-30 animate-pulse" />
                          <div>
                            <span className="text-sm font-bold text-[#021541] block">Nenhum termo encontrado</span>
                            <p className="text-xs text-[#718096] mt-1 leading-relaxed max-w-xs mx-auto">Nenhum termo técnico coincide com os filtros ativos. Tente pesquisar outra palavra.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTermos.map(t => {
                      const isEditing = editingId === t.id
                      const isPending = t.status === 'pendente'
                      const isOperating = loadingAcao === t.id
                      const isSelected = selectedIds.includes(t.id)

                      return (
                        <tr
                          key={t.id}
                          className={cn(
                            'hover:bg-[rgba(2,21,65,0.015)] transition-colors',
                            isSelected && 'bg-[#00BCE4]/03'
                          )}
                        >
                          {/* Checkbox */}
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isOperating || isGeneratingBulk}
                              onChange={() =>
                                setSelectedIds(prev =>
                                  prev.includes(t.id)
                                    ? prev.filter(x => x !== t.id)
                                    : [...prev, t.id]
                                )
                              }
                              className="rounded border-[rgba(2,21,65,0.06)] focus:ring-[#00BCE4] text-[#00BCE4] cursor-pointer"
                            />
                          </td>

                          {/* Termo / Nicho */}
                          <td className="p-4">
                            {isEditing ? (
                              <div className="space-y-2 max-w-md">
                                <input
                                  type="text"
                                  value={editingTermo}
                                  onChange={e => setEditingTermo(e.target.value)}
                                  className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]"
                                  placeholder="Nome do verbete"
                                />
                                <input
                                  type="text"
                                  value={editingNicho}
                                  onChange={e => setEditingNicho(e.target.value)}
                                  className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]"
                                  placeholder="Especialidade relacionada"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-[#021541] text-sm block leading-tight">{t.termo}</span>
                                <span className="text-[10px] text-[#718096] uppercase font-bold tracking-wider mt-0.5 block">{t.nicho || 'Sem Especialidade'}</span>
                              </div>
                            )}
                          </td>

                          {/* Letra */}
                          <td className="p-4 text-center font-mono font-bold text-sm text-[#021541]">
                            {t.letra}
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
                                isPending
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              )}
                            >
                              {isPending ? 'Pendente' : 'Publicado'}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isOperating ? (
                                <span className="text-[10px] text-[#718096] flex items-center gap-1 font-medium mr-2">
                                  <Loader2 className="size-3 animate-spin text-[#00BCE4]" /> Processando...
                                </span>
                              ) : isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(t.id)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 transition-colors"
                                    title="Salvar"
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 rounded-lg bg-[rgba(2,21,65,0.06)] hover:bg-[rgba(2,21,65,0.10)] text-[#718096] border border-[rgba(2,21,65,0.06)] transition-colors"
                                    title="Cancelar"
                                  >
                                    <XCircle className="size-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* Gerar Artigo */}
                                  {isPending ? (
                                    <button
                                      onClick={() => handleGerarDefinicao(t.id, t.termo)}
                                      disabled={isGeneratingBulk}
                                      className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#00BCE4]/08 text-[#00BCE4] border border-[#00BCE4]/15 hover:bg-[#00BCE4]/15 font-bold transition-all disabled:opacity-40"
                                      title="Escrever definição com IA"
                                    >
                                      <Sparkles className="size-3" />
                                      Gerar Artigo
                                    </button>
                                  ) : (
                                    <a
                                      href={`/site/glossario/${t.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg bg-[rgba(0,188,228,0.08)] hover:bg-[#00BCE4]/15 text-[#00BCE4] border border-[#00BCE4]/15 transition-all inline-flex"
                                      title="Ver página pública"
                                    >
                                      <ExternalLink className="size-3.5" />
                                    </a>
                                  )}

                                  {/* Editar Inline */}
                                  <button
                                    onClick={() => {
                                      setEditingId(t.id)
                                      setEditingTermo(t.termo)
                                      setEditingNicho(t.nicho)
                                    }}
                                    disabled={isGeneratingBulk}
                                    className="p-1.5 rounded-lg bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] hover:border-[#00BCE4]/30 text-[#021541] transition-colors"
                                    title="Editar termo"
                                  >
                                    <Settings2 className="size-3.5" />
                                  </button>

                                  {/* Excluir */}
                                  <button
                                    onClick={() => handleExcluirTermo(t.id, t.termo)}
                                    disabled={isGeneratingBulk}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 hover:text-white text-red-500 border border-red-100 transition-all"
                                    title="Excluir verbete"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── COMPONENTES INTERNOS ── */

function FlagToggle({
  icon: Icon, titulo, descricao, ativo, salvando, onToggle
}: {
  icon: any; titulo: string; descricao: string; ativo: boolean; salvando: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-start justify-between p-4 rounded-xl border border-[rgba(2,21,65,0.06)] bg-[#f5f6f8]">
      <div className="flex gap-3">
        <span className="flex items-center justify-center size-9 rounded-lg bg-white border border-[rgba(2,21,65,0.06)] text-[#021541] shrink-0">
          <Icon className="size-4" />
        </span>
        <div>
          <h4 className="font-bold text-[#021541] text-xs leading-tight">{titulo}</h4>
          <p className="text-[#718096] text-[10px] leading-relaxed mt-1 font-light">{descricao}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={salvando}
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none disabled:opacity-50 cursor-pointer',
          ativo ? 'bg-[#00BCE4]' : 'bg-gray-200 border border-gray-300'
        )}
      >
        {salvando ? (
          <span className="absolute left-1/2 -translate-x-1/2 size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
              ativo ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        )}
      </button>
    </div>
  )
}
