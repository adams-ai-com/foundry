// Public layout — no Foundry session required
// Root layout handles html/body/fonts; this just passes children through.
export default function SignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
