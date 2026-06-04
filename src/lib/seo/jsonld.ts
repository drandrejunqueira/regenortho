import type { InferSelectModel } from 'drizzle-orm'
import type { clinicSettings, glossarioTermos } from '@/lib/db/schema'

type ClinicSettingsModel = typeof clinicSettings.$inferSelect;
type GlossarioTermoModel = typeof glossarioTermos.$inferSelect;

/**
 * Cria o schema principal do tipo MedicalClinic ou Physician para a clínica.
 */
export function getClinicJsonLd(
  clinic: Partial<ClinicSettingsModel> | null,
  configs: Record<string, string>
) {
  const base = (configs.site_url || 'https://regenortho.com.br').replace(/\/$/, '')
  const type = configs.geo_clinic_type || 'MedicalClinic'
  
  const sameAsList = configs.geo_same_as
    ? configs.geo_same_as
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const specialties = configs.geo_specialties
    ? configs.geo_specialties.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Ortopedia', 'Medicina Regenerativa', 'Tratamento da Dor']

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${base}/#clinic`,
    name: clinic?.name || 'REGENORTHO',
    alternateName: 'RegenOrtho Clinical Atelier',
    url: base,
    logo: clinic?.logoUrl || `${base}/logo.png`,
    image: clinic?.headerImageUrl || clinic?.logoUrl || undefined,
    description: configs.geo_ai_summary || clinic?.seoDescription || 'Clínica de referência em ortopedia regenerativa e tratamento intervencionista da dor.',
    telephone: clinic?.phone || clinic?.whatsapp || undefined,
    email: clinic?.email || undefined,
    knowsAbout: specialties,
    sameAs: sameAsList,
  }

  // Address
  if (clinic?.address || clinic?.city || clinic?.state) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: clinic.address || undefined,
      addressLocality: clinic.city || undefined,
      addressRegion: clinic.state || undefined,
      postalCode: clinic.zipCode || undefined,
      addressCountry: 'BR',
    }
  }

  // Coordinates
  if (configs.geo_latitude && configs.geo_longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: parseFloat(configs.geo_latitude),
      longitude: parseFloat(configs.geo_longitude),
    }
  }

  // Medical Director
  if (configs.geo_medical_director) {
    schema.medicalDirector = {
      '@type': 'Person',
      name: configs.geo_medical_director,
      jobTitle: 'Diretor Clínico',
      alumniOf: {
        '@type': 'EducationalOrganization',
        name: 'Faculdade de Medicina',
      },
    }
    if (configs.geo_crm) {
      schema.medicalDirector.identifier = {
        '@type': 'PropertyValue',
        name: 'CRM',
        value: configs.geo_crm,
      }
    }
  }

  // Opening hours parsing
  const openingHours = configs.geo_opening_hours || 'Mo-Fr 08:00-18:00'
  const match = openingHours.match(/([a-zA-Z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})/)
  if (match) {
    const daysRaw = match[1]
    const opens = match[2]
    const closes = match[3]

    let days: string[] = []
    if (daysRaw.includes('-')) {
      const parts = daysRaw.split('-')
      if (parts[0] === 'Mo' && parts[1] === 'Fr') {
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      } else {
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      }
    } else {
      days = daysRaw.split(',').map((d) => {
        if (d === 'Mo') return 'Monday'
        if (d === 'Tu') return 'Tuesday'
        if (d === 'We') return 'Wednesday'
        if (d === 'Th') return 'Thursday'
        if (d === 'Fr') return 'Friday'
        if (d === 'Sa') return 'Saturday'
        if (d === 'Su') return 'Sunday'
        return d
      })
    }

    schema.openingHoursSpecification = [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: days,
        opens,
        closes,
      },
    ]
  }

  return schema
}

/**
 * Cria o schema para um verbete do Glossário.
 * Mapeia o verbete para um artigo de teor médico especializado.
 */
export function getGlossarioTermoJsonLd(
  termo: Partial<GlossarioTermoModel>,
  clinic: Partial<ClinicSettingsModel> | null,
  configs: Record<string, string>
) {
  const base = (configs.site_url || 'https://regenortho.com.br').replace(/\/$/, '')
  const clinicType = configs.geo_clinic_type || 'MedicalClinic'
  const specialties = configs.geo_specialties
    ? configs.geo_specialties.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Ortopedia', 'Medicina Regenerativa']

  const url = `${base}/site/glossario/${termo.slug}`

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    '@id': `${url}/#webpage`,
    url,
    name: termo.seoTitle || `${termo.termo} — Significado no Glossário Médico`,
    description: termo.seoDescription || `Definição técnica e significado médico do termo: ${termo.termo}.`,
    about: {
      '@type': 'MedicalCondition',
      name: termo.termo,
      description: termo.seoDescription || undefined,
    },
    aspect: ['definition', 'overview'],
    audience: {
      '@type': 'Patient',
      geographicArea: {
        '@type': 'AdministrativeArea',
        name: clinic?.city || 'São José dos Campos',
      },
    },
    author: {
      '@type': 'Person',
      name: configs.geo_medical_director || 'Dr. André Elias Junqueira',
      description: configs.geo_crm ? `CRM: ${configs.geo_crm}` : undefined,
    },
    provider: {
      '@type': clinicType,
      name: clinic?.name || 'REGENORTHO',
      url: base,
    },
    mainEntityOfPage: url,
    knowsAbout: specialties,
  }
}

/**
 * Cria o schema para a página de Especialidades.
 */
export function getEspecialidadesJsonLd(
  clinic: Partial<ClinicSettingsModel> | null,
  configs: Record<string, string>
) {
  const base = (configs.site_url || 'https://regenortho.com.br').replace(/\/$/, '')
  const specialties = configs.geo_specialties
    ? configs.geo_specialties.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Ortopedia', 'Medicina Regenerativa']

  const url = `${base}/site/especialidades`

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    '@id': `${url}/#webpage`,
    url,
    name: 'Especialidades e Tratamentos Regenerativos',
    description: 'Especialidades clínicas oferecidas pela REGENORTHO. Tratamento avançado de dores nas articulações.',
    provider: {
      '@type': configs.geo_clinic_type || 'MedicalClinic',
      name: clinic?.name || 'REGENORTHO',
      url: base,
    },
    knowsAbout: specialties,
  }
}
