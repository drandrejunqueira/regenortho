'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { toast, Toaster } from 'sonner'

// 1. DATA STORES FOR THE 5 DYNAMIC LANDING PAGES
const CAMPAIGN_DATA: Record<string, {
  tag: string
  title: string
  italicTitle: string
  subtitle: string
  description: string
  kpis: { val: string; desc: string }[]
  jointOptions: { value: string; label: string }[]
  symptomsTitle: string
  symptoms: { t: string; d: string }[]
  processTitle: string
  processDesc: string
  processCards: { tag: string; title: string; icon: string; desc: string }[]
  faq: { q: string; a: string }[]
}> = {
  'prp': {
    tag: 'Regeneração Plasmática Autóloga',
    title: 'PRP — Plasma Rico em Plaquetas',
    italicTitle: 'estimule a cura natural',
    subtitle: 'Acelere a Cicatrização de Lesões e Elimine a Dor Naturalmente',
    description: 'O PRP utiliza os fatores de crescimento concentrados do seu próprio sangue para reparar tendões, ligamentos e articulações desgastadas sem a necessidade de cirurgias invasivas.',
    kpis: [
      { val: '92%', desc: 'De cicatrização acelerada' },
      { val: 'Autólogo', desc: '100% natural, sem rejeição' },
      { val: 'Sem Corte', desc: 'Procedimento de consultório' }
    ],
    jointOptions: [
      { value: 'joelho', label: 'Joelho (Artrose, Tendinite Patelar, Lesão de Menisco)' },
      { value: 'ombro', label: 'Ombro (Manguito Rotador, Lesão de Tendão)' },
      { value: 'cotovelo', label: 'Cotovelo (Epicondilite Lateral / Tennis Elbow)' },
      { value: 'tornozelo', label: 'Tornozelo e Pé (Fascite Plantar, Aquiles)' }
    ],
    symptomsTitle: 'A quem é indicado o PRP?',
    symptoms: [
      { t: 'Tendinite e bursite refratárias', d: 'Dores crônicas nos tendões que não melhoram com repouso, fisioterapia convencional ou medicamentos orais.' },
      { t: 'Lesões musculares ou ligamentares', d: 'Estiramentos e estresses musculares que limitam seus treinos e atividades diárias.' },
      { t: 'Desgastes articulares iniciais', d: 'Artrose leve a moderada com dor frequente e perda progressiva de mobilidade nas juntas.' },
      { t: 'Desejo de evitar cirurgias', d: 'Para quem busca uma alternativa natural e rápida para voltar aos esportes sem passar pela mesa de cirurgia.' }
    ],
    processTitle: 'Como funciona o tratamento com PRP?',
    processDesc: 'Um protocolo biológico simples e seguro, realizado inteiramente em ambiente ambulatorial de forma rápida.',
    processCards: [
      {
        tag: 'Fase 1',
        title: 'Coleta Confortável',
        icon: 'water_drop',
        desc: 'Uma pequena amostra de sangue é retirada de forma simples em consultório, exatamente igual a um exame de sangue laboratorial de rotina.'
      },
      {
        tag: 'Fase 2',
        title: 'Concentração Digital',
        icon: 'biotech',
        desc: 'O sangue passa por uma centrífuga especial automatizada de alta precisão que isola e concentra as plaquetas ricas em fatores de crescimento.'
      },
      {
        tag: 'Fase 3',
        title: 'Aplicação Guiada (USG)',
        icon: 'verified_user',
        desc: 'O plasma superconcentrado é injetado diretamente no ponto da lesão sob monitoramento de ultrassom em tempo real, garantindo precisão milimétrica.'
      }
    ],
    faq: [
      { q: 'O que são fatores de crescimento?', a: 'São proteínas naturais presentes em nossas plaquetas que sinalizam e atraem células reparadoras para o local da aplicação, iniciando uma cicatrização acelerada e reduzindo a inflamação crônica.' },
      { q: 'Quantas sessões de PRP são necessárias?', a: 'A maioria dos pacientes obtém excelentes resultados com um protocolo de 1 a 3 aplicações, espaçadas por algumas semanas, dependendo da gravidade e do local da lesão.' },
      { q: 'É um procedimento doloroso?', a: 'Realizamos anestesia local no ponto de inserção e a infiltração é guiada por ultrassom para ser o mais confortável e rápida possível. O paciente retorna para casa imediatamente.' },
      { q: 'O PRP é regulamentado?', a: 'Sim, o uso de plasma rico em plaquetas para fins ortopédicos é amparado por regulamentações técnicas do CFM e ANVISA, sendo amplamente adotado por atletas e clínicas de ponta no mundo todo.' }
    ]
  },
  'bmac': {
    tag: 'Terapia Celular de Elite',
    title: 'BMAC — Concentrado de Medula Óssea',
    italicTitle: 'potencial regenerativo máximo',
    subtitle: 'Combata o Desgaste Severo de Cartilagem com Células Progenitoras',
    description: 'O BMAC (Bone Marrow Aspirate Concentrate) é uma terapia biológica avançada que extrai células-tronco e fatores anti-inflamatórios da própria medula para regenerar articulações severamente comprometidas.',
    kpis: [
      { val: '95%', desc: 'De preservação da junta' },
      { val: 'Celular', desc: 'Rico em células mesenquimais' },
      { val: 'Evita Prótese', desc: 'Excelente para adiar cirurgias' }
    ],
    jointOptions: [
      { value: 'joelho', label: 'Joelho (Artrose Severa / Gonartrose)' },
      { value: 'quadril', label: 'Quadril (Artrose de Quadril, Necrose Avascular)' },
      { value: 'ombro', label: 'Ombro (Artrose e Desgastes Avançados)' },
      { value: 'coluna', label: 'Coluna (Desgaste de Disco e Facetas)' }
    ],
    symptomsTitle: 'Quando o BMAC é o mais indicado?',
    symptoms: [
      { t: 'Artrose moderada a grave', d: 'Casos em que o desgaste da cartilagem já é severo e outros tratamentos como fisioterapia e infiltrações comuns falharam.' },
      { t: 'Dor crônica limitante na junta', d: 'Sensação frequente de "osso com osso", rigidez articular pesada ao acordar e dor intensa ao caminhar.' },
      { t: 'Indicação para Prótese (Artroplastia)', d: 'Para pacientes que receberam indicação de colocação de prótese, mas desejam adiar a cirurgia ou não podem realizá-la por motivos de saúde.' },
      { t: 'Lesões ósseas complexas', d: 'Quadros como necrose avascular da cabeça femoral ou falhas de consolidação óssea.' }
    ],
    processTitle: 'O Protocolo Avançado do BMAC',
    processDesc: 'Terapia biológica altamente especializada, realizada com todo o rigor de assepsia e anestesia.',
    processCards: [
      {
        tag: 'Fase 1',
        title: 'Coleta Aspirativa',
        icon: 'vaccines',
        desc: 'Uma pequena quantidade de líquido da medula óssea é aspirada do osso do quadril (crista ilíaca) sob anestesia local e sedação leve para total conforto.'
      },
      {
        tag: 'Fase 2',
        title: 'Centrifugação Celular',
        icon: 'science',
        desc: 'O material é centrifugado em sistema fechado estéril para separar e concentrar a fração mononuclear, contendo milhões de células progenitoras ativas.'
      },
      {
        tag: 'Fase 3',
        title: 'Infiltração de Precisão',
        icon: 'verified_user',
        desc: 'O concentrado celular é guiado milimetricamente por ultrassonografia para dentro da articulação desgastada, agindo diretamente no foco da artrose.'
      }
    ],
    faq: [
      { q: 'O que diferencia o BMAC do PRP?', a: 'O PRP é focado em plaquetas e fatores de crescimento (excelente para tendões e artrose leve). O BMAC contém, além disso, células mesenquimais progenitoras e citocinas anti-inflamatórias potentes, ideal para regenerar tecidos em desgastes de cartilagem mais profundos.' },
      { q: 'Como é o pós-procedimento?', a: 'Por ser ambulatorial, o paciente recebe alta no mesmo dia. É indicado um repouso relativo de atividades de impacto por 3 a 5 dias, e o retorno às atividades de rotina é rápido.' },
      { q: 'O BMAC realmente evita a cirurgia de prótese?', a: 'Para muitos pacientes com artrose moderada a avançada, o BMAC diminui drasticamente a inflamação, lubrifica a junta e estabiliza o desgaste, postergando a necessidade de cirurgia aberta por anos ou mesmo eliminando-a.' },
      { q: 'O procedimento é seguro?', a: 'Extremamente seguro. Por utilizar apenas material biológico do próprio paciente (autólogo), o risco de rejeição ou reação alérgica é zero. O procedimento segue estritas normas de esterilidade.' }
    ]
  },
  'acido-hialuronico': {
    tag: 'Viscossuplementação Premium',
    title: 'Ácido Hialurônico de Alta Viscosidade',
    italicTitle: 'recupere seu amortecimento',
    subtitle: 'Restaure a Lubrificação Articular e Elimine o Atrito entre os Ossos',
    description: 'A viscossuplementação com ácido hialurônico de alto peso molecular repõe o líquido lubrificante da articulação, reduzindo a dor e a rigidez articular de forma rápida e confortável.',
    kpis: [
      { val: 'Imediato', desc: 'Alívio mecânico da rigidez' },
      { val: '6 a 12 Meses', desc: 'De efeito protetor contínuo' },
      { val: 'Alto Peso', desc: 'Máxima viscosidade e amortecimento' }
    ],
    jointOptions: [
      { value: 'joelho', label: 'Joelho (Gonartrose, Desgaste de Cartilagem)' },
      { value: 'quadril', label: 'Quadril (Coxartrose, Desgaste da Cabeça Femoral)' },
      { value: 'ombro', label: 'Ombro (Artrose Escápulo-Umeral, Rigidez)' },
      { value: 'tornozelo', label: 'Tornozelo (Artrose Tornozelo, Sequelas de Entorse)' }
    ],
    symptomsTitle: 'Sua articulação precisa de lubrificação?',
    symptoms: [
      { t: 'Estalos e sensação de "areia"', d: 'Sentir ou ouvir barulhos ásperos dentro do joelho ou quadril ao dobrar ou esticar a perna.' },
      { t: 'Dor ao subir e descer escadas', d: 'Incômodo mecânico agudo na patela ou na dobra da virilha que limita caminhadas e movimentos cotidianos.' },
      { t: 'Rigidez matinal nas juntas', d: 'Sentir a articulação "travada" ou pesada nos primeiros minutos após levantar da cama.' },
      { t: 'Uso abusivo de anti-inflamatórios', d: 'Depender de comprimidos diários que agridem seu estômago e rins para conseguir caminhar sem mancar.' }
    ],
    processTitle: 'Ação e Lubrificação Mecânica',
    processDesc: 'Um procedimento simples, indolor e com retorno imediato às atividades do dia a dia.',
    processCards: [
      {
        tag: 'Fase 1',
        title: 'Mapeamento Anatômico',
        icon: 'verified_user',
        desc: 'Visualização da articulação por ultrassom de alta resolução para mapear a cápsula interna e desviar de vasos ou nervos.'
      },
      {
        tag: 'Fase 2',
        title: 'Suplementação Estéril',
        icon: 'vaccines',
        desc: 'Injeção suave do ácido hialurônico de alto peso molecular diretamente no espaço sinovial da articulação com anestesia local.'
      },
      {
        tag: 'Fase 3',
        title: 'Fluidez e Proteção',
        icon: 'hub',
        desc: 'O gel cria uma película protetora entre as superfícies cartilaginosas, devolvendo o amortecimento e permitindo deslizamento indolor.'
      }
    ],
    faq: [
      { q: 'O que é o ácido hialurônico de alto peso molecular?', a: 'Diferente dos ácidos simples, o de alto peso molecular possui consistência e propriedades físicas quase idênticas ao líquido sinovial saudável do corpo jovem, garantindo maior amortecimento e durabilidade.' },
      { q: 'Quanto tempo dura o efeito da infiltração?', a: 'Uma única aplicação premium costuma proteger a articulação e eliminar a dor por um período de 6 a 12 meses, variando de acordo com o grau de desgaste do paciente.' },
      { q: 'Posso trabalhar e andar normalmente no dia da infiltração?', a: 'Sim. A viscossuplementação é um procedimento ambulatorial rápido. Você sai andando do consultório e pode retornar ao trabalho imediatamente, evitando apenas exercícios físicos de alto impacto por 48 horas.' },
      { q: 'O ácido hialurônico serve para qualquer grau de artrose?', a: 'Ele traz excelentes resultados em graus leves, moderados e até mesmo severos. Nas artroses mais avançadas, ele atua reduzindo drasticamente a dor mecânica e devolvendo a dignidade de movimento ao paciente.' }
    ]
  },
  'proloterapia': {
    tag: 'Fortalecimento Ligamentar',
    title: 'Proloterapia e Estabilização Articular',
    italicTitle: 'elimine a instabilidade',
    subtitle: 'Fortaleça Ligamentos e Tendões Enfraquecidos sem Cirurgia',
    description: 'A Proloterapia é um tratamento proliferativo que induz uma resposta cicatricial natural e controlada para regenerar e firmar ligamentos e tendões frouxos que causam dor crônica.',
    kpis: [
      { val: 'Natural', desc: 'Estimula o colágeno do próprio corpo' },
      { val: 'Sem Cortisona', desc: 'Evita a degradação de tecidos' },
      { val: 'Estável', desc: 'Devolve a firmeza e segurança' }
    ],
    jointOptions: [
      { value: 'tornozelo', label: 'Tornozelo (Entorses de Repetição, Frouxidão Ligamentar)' },
      { value: 'coluna', label: 'Dor Lombar e Sacroilíaca (Instabilidade Pélvica)' },
      { value: 'joelho', label: 'Joelho (Instabilidade Patelar, Lesões Parciais Ligamentares)' },
      { value: 'pe', label: 'Pé e Calcanhar (Fascite Plantar Crônica)' }
    ],
    symptomsTitle: 'Quando a Proloterapia é ideal para você?',
    symptoms: [
      { t: 'Entorses recorrentes no tornozelo', d: 'Sentir o pé "virar" facilmente ao caminhar em terrenos irregulares ou perder a confiança nos esportes.' },
      { t: 'Dores crônicas em ligamentos e tendões', d: 'Incômodo persistente nas costas, quadril ou sacroilíaca que não melhora com alongamentos ou remédios.' },
      { t: 'Frouxidão articular', d: 'Sensação de que a articulação está solta ou "desencaixando", gerando sobrecarga muscular compensatória.' },
      { t: 'Fascite plantar e esporão crônicos', d: 'Dor severa no calcanhar ao dar os primeiros passos do dia que persiste por meses.' }
    ],
    processTitle: 'O Ciclo de Fortalecimento',
    processDesc: 'Um protocolo regenerativo que trabalha a favor da própria inflamação biológica do bem.',
    processCards: [
      {
        tag: 'Fase 1',
        title: 'Estímulo Hipertônico',
        icon: 'vaccines',
        desc: 'Injeção precisa de uma solução hipertônica natural de dextrose diretamente na inserção dos ligamentos ou tendões enfraquecidos.'
      },
      {
        tag: 'Fase 2',
        title: 'Cascata de Cicatrização',
        icon: 'healing',
        desc: 'A solução gera uma microinflamação controlada que sinaliza ao organismo a necessidade urgente de enviar fatores de reparação ao local.'
      },
      {
        tag: 'Fase 3',
        title: 'Espessamento de Colágeno',
        icon: 'verified_user',
        desc: 'Novas fibras de colágeno denso e forte são formadas, enrijecendo e encurtando o ligamento frouxo, eliminando a dor e a instabilidade.'
      }
    ],
    faq: [
      { q: 'O que é a Proloterapia?', a: 'Vinda do termo "terapia proliferativa", ela utiliza soluções naturais (normalmente dextrose concentrada) para induzir a proliferação de novas células de colágeno, reforçando e cicatrizando ligamentos e tendões afrouxados por microtraumas.' },
      { q: 'Quantas sessões são indicadas?', a: 'Geralmente um protocolo completo de Proloterapia exige de 3 a 5 sessões, realizadas com intervalos de 3 a 4 semanas entre si para dar tempo ao crescimento das novas fibras de colágeno.' },
      { q: 'Por que a proloterapia evita os corticoides?', a: 'Infiltrações comuns com corticoide (cortisona) trazem alívio rápido, mas enfraquecem os tendões no longo prazo. A Proloterapia faz o oposto: ela estimula a cicatrização celular e fortalece as estruturas, oferecendo uma cura permanente.' },
      { q: 'O que sinto após a aplicação?', a: 'Como induzimos uma inflamação controlada para cicatrizar o local, é normal sentir uma leve dor ou peso na região por 24 a 48 horas após a injeção. Este processo inflamatório é necessário para o sucesso terapêutico.' }
    ]
  },
  'bloqueios': {
    tag: 'Medicina Intervencionista',
    title: 'Bloqueios e Infiltrações de Precisão',
    italicTitle: 'alívio imediato da dor',
    subtitle: 'Desative Dores Crônicas e Inflamações Agudas na Coluna e Nervos',
    description: 'Os Bloqueios Intervencionistas são infiltrações de precisão guiadas por imagem (ultrassom) que silenciam os sinais nervosos de dor e desinflamam focos agudos de forma rápida e segura.',
    kpis: [
      { val: '100% Guiado', desc: 'Visualização por ultrassom' },
      { val: 'Sem Internação', desc: 'Procedimento ambulatorial' },
      { val: 'Rápido', desc: 'Alívio nos nervos e articulações' }
    ],
    jointOptions: [
      { value: 'coluna', label: 'Coluna (Hérnia de Disco, Lombalgia, Dor Ciática)' },
      { value: 'joelho', label: 'Joelho (Bloqueio dos Nervos Geniculares para Artrose)' },
      { value: 'ombro', label: 'Ombro (Bloqueio do Nervo Supraescapular para Rigidez)' },
      { value: 'sacroiliaca', label: 'Articulação Sacroilíaca (Dor Crônica na Bacia)' }
    ],
    symptomsTitle: 'Quando o Bloqueio de Dor é necessário?',
    symptoms: [
      { t: 'Hérnia de disco e dor ciática severa', d: 'Dor aguda e em choque que desce pela perna ou irradia pelo braço, impedindo o sono e o repouso.' },
      { t: 'Dor lombar ou cervical crônica', d: 'Desgaste facetário e dores nas costas refratárias que te impedem de ficar sentado ou em pé por mais de 20 minutos.' },
      { t: 'Desejo de evitar cirurgias de coluna', d: 'Para quem busca uma alternativa resolutiva de alta precisão ao invés de cirurgias abertas de artrodese (parafusos).' },
      { t: 'Crise de dor aguda travada', d: 'Estar com a coluna travada, sem conseguir andar ou se mover livremente devido ao espasmo muscular e inflamação extrema.' }
    ],
    processTitle: 'O Procedimento de Precisão',
    processDesc: 'Uma técnica cirúrgica minimamente invasiva sem cortes, focada diretamente no foco transmissor da dor.',
    processCards: [
      {
        tag: 'Fase 1',
        title: 'Mapeamento por Imagem',
        icon: 'verified_user',
        desc: 'O transdutor de ultrassom de alta resolução localiza a raiz nervosa comprimida ou a articulação inflamada na coluna em tempo real.'
      },
      {
        tag: 'Fase 2',
        title: 'Alvo Milimétrico',
        icon: 'vaccines',
        desc: 'Uma agulha extremamente fina é direcionada com precisão milimétrica exatamente ao lado do nervo ou faceta, sob anestesia local.'
      },
      {
        tag: 'Fase 3',
        title: 'Bloqueio e Alívio',
        icon: 'block',
        desc: 'A deposição do composto anti-inflamatório e analgésico desliga o sinal de dor aguda e neutraliza a inflamação, aliviando o paciente imediatamente.'
      }
    ],
    faq: [
      { q: 'O que é um bloqueio de dor?', a: 'É um procedimento onde injetamos compostos anti-inflamatórios e analgésicos diretamente no local de origem da dor (como uma faceta articular na coluna ou ao redor de um nervo comprimido), aliviando a dor severa de forma quase imediata.' },
      { q: 'O procedimento exige internação?', a: 'Não. Os bloqueios são procedimentos minimamente invasivos rápidos (duram de 15 a 30 minutos) realizados sob anestesia local em sala de procedimentos ambulatorial. O paciente repousa por 20 minutos e recebe alta.' },
      { q: 'Quanto tempo dura o alívio?', a: 'O bloqueio quebra o ciclo vicioso de dor crônica e espasmo muscular. Ele costuma trazer alívio por meses, permitindo que o paciente realize fisioterapia e fortalecimento de forma confortável para tratar a causa de forma definitiva.' },
      { q: 'Por que o guia por ultrassom é fundamental?', a: 'Infiltrações às cegas na coluna possuem baixíssima eficácia e risco de atingir estruturas erradas. O guia de ultrassom de alta definição garante segurança máxima e precisão absoluta do alvo.' }
    ]
  }
}

export default function DynamicLP() {
  const params = useParams()
  const treatmentSlug = params.treatment as string

  // Validar se a rota existe, se não, disparar 404
  const data = CAMPAIGN_DATA[treatmentSlug]
  if (!data) {
    notFound()
  }

  const [form, setForm] = useState({ name: '', phone: '', email: '', complaint: '', joint: data.jointOptions[0]?.value || 'joelho' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  // Capturar UTMs da URL
  const [utms, setUtms] = useState({ source: 'google_ads', campaign: '' })
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setUtms({
      source: urlParams.get('utm_source') || 'google_ads',
      campaign: urlParams.get('utm_campaign') || `lp_tratamento_${treatmentSlug}`,
    })
  }, [treatmentSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Por favor, preencha seu nome e telefone.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          complaint: `Tratamento de interesse: ${treatmentSlug.toUpperCase()}. Articulação: ${form.joint.toUpperCase()}. Queixa: ${form.complaint}`,
          utmSource: utms.source,
          utmCampaign: utms.campaign,
        }),
      })

      if (!res.ok) throw new Error()

      setSubmitted(true)
      toast.success('Recebemos seus dados! Nossa equipe entrará em contato em breve.')

      // Tracking do Lead no First-Party Analytics
      if (typeof (window as any).twixTrack === 'function') {
        (window as any).twixTrack('click', `Conversão Lead LP ${treatmentSlug.toUpperCase()}`, { joint: form.joint })
      }
    } catch {
      toast.error('Ocorreu um erro ao enviar seus dados. Tente novamente ou nos chame no WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#021541] font-sans selection:bg-[#00BCE4] selection:text-white">
      <Toaster position="top-right" />

      {/* ── HEADER DE CONFIANÇA ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#021541]/06 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00BCE4]" />
            <span className="font-extrabold text-base tracking-[0.12em] uppercase font-mono">
              REGEN<span className="text-[#00BCE4]">ORTHO</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <span className="text-xs font-semibold text-[#718096] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#00BCE4] text-base">verified</span>
              CRM-SP: 172.932 | RQE: 89.243
            </span>
            <a
              href={`https://wa.me/5512981767896?text=Ol%C3%A1%2C+vi+a+p%C3%A1gina+sobre+${encodeURIComponent(data.title)}+e+gostaria+de+saber+mais.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#00BCE4]/08 text-[#00BCE4] hover:bg-[#00BCE4] hover:text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">message</span>
              Falar pelo WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative bg-gradient-to-br from-[#021541] via-[#032170] to-[#021541] py-20 lg:py-28 text-white overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#00BCE4]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#00BCE4]/05 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          {/* Lado Esquerdo - Chamada Persuasiva */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00BCE4]/15 border border-[#00BCE4]/30 text-[#00BCE4] text-[10px] font-bold uppercase tracking-widest"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00BCE4] animate-ping" />
              {data.tag}
            </span>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {data.title.split(' — ')[0]} — <span className="text-[#00BCE4] italic font-normal">{data.italicTitle}</span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg font-light leading-relaxed max-w-2xl">
              {data.subtitle}. {data.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-xl mx-auto lg:mx-0">
              {data.kpis.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/04 border border-white/08 text-center sm:text-left">
                  <span className="text-xl font-extrabold text-[#00BCE4] block font-mono">{item.val}</span>
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lado Direito - Glassmorphism Lead Form */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-[#00BCE4]/10 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-white/05 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="text-center sm:text-left mb-6">
                    <h3 className="text-xl font-bold text-white leading-tight">Agendar Avaliação Médica</h3>
                    <p className="text-white/40 text-xs mt-1">Preencha os dados e fale com nossa equipe especializada para analisar seu quadro clínico.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Nome Completo</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-base">person</span>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ex: Carlos Silva"
                        className="w-full bg-white/06 border border-white/08 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">WhatsApp ou Telefone</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-base">phone</span>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="Ex: (12) 99999-9999"
                        className="w-full bg-white/06 border border-white/08 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Local da Dor / Articulação</label>
                    <select
                      value={form.joint}
                      onChange={e => setForm(p => ({ ...p, joint: e.target.value }))}
                      className="w-full bg-[#021541] border border-white/08 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00BCE4] transition-all"
                    >
                      {data.jointOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      <option value="outra">Outros Locais / Dores Crônicas</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Conte sua queixa ou sintoma (Opcional)</label>
                    <textarea
                      value={form.complaint}
                      onChange={e => setForm(p => ({ ...p, complaint: e.target.value }))}
                      placeholder="Ex: Sinto dor intensa há meses e gostaria de saber se este tratamento serve para mim..."
                      rows={2}
                      className="w-full bg-white/06 border border-white/08 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#00BCE4] hover:bg-[#009ebd] disabled:opacity-50 text-[#021541] font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#00BCE4]/20 mt-2"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-[#021541] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">event_available</span>
                        Quero Agendar Minha Avaliação
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-white/30 text-center leading-relaxed mt-2">
                    🔒 Seus dados estão seguros e protegidos pela LGPD. Contato exclusivamente para fins de agendamento clínico.
                  </p>
                </form>
              ) : (
                <div className="text-center py-10 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto text-green-400">
                    <span className="material-symbols-outlined text-3xl">done_all</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cadastro Confirmado!</h3>
                    <p className="text-white/60 text-sm mt-2 leading-relaxed">
                      Obrigado pelo contato, <span className="text-white font-bold">{form.name}</span>. Nossa equipe de enfermagem entrará em contato via WhatsApp ou ligação no número <span className="text-white font-bold">{form.phone}</span> para colher detalhes e marcar sua consulta.
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/5512981767896?text=Ol%C3%A1%2C+meu+nome+%C3%A9+${encodeURIComponent(form.name)}+e+acabei+de+me+cadastrar+pela+p%C3%A1gina+sobre+${encodeURIComponent(data.title)}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined">message</span>
                    Acelerar Contato via WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO DE INDICAÇÕES CLÍNICAS ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Sinais Clínicos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              {data.symptomsTitle}
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.symptoms.map((item, idx) => (
              <div key={idx} className="flex gap-4 p-5 rounded-2xl bg-[#f5f6f8] border border-[#021541]/03">
                <span className="material-symbols-outlined text-red-500 shrink-0 mt-0.5">report_problem</span>
                <div>
                  <h4 className="font-extrabold text-sm text-[#021541]">{item.t}</h4>
                  <p className="text-xs text-[#718096] mt-1 leading-relaxed font-light">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA O PROCEDIMENTO ── */}
      <section className="py-20 bg-[#021541] text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 80% 20%, rgba(0,188,228,0.10) 0%, transparent 50%)',
        }} />

        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Protocolo Seguro</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ fontFamily: 'Noto Serif, serif' }}>
              {data.processTitle}
            </h2>
            <p className="text-white/50 text-xs mt-2">{data.processDesc}</p>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.processCards.map((card, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-white/04 border border-white/08 relative group hover:border-[#00BCE4]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#00BCE4]/10 border border-[#00BCE4]/20 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>{card.icon}</span>
                </div>
                <span className="text-[10px] text-[#00BCE4] uppercase font-bold tracking-widest block mb-1">{card.tag}</span>
                <h3 className="text-lg font-extrabold text-white mb-3">{card.title}</h3>
                <p className="text-white/60 text-xs font-light leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUTORIDADE MÉDICA (DR. ANDRÉ) ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-72 aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-[#021541]/10 bg-slate-100">
              <Image
                src="/image/drandre.webp"
                alt="Dr. André Elias Junqueira"
                fill
                className="object-cover"
                sizes="288px"
              />
            </div>
            <div className="absolute -bottom-4 -right-2 px-5 py-3 rounded-xl bg-[#00BCE4] text-[#021541] font-bold text-xs uppercase tracking-wider shadow-lg">
              Especialista em Ombro, Cotovelo e Dor
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block">— Corpo Clínico</span>
            <h2 className="text-3xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              Responsabilidade Técnica e Rigor Científico
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4]" />
            <h3 className="text-lg font-extrabold text-[#021541]">Dr. André Elias Junqueira</h3>
            <p className="text-[#718096] text-sm font-light leading-relaxed">
              Médico Ortopedista e Traumatologista com mais de 10 anos de experiência clínica. Especialista pela Associação Médica Brasileira e membro da Sociedade Brasileira de Ortopedia e Traumatologia (SBOT). Formação sólida com rigor acadêmico pela UNIFESP e USP, focado em reabilitação de dor articular e infiltrações regenerativas sob guias de precisão por imagem.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {['CRM-SP 172.932', 'RQE 89.243', 'Membro SBOT', 'Ortopedia Intervencionista'].map(chip => (
                <span
                  key={chip}
                  className="px-3.5 py-1 text-[10px] font-bold text-[#021541] bg-[rgba(2,21,65,0.04)] rounded-full border border-[rgba(2,21,65,0.08)] uppercase tracking-wider"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SEÇÃO ── */}
      <section className="py-20 bg-[#f5f6f8] border-t border-[#021541]/05">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Dúvidas Frequentes</span>
            <h2 className="text-3xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              Perguntas e Respostas
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="space-y-3">
            {data.faq.map((item, idx) => {
              const isOpen = activeFaq === idx
              return (
                <div key={idx} className="bg-white rounded-xl border border-[#021541]/05 overflow-hidden transition-all shadow-sm">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-bold text-sm text-[#021541] hover:text-[#00BCE4] transition-colors"
                  >
                    <span>{item.q}</span>
                    <span className="material-symbols-outlined transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', color: '#00BCE4' }}>
                      expand_more
                    </span>
                  </button>
                  <div
                    className="transition-all duration-300 overflow-hidden"
                    style={{ maxHeight: isOpen ? '250px' : '0px' }}
                  >
                    <p className="px-5 pb-5 pt-1 text-xs text-[#718096] leading-relaxed font-light border-t border-[rgba(2,21,65,0.03)] bg-slate-50/50">
                      {item.a}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER SIMPLIFICADO DE CONVERSÃO ── */}
      <footer className="bg-[#021541] text-white/50 text-[11px] py-12 border-t border-white/06">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
          <p className="font-bold text-white tracking-widest uppercase font-mono text-sm">
            REGEN<span className="text-[#00BCE4]">ORTHO</span> CLINIC
          </p>
          <p className="max-w-xl mx-auto leading-relaxed">
            As infiltrações ortobiológicas e regenerativas descritas nesta página são procedimentos médicos de precisão realizados no consultório. O agendamento prévio é obrigatório para análise de exames e histórico clínico.
          </p>
          <div className="h-px bg-white/08 w-24 mx-auto my-4" />
          <p className="text-[10px]">
            © {new Date().getFullYear()} REGENORTHO. Todos os direitos reservados. Responsabilidade Técnica: Dr. André Elias Junqueira CRM-SP 172.932 | RQE 89.243
          </p>
        </div>
      </footer>
    </div>
  )
}
