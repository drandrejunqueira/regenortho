import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#f5f6f8]">
      {/* Fixed 220px sidebar, desktop only */}
      <div className="hidden md:block fixed top-0 left-0 h-screen w-[220px] z-30 print:hidden">
        <Sidebar />
      </div>

      {/* Main content — offset by sidebar width on md+ */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[220px]">
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
