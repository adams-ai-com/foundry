import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OWL PDF Pricing — No per-envelope fees, no seat limits',
  description: 'Open-source PDF editing, forms, conversion, and defensible redaction. Free to self-host. No DocuSign envelope tax.',
}

function Logo() {
  return (
    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg" aria-hidden="true">
        <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
      </svg>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-fg-tertiary/40 flex-shrink-0" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
    </svg>
  )
}

function PartialIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
    </svg>
  )
}

const COMPARE_ROWS = [
  {
    feature: 'Base price',
    foundry: 'Free (self-hosted)',
    acrobat: '$240/seat/year',
    docusign: '$480/seat/year',
    foundryHighlight: true,
  },
  {
    feature: 'Per-envelope / send fees',
    foundry: 'None',
    acrobat: 'None',
    docusign: '$0.50–$3.00 per envelope',
    foundryHighlight: true,
  },
  {
    feature: 'Seat limits',
    foundry: 'Unlimited',
    acrobat: 'Per seat',
    docusign: 'Per seat',
    foundryHighlight: true,
  },
  { feature: 'PDF editing', foundry: true, acrobat: true, docusign: false },
  { feature: 'Fillable forms', foundry: true, acrobat: true, docusign: 'partial' },
  { feature: 'Format conversion (DOCX, XLSX, PDF/A)', foundry: true, acrobat: true, docusign: false },
  { feature: 'Defensible redaction', foundry: true, acrobat: 'partial', docusign: false },
  { feature: 'Redaction certificate', foundry: true, acrobat: false, docusign: false },
  { feature: 'Self-hosted / on-prem', foundry: true, acrobat: false, docusign: false },
  { feature: 'Open source', foundry: true, acrobat: false, docusign: false },
  { feature: 'Audit log', foundry: true, acrobat: false, docusign: 'partial' },
]

const FEATURES = [
  {
    category: 'Editing',
    items: [
      'Page reorder, rotate, delete, duplicate',
      'Merge and split PDFs',
      'Insert blank pages and images',
      'Annotations: text, highlight, underline, strikethrough, sticky note, arrow, shapes, stamps',
      'Continuous scroll and single-page view',
      'Header / footer with page numbering',
      'Watermark',
      'Find & replace',
      'Document properties (title, author, subject, keywords)',
      'Bookmarks / outline navigation',
    ],
  },
  {
    category: 'Forms',
    items: [
      'Drag-and-drop fillable form builder',
      'Field types: text, number, date, checkbox, radio, dropdown, signature',
      'Fill and export existing AcroForms',
      'Preview mode',
    ],
  },
  {
    category: 'Conversion',
    items: [
      'PDF → DOCX, XLSX, plain text',
      'DOCX / XLSX / PPTX → PDF',
      'PDF → PNG, JPEG (per page or full zip)',
      'PDF → PDF/A-2b archival format',
    ],
  },
  {
    category: 'Redaction',
    items: [
      'Region selection across multiple pages',
      'Object-level content removal — not paint-over',
      'Metadata scrub: Info dictionary, XMP, embedded JS, attachments',
      'Audit log (user, timestamp, page regions — not content)',
      'Redaction certificate PDF with dual SHA-256 hashes',
    ],
  },
]

const FAQS = [
  {
    q: 'Is the self-hosted version really free?',
    a: 'Yes. AGPL-3.0. Run it on your own server with docker compose up. No seats, no envelopes, no calls to sales.',
  },
  {
    q: "How is OWL PDF's redaction different from Acrobat's?",
    a: "Acrobat paints a black rectangle over content — the underlying text remains in the file, searchable and copyable. Courts have rejected documents redacted this way. OWL PDF removes content at the object level using PyMuPDF's apply_redacts(): text runs, image pixels, and vector paths are deleted from the content stream before saving. Every redaction generates a certificate with SHA-256 hashes of both the original and redacted document.",
  },
  {
    q: 'What is the envelope tax and why does it matter for governments?',
    a: 'DocuSign charges per signature event — typically $0.50–$3.00 each time someone signs a document. A city processing 10,000 permits, HR forms, and contracts per year pays $5,000–$30,000 in envelope fees alone, on top of seat costs. OWL PDF has no envelope fees at any volume.',
  },
  {
    q: 'Can I migrate from Acrobat or DocuSign?',
    a: "Yes. Any PDF you can export from Acrobat or DocuSign can be opened, edited, and re-saved in OWL PDF. There is no proprietary format to escape from.",
  },
  {
    q: 'Does OWL PDF handle e-signatures?',
    a: 'OWL PDF creates AcroForm signature fields in PDFs. Full cryptographic signing (PKI/X.509) is on the roadmap. For organizations that need legally binding e-signatures today, OWL PDF handles the document preparation and form creation; your signing workflow closes the loop.',
  },
  {
    q: 'What does OpenWork Loft Cloud include?',
    a: 'OpenWork Loft Cloud is a managed, hosted instance of the full OWL workspace — Docs, Sheets, Mail, Channels, Wiki, and PDF — under one login. Flat annual pricing, no per-envelope fees, no per-seat fees beyond the base plan. Contact us for a quote.',
  },
]

type CompareRow =
  | { feature: string; foundry: string; acrobat: string; docusign: string; foundryHighlight: boolean }
  | { feature: string; foundry: boolean | 'partial'; acrobat: boolean | 'partial'; docusign: boolean | 'partial' }

function CellValue({ value }: { value: boolean | 'partial' | string }) {
  if (value === true) return <CheckIcon />
  if (value === false) return <XIcon />
  if (value === 'partial') return (
    <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
      <PartialIcon /> Partial
    </span>
  )
  return <span className="text-fg-primary text-sm font-medium">{value}</span>
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-base">

      {/* Header */}
      <header className="h-14 border-b border-border bg-bg-base/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold text-fg-primary text-sm">OpenWork Loft</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/#apps" className="hidden sm:block text-sm text-fg-secondary hover:text-fg-primary transition-colors">Apps</Link>
          <Link href="/#self-host" className="hidden sm:block text-sm text-fg-secondary hover:text-fg-primary transition-colors">Self-host</Link>
          <Link href="/pricing" className="hidden sm:block text-sm text-accent font-medium">Pricing</Link>
          <a href="https://github.com/adams-ai-com/foundry" className="hidden sm:flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors">
            <GitHubIcon /> GitHub
          </a>
          <Link href="/login" className="text-sm font-medium bg-bg-raised border border-border hover:bg-bg-hover text-fg-primary px-4 py-1.5 rounded-lg transition-colors">
            Sign in →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-16 text-center px-6">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[800px] h-[400px] rounded-full bg-orange-500/6 blur-[120px]" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-bg-surface border border-border text-fg-secondary text-xs px-3 py-1.5 rounded-full mb-8 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            OWL PDF
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold text-fg-primary tracking-tight mb-5 leading-[1.05]">
            No per-envelope tax.<br />
            <span className="text-orange-500">No seat limits.</span>
          </h1>
          <p className="text-lg text-fg-secondary mb-10 max-w-xl mx-auto leading-relaxed">
            PDF editing, forms, conversion, and legally defensible redaction. Open source, self-hosted, and free — or managed by Adams AI.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="https://github.com/adams-ai-com/foundry-pdf" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-7 py-3 rounded-lg text-sm transition-all shadow-lg shadow-accent/20">
              <GitHubIcon /> Get the Docker image
            </a>
            <a href="mailto:hello@adams-ai.com" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border font-medium px-7 py-3 rounded-lg text-sm transition-all">
              Talk to us about cloud hosting →
            </a>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Self-hosted */}
          <div className="bg-bg-raised border border-border rounded-2xl p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest mb-2">Self-hosted</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-semibold text-fg-primary">$0</span>
                <span className="text-fg-tertiary text-sm">forever</span>
              </div>
              <p className="text-fg-secondary text-sm leading-relaxed">
                Run it on your own server. AGPL-3.0. No seats, no envelopes, no calls to sales.
              </p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {['Unlimited users', 'Unlimited envelopes', 'Full feature set', 'docker compose up', 'Community support'].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/adams-ai-com/foundry-pdf"
              className="w-full inline-flex items-center justify-center gap-2 bg-bg-surface hover:bg-bg-hover border border-border text-fg-primary font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              <GitHubIcon /> View on GitHub
            </a>
          </div>

          {/* Cloud */}
          <div className="bg-bg-raised border border-accent/30 rounded-2xl p-8 flex flex-col relative overflow-hidden">
            <div className="pointer-events-none absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest">OpenWork Loft Cloud</p>
                <span className="text-xs bg-accent/10 text-accent font-semibold px-2.5 py-0.5 rounded-full">Managed</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-semibold text-fg-primary">Contact us</span>
              </div>
              <p className="text-fg-secondary text-sm leading-relaxed mb-6">
                Hosted, backed up, and maintained by Adams AI. Flat annual rate — no per-envelope fees, no per-seat surprises.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Full OWL workspace (Docs, Sheets, Mail, PDF, Channels)',
                  'Flat annual pricing',
                  'No envelope or send fees',
                  'Managed upgrades + backups',
                  'Direct support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@adams-ai.com"
                className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-5 py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-accent/10"
              >
                Get in touch →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-border bg-bg-surface px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-3">How it stacks up</p>
          <h2 className="text-3xl font-semibold text-fg-primary text-center tracking-tight mb-12">
            OWL PDF vs. the alternatives
          </h2>

          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-raised">
                  <th className="text-left px-6 py-4 text-fg-tertiary font-medium text-xs uppercase tracking-wider w-2/5">Feature</th>
                  <th className="text-center px-4 py-4 text-orange-500 font-semibold text-sm w-1/5">OWL PDF</th>
                  <th className="text-center px-4 py-4 text-fg-secondary font-medium text-sm w-1/5">Adobe Acrobat Pro</th>
                  <th className="text-center px-4 py-4 text-fg-secondary font-medium text-sm w-1/5">DocuSign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARE_ROWS.map((row) => {
                  const isText = 'foundryHighlight' in row
                  return (
                    <tr key={row.feature} className="bg-bg-base hover:bg-bg-surface transition-colors">
                      <td className="px-6 py-3.5 text-fg-secondary text-sm">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          {isText
                            ? <span className={`text-sm font-semibold ${row.foundryHighlight ? 'text-orange-500' : 'text-fg-primary'}`}>{row.foundry as string}</span>
                            : <CellValue value={row.foundry as boolean | 'partial'} />
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          {isText
                            ? <span className="text-sm text-fg-tertiary">{row.acrobat as string}</span>
                            : <CellValue value={row.acrobat as boolean | 'partial'} />
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          {isText
                            ? <span className="text-sm text-fg-tertiary">{row.docusign as string}</span>
                            : <CellValue value={row.docusign as boolean | 'partial'} />
                          }
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-fg-tertiary text-center mt-4">
            Acrobat Pro at $19.99/mo individual / $23.99/mo teams. DocuSign Business Pro at ~$40/user/mo + per-envelope fees.
            Government pricing is negotiated — state and local agencies do not qualify for GSA federal discounts.
          </p>
        </div>
      </section>

      {/* Envelope tax section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest mb-3">The envelope tax</p>
              <h2 className="text-3xl font-semibold text-fg-primary tracking-tight mb-4 leading-tight">
                DocuSign charges every time someone signs.
              </h2>
              <p className="text-fg-secondary text-sm leading-relaxed mb-4">
                A mid-size city processing permits, contracts, and HR documents sends 10,000–50,000 signature events per year. At DocuSign rates, that's $25,000–$150,000 annually — for signatures alone, with no PDF editing included.
              </p>
              <p className="text-fg-secondary text-sm leading-relaxed">
                DocuSign's GSA discount (70% off, announced July 2025) requires a minimum of 50,000 envelopes and applies to <strong className="text-fg-primary">federal agencies only</strong>. State and local governments pay list price.
              </p>
            </div>
            <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg-surface">
                <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-wider">Annual cost by volume</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-fg-tertiary font-medium text-xs">Envelopes/yr</th>
                    <th className="text-right px-5 py-3 text-orange-500 font-semibold text-xs">OWL PDF</th>
                    <th className="text-right px-5 py-3 text-fg-secondary font-medium text-xs">DocuSign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { vol: '500', foundry: '$0', docusign: '~$1,500' },
                    { vol: '5,000', foundry: '$0', docusign: '~$12,500' },
                    { vol: '25,000', foundry: '$0', docusign: '~$62,500' },
                    { vol: '50,000', foundry: '$0', docusign: '~$75,000–$150,000' },
                  ].map(row => (
                    <tr key={row.vol} className="hover:bg-bg-surface transition-colors">
                      <td className="px-5 py-3 text-fg-secondary tabular-nums">{row.vol}</td>
                      <td className="px-5 py-3 text-right text-orange-500 font-semibold">{row.foundry}</td>
                      <td className="px-5 py-3 text-right text-fg-tertiary">{row.docusign}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* The redaction problem */}
      <section className="border-t border-border bg-bg-surface px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest mb-3">Defensible redaction</p>
              <h2 className="text-3xl font-semibold text-fg-primary tracking-tight mb-4 leading-tight">
                Acrobat's redaction has a known flaw.
              </h2>
              <p className="text-fg-secondary text-sm leading-relaxed mb-4">
                Acrobat Pro's redaction paints a black rectangle over text. The underlying content stream is unchanged — the text remains searchable, copyable, and recoverable. Courts have rejected FOIA responses redacted this way.
              </p>
              <p className="text-fg-secondary text-sm leading-relaxed">
                OWL PDF removes content at the PDF object level: text runs, image pixels, and vector paths are deleted from the file before saving. The redacted content cannot be recovered by any means short of the original document.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Acrobat / paint-over approach</p>
                <p className="font-mono text-xs text-fg-secondary leading-6">
                  Draw filled rectangle annotation<br />
                  <span className="text-red-400">Text stream: unchanged</span><br />
                  <span className="text-red-400">Content: still copyable</span><br />
                  <span className="text-red-400">Recovery: trivial</span>
                </p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">OWL PDF — object-level removal</p>
                <p className="font-mono text-xs text-fg-secondary leading-6">
                  page.apply_redacts(<br />
                  {'  '}images=REDACT_IMAGE_PIXELS,<br />
                  {'  '}graphics=True,<br />
                  {'  '}text=True<br />
                  )<br />
                  <span className="text-emerald-400">Content stream: deleted</span><br />
                  <span className="text-emerald-400">Recovery: impossible</span>
                </p>
              </div>
              <div className="bg-bg-raised border border-border rounded-xl p-5">
                <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-wider mb-2">Every redaction generates</p>
                <ul className="space-y-1.5 text-xs text-fg-secondary">
                  <li className="flex items-center gap-2"><CheckIcon /> Audit log entry (user, timestamp, regions)</li>
                  <li className="flex items-center gap-2"><CheckIcon /> SHA-256 hash of original + redacted file</li>
                  <li className="flex items-center gap-2"><CheckIcon /> Signed redaction certificate PDF</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full feature list */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-3">What's included</p>
          <h2 className="text-3xl font-semibold text-fg-primary text-center tracking-tight mb-12">Everything in every plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(({ category, items }) => (
              <div key={category} className="bg-bg-raised border border-border rounded-xl p-6">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-4">{category}</p>
                <ul className="space-y-2.5">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-fg-secondary">
                      <CheckIcon />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-bg-surface px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-3">FAQ</p>
          <h2 className="text-3xl font-semibold text-fg-primary text-center tracking-tight mb-12">Common questions</h2>
          <div className="space-y-6">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="border-b border-border pb-6 last:border-b-0 last:pb-0">
                <h3 className="font-semibold text-fg-primary text-sm mb-2">{q}</h3>
                <p className="text-fg-secondary text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-border px-6 py-24 text-center">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[700px] h-[400px] rounded-full bg-orange-500/5 blur-[100px]" />
        <div className="relative max-w-lg mx-auto">
          <h2 className="text-4xl font-semibold text-fg-primary tracking-tight mb-4 leading-tight">
            Stop paying per envelope.
          </h2>
          <p className="text-fg-secondary text-sm mb-8">Self-host for free, or let Adams AI manage it for you.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="https://github.com/adams-ai-com/foundry-pdf" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-8 py-3 rounded-lg text-sm transition-all shadow-lg shadow-accent/20">
              <GitHubIcon /> Get started free
            </a>
            <a href="mailto:hello@adams-ai.com" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary font-medium px-8 py-3 rounded-lg text-sm transition-colors">
              Talk to us →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-sm font-medium text-fg-primary">OpenWork Loft</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-fg-tertiary">
            <Link href="/pricing" className="text-accent">Pricing</Link>
            <span>AGPL-3.0</span>
            <a href="https://github.com/adams-ai-com/foundry" className="hover:text-fg-secondary transition-colors">GitHub</a>
            <span>Built by Adams AI</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
